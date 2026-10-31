//! Tauri IPC Command handlers for Multi-Agent Discussion System.

use super::orchestrator::{DiscussionEvent, DiscussionEventListener, DiscussionOrchestrator};
use super::report::ReportGenerator;
use super::runner::{CliProvider, CliType, DiscussionProvider, HttpProvider, MockProvider};
use super::storage::{
    has_live_external_lock, load_metadata, read_transcript_with_recovery, save_metadata,
};
use super::types::{
    now_ms, DiscussionConfig, DiscussionMessage, DiscussionMetadata, DiscussionStatus,
};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

pub type SharedDiscussionManager = Arc<DiscussionManager>;

pub struct DiscussionManager {
    active_orchestrators: Arc<Mutex<HashMap<String, Arc<Mutex<DiscussionOrchestrator>>>>>,
    session_workspaces: Arc<std::sync::Mutex<HashMap<String, String>>>,
    client: reqwest::Client,
}

impl DiscussionManager {
    pub fn new() -> Self {
        Self {
            active_orchestrators: Arc::new(Mutex::new(HashMap::new())),
            session_workspaces: Arc::new(std::sync::Mutex::new(HashMap::new())),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(180))
                .build()
                .unwrap_or_default(),
        }
    }

    pub fn record_session_workspace(&self, session_id: &str, workspace_path: &str) {
        let mut map = self
            .session_workspaces
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        map.insert(session_id.to_string(), workspace_path.to_string());
    }

    pub fn lookup_session_workspace(&self, session_id: &str) -> Option<String> {
        let map = self
            .session_workspaces
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        map.get(session_id).cloned()
    }
}

fn extract_panic_payload_message(payload: &(dyn std::any::Any + Send)) -> String {
    if let Some(s) = payload.downcast_ref::<&str>() {
        (*s).to_string()
    } else if let Some(s) = payload.downcast_ref::<String>() {
        s.clone()
    } else {
        "Unexpected runtime panic inside discussion task".to_string()
    }
}

/// Spawns `run_discussion()` inside a panic-supervised Tokio JoinHandle so that an unexpected
/// panic inside any provider, parser, or synthesizer NEVER crashes the desktop application or
/// leaves a session stuck in `running` state.
fn spawn_supervised_discussion_run(
    app: AppHandle,
    active_map: Arc<Mutex<HashMap<String, Arc<Mutex<DiscussionOrchestrator>>>>>,
    session_id: String,
    session_dir: PathBuf,
    orch_arc: Arc<Mutex<DiscussionOrchestrator>>,
) {
    tauri::async_runtime::spawn(async move {
        let inner_orch = orch_arc.clone();
        let join_res = tokio::spawn(async move {
            let mut guard = inner_orch.lock().await;
            guard.run_discussion().await
        })
        .await;

        if let Err(join_err) = join_res {
            let reason = if join_err.is_panic() {
                let p = join_err.into_panic();
                extract_panic_payload_message(p.as_ref())
            } else {
                join_err.to_string()
            };

            eprintln!(
                "[DiscussionSupervisor] Recovered safely from background task failure in '{}': {}",
                session_id, reason
            );

            // Clean stale lock & persist recoverable Failed status on disk
            let lock_path = session_dir.join(".session.lock");
            let _ = fs::remove_file(&lock_path);

            if let Ok(mut meta) = load_metadata(&session_dir) {
                meta.status = DiscussionStatus::Failed;
                meta.error_message = Some(format!(
                    "Recovered safely from internal execution error: {}",
                    reason
                ));
                meta.updated_at = now_ms();
                let _ = save_metadata(&session_dir, &meta);
            }

            {
                let mut active = active_map.lock().await;
                active.remove(&session_id);
            }

            let fail_evt = DiscussionEvent::StatusChanged {
                session_id,
                new_status: DiscussionStatus::Failed,
            };
            app.emit("discussion:event", &fail_evt).ok();
        }
    });
}

/// Self-heals orphaned `running` sessions left behind by an interrupted/closed process:
/// - If all deliberation rounds & participant turns already finished on disk, synthesizes the
///   missing final report immediately and transitions straight to `AwaitingReview`.
/// - Otherwise transitions cleanly to `Interrupted` so the UI displays Resume instead of spinning.
pub fn heal_orphaned_session_on_disk(
    session_dir: &Path,
    is_active_in_memory: bool,
) -> Result<DiscussionMetadata, String> {
    let mut meta = load_metadata(session_dir)?;
    if meta.status != DiscussionStatus::Running || is_active_in_memory {
        return Ok(meta);
    }

    if has_live_external_lock(session_dir) {
        return Ok(meta);
    }

    let lock_path = session_dir.join(".session.lock");
    let _ = fs::remove_file(&lock_path);

    let config_opt = fs::read(session_dir.join("config.json"))
        .ok()
        .and_then(|b| serde_json::from_slice::<DiscussionConfig>(&b).ok());

    if let Some(config) = config_opt {
        if let Ok((transcript, _)) = read_transcript_with_recovery(session_dir) {
            meta.total_messages = transcript.len();
            let active_count = config.participants.len().max(1);
            let final_round_msgs = transcript
                .iter()
                .filter(|m| m.round_number == config.max_rounds)
                .count();

            if meta.current_round >= config.max_rounds && final_round_msgs >= active_count {
                if meta.latest_report_version == 0 {
                    let generator = ReportGenerator::new(session_dir.to_path_buf());
                    let _ = generator.generate_report(&config, &mut meta);
                }
                meta.status = DiscussionStatus::AwaitingReview;
                meta.updated_at = now_ms();
                let _ = save_metadata(session_dir, &meta);
                return Ok(meta);
            }
        }
    }

    meta.status = DiscussionStatus::Interrupted;
    meta.updated_at = now_ms();
    let _ = save_metadata(session_dir, &meta);
    Ok(meta)
}

struct TauriDiscussionListener {
    app: AppHandle,
}

impl DiscussionEventListener for TauriDiscussionListener {
    fn on_event(&self, event: DiscussionEvent) {
        self.app.emit("discussion:event", &event).ok();
    }
}

fn check_tcp_port_alive(url_str: &str, default_port: u16) -> bool {
    let Ok(parsed) = reqwest::Url::parse(url_str) else {
        return false;
    };
    let Some(host) = parsed.host_str() else {
        return false;
    };
    let port = parsed.port().unwrap_or(default_port);
    use std::net::{TcpStream, ToSocketAddrs};
    format!("{}:{}", host, port)
        .to_socket_addrs()
        .ok()
        .and_then(|mut addrs| addrs.next())
        .map(|addr| TcpStream::connect_timeout(&addr, std::time::Duration::from_millis(80)).is_ok())
        .unwrap_or(false)
}

fn resolve_executable(name: &str) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if name == "claude" || name == "claude.exe" {
            if let Ok(userprofile) = std::env::var("USERPROFILE") {
                let p = PathBuf::from(&userprofile)
                    .join(".local")
                    .join("bin")
                    .join("claude.exe");
                if p.exists() {
                    return Some(p);
                }
            }
        }
        if name == "agy" || name == "agy.exe" {
            if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
                let p = PathBuf::from(&localappdata)
                    .join("agy")
                    .join("bin")
                    .join("agy.exe");
                if p.exists() {
                    return Some(p);
                }
            }
        }
    }

    if let Ok(path_var) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let candidate = dir.join(name);
            if candidate.exists() {
                return Some(candidate);
            }
            #[cfg(target_os = "windows")]
            {
                let with_exe = dir.join(format!("{}.exe", name));
                if with_exe.exists() {
                    return Some(with_exe);
                }
            }
        }
    }
    None
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct AvailableProviderInfo {
    pub id: String,
    pub name: String,
    #[serde(rename = "providerType")]
    pub provider_type: String,
    pub available: bool,
    pub description: String,
    #[serde(rename = "model", alias = "defaultModel")]
    pub default_model: String,
    #[serde(rename = "supportsThinking")]
    pub supports_thinking: bool,
    #[serde(rename = "supportsEffort", default)]
    pub supports_effort: bool,
}

/// Composite lookup key (`provider_id::model_id`) so multiple participants sharing a provider
/// (e.g. two Ollama or HTTP agents running different models) never overwrite each other's model,
/// while two participants using the exact same model share the exact same `Arc<dyn DiscussionProvider>`.
pub fn provider_lookup_key(provider_id: &str, model_id: &str) -> String {
    let m = model_id.trim();
    if m.is_empty() || m == "default" {
        provider_id.to_string()
    } else {
        format!("{}::{}", provider_id, m)
    }
}

fn build_provider_map(
    config: &DiscussionConfig,
    client: reqwest::Client,
    store: Option<&crate::store::AppStore>,
) -> HashMap<String, Arc<dyn DiscussionProvider>> {
    let mut map: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
    let session_sandbox = PathBuf::from(&config.workspace_path)
        .join(".flymd")
        .join("discussions")
        .join(&config.session_id)
        .join(".sandbox");

    let settings = store.map(|s| s.get_settings());
    let creds = store.map(|s| s.get_agent_credentials()).unwrap_or_default();

    for p in &config.participants {
        let composite_key = provider_lookup_key(&p.provider_id, &p.model_id);
        if map.contains_key(&composite_key) {
            continue;
        }

        let provider_arc: Arc<dyn DiscussionProvider> = match p.provider_id.as_str() {
            "claude-code" => {
                let custom_bin = creds
                    .get("claude-code")
                    .and_then(|c| c.custom_binary_path.as_ref())
                    .map(PathBuf::from);
                let exe = custom_bin.or_else(|| resolve_executable("claude"));
                if let Some(exe_path) = exe {
                    Arc::new(CliProvider::new(
                        CliType::ClaudeCode,
                        exe_path,
                        session_sandbox.clone(),
                    ))
                } else {
                    Arc::new(MockProvider::new("claude-code"))
                }
            }
            "gemini-antigravity" => {
                let custom_bin = creds
                    .get("antigravity")
                    .and_then(|c| c.custom_binary_path.as_ref())
                    .map(PathBuf::from);
                let exe = custom_bin.or_else(|| resolve_executable("agy"));
                if let Some(exe_path) = exe {
                    Arc::new(CliProvider::new(
                        CliType::AntigravityGemini,
                        exe_path,
                        session_sandbox.clone(),
                    ))
                } else {
                    Arc::new(MockProvider::new("gemini-antigravity"))
                }
            }
            "ollama" => {
                let endpoint = settings
                    .as_ref()
                    .map(|s| s.ollama_url.as_str())
                    .filter(|u| !u.trim().is_empty())
                    .unwrap_or("http://127.0.0.1:11434");
                let model = if !p.model_id.is_empty() && p.model_id != "default" {
                    p.model_id.clone()
                } else {
                    settings
                        .as_ref()
                        .map(|s| s.ollama_model.clone())
                        .filter(|m| !m.trim().is_empty())
                        .unwrap_or_else(|| "qwen2.5:3b".to_string())
                };
                Arc::new(HttpProvider::new(
                    &p.provider_id,
                    client.clone(),
                    endpoint,
                    None,
                    &model,
                    true,
                ))
            }
            "deepseek" | "kimi" | "http-llm" => {
                let (default_endpoint, default_model) = match p.provider_id.as_str() {
                    "deepseek" => ("https://api.deepseek.com", "deepseek-reasoner"),
                    "kimi" => ("https://api.moonshot.cn/v1", "moonshot-v1-8k"),
                    _ => (
                        settings
                            .as_ref()
                            .map(|s| s.llm_config.endpoint_url.as_str())
                            .filter(|u| !u.trim().is_empty())
                            .unwrap_or("https://api.openai.com/v1"),
                        settings
                            .as_ref()
                            .map(|s| s.llm_config.model.as_str())
                            .filter(|m| !m.trim().is_empty())
                            .unwrap_or("gpt-4o"),
                    ),
                };

                // Auto-resolve API key from agent credentials or app settings
                let api_key = creds
                    .get(&p.provider_id)
                    .and_then(|c| c.api_key.clone())
                    .or_else(|| {
                        settings
                            .as_ref()
                            .and_then(|s| s.llm_config.api_key.clone())
                    })
                    .filter(|k| !k.trim().is_empty());

                let model = if !p.model_id.is_empty() && p.model_id != "default" {
                    p.model_id.clone()
                } else {
                    default_model.to_string()
                };

                Arc::new(HttpProvider::new(
                    &p.provider_id,
                    client.clone(),
                    default_endpoint,
                    api_key,
                    &model,
                    false,
                ))
            }
            _ => Arc::new(MockProvider::new(&p.provider_id)),
        };

        map.insert(composite_key, provider_arc.clone());
        map.entry(p.provider_id.clone()).or_insert(provider_arc);
    }

    map
}

#[tauri::command]
pub fn cmd_get_available_providers(
    store: tauri::State<'_, crate::store::SharedStore>,
) -> Vec<AvailableProviderInfo> {
    let settings = store.get_settings();
    let creds = store.get_agent_credentials();

    let claude_available = creds
        .get("claude-code")
        .and_then(|c| c.custom_binary_path.as_ref())
        .map(PathBuf::from)
        .map(|p| p.exists())
        .unwrap_or_else(|| resolve_executable("claude").is_some());

    let gemini_available = creds
        .get("antigravity")
        .and_then(|c| c.custom_binary_path.as_ref())
        .map(PathBuf::from)
        .map(|p| p.exists())
        .unwrap_or_else(|| resolve_executable("agy").is_some());

    let ollama_configured = !settings.ollama_url.trim().is_empty()
        && check_tcp_port_alive(&settings.ollama_url, 11434);
    let http_configured = !settings.llm_config.endpoint_url.trim().is_empty();
    let deepseek_has_key = creds.get("deepseek").and_then(|c| c.api_key.as_ref()).is_some()
        || settings.llm_config.api_key.as_ref().map(|k| !k.trim().is_empty()).unwrap_or(false);

    vec![
        AvailableProviderInfo {
            id: "mock".to_string(),
            name: "Adaptive Domain Simulator (Local)".to_string(),
            provider_type: "simulator".to_string(),
            available: true,
            description: "Zero API cost local analyzer that evaluates architecture and generates multi-step reasoning.".to_string(),
            default_model: "domain-reasoner-v1".to_string(),
            supports_thinking: true,
            supports_effort: false,
        },
        AvailableProviderInfo {
            id: "ollama".to_string(),
            name: "Ollama Local Engine".to_string(),
            provider_type: "ollama".to_string(),
            available: ollama_configured,
            description: format!("Local Ollama daemon at {}", settings.ollama_url),
            default_model: if !settings.ollama_model.is_empty() {
                settings.ollama_model.clone()
            } else {
                "qwen2.5:3b".to_string()
            },
            supports_thinking: true,
            supports_effort: false,
        },
        AvailableProviderInfo {
            id: "deepseek".to_string(),
            name: "DeepSeek Reasoning (R1)".to_string(),
            provider_type: "http".to_string(),
            available: deepseek_has_key,
            description: "Native reasoning engine with chain-of-thought tokens.".to_string(),
            default_model: "deepseek-reasoner".to_string(),
            supports_thinking: true,
            supports_effort: false,
        },
        AvailableProviderInfo {
            id: "http-llm".to_string(),
            name: "Custom LLM / OpenAI API".to_string(),
            provider_type: "http".to_string(),
            available: http_configured,
            description: format!("Configured endpoint at {}", settings.llm_config.endpoint_url),
            default_model: if !settings.llm_config.model.is_empty() {
                settings.llm_config.model.clone()
            } else {
                "gpt-4o".to_string()
            },
            supports_thinking: true,
            supports_effort: false,
        },
        AvailableProviderInfo {
            id: "claude-code".to_string(),
            name: "Claude Code CLI".to_string(),
            provider_type: "cli".to_string(),
            available: claude_available,
            description: "Anthropic Claude Code CLI in plan/read-only mode.".to_string(),
            default_model: "claude-3-7-sonnet".to_string(),
            supports_thinking: true,
            supports_effort: true,
        },
        AvailableProviderInfo {
            id: "gemini-antigravity".to_string(),
            name: "Antigravity Gemini CLI (agy)".to_string(),
            provider_type: "cli".to_string(),
            available: gemini_available,
            description: "Google Antigravity CLI sandbox runner.".to_string(),
            default_model: "gemini-2.5-pro".to_string(),
            supports_thinking: true,
            supports_effort: true,
        },
    ]
}

#[tauri::command]
pub async fn cmd_start_discussion(
    app: AppHandle,
    manager: tauri::State<'_, SharedDiscussionManager>,
    store: tauri::State<'_, crate::store::SharedStore>,
    config: DiscussionConfig,
) -> Result<DiscussionMetadata, String> {
    let session_id = config.session_id.clone();
    manager.record_session_workspace(&session_id, &config.workspace_path);
    let providers = build_provider_map(&config, manager.client.clone(), Some(&store));

    let mut orchestrator = DiscussionOrchestrator::new(config, providers)?;
    orchestrator.set_event_listener(Arc::new(TauriDiscussionListener { app: app.clone() }));

    let session_dir = orchestrator.session_dir.clone();
    let metadata = orchestrator.metadata.clone();
    let orch_arc = Arc::new(Mutex::new(orchestrator));

    {
        let mut active = manager.active_orchestrators.lock().await;
        active.insert(session_id.clone(), orch_arc.clone());
    }

    spawn_supervised_discussion_run(
        app,
        manager.active_orchestrators.clone(),
        session_id,
        session_dir,
        orch_arc,
    );

    Ok(metadata)
}

#[tauri::command]
pub async fn cmd_pause_discussion(
    manager: tauri::State<'_, SharedDiscussionManager>,
    session_id: String,
) -> Result<DiscussionMetadata, String> {
    let active = manager.active_orchestrators.lock().await;
    if let Some(orch_arc) = active.get(&session_id) {
        let mut guard = orch_arc.lock().await;
        guard.pause()?;
        Ok(guard.metadata.clone())
    } else {
        Err(format!(
            "No active running discussion session: {}",
            session_id
        ))
    }
}

#[tauri::command]
pub async fn cmd_resume_discussion(
    app: AppHandle,
    manager: tauri::State<'_, SharedDiscussionManager>,
    store: tauri::State<'_, crate::store::SharedStore>,
    session_id: String,
    workspace_path: String,
) -> Result<DiscussionMetadata, String> {
    let orch_arc = {
        let mut active = manager.active_orchestrators.lock().await;
        if let Some(existing) = active.get(&session_id) {
            existing.clone()
        } else {
            // Recover persisted config.json from disk first so participant providers & models are rebuilt accurately
            let config_path = Path::new(&workspace_path)
                .join(".flymd")
                .join("discussions")
                .join(&session_id)
                .join("config.json");
            let persisted_config = fs::read(&config_path)
                .ok()
                .and_then(|b| serde_json::from_slice::<DiscussionConfig>(&b).ok())
                .unwrap_or(DiscussionConfig {
                    schema_version: 1,
                    session_id: session_id.clone(),
                    topic: String::new(),
                    user_idea: String::new(),
                    workspace_path: workspace_path.clone(),
                    max_rounds: 3,
                    turn_timeout_secs: 120,
                    participants: Vec::new(),
                    active_skill_uris: Vec::new(),
                    step_mode: false,
                });
            let providers =
                build_provider_map(&persisted_config, manager.client.clone(), Some(&store));
            let mut recovered = DiscussionOrchestrator::recover(
                Path::new(&workspace_path),
                &session_id,
                providers,
            )?;
            recovered.set_event_listener(Arc::new(TauriDiscussionListener { app: app.clone() }));
            let arc = Arc::new(Mutex::new(recovered));
            active.insert(session_id.clone(), arc.clone());
            arc
        }
    };

    manager.record_session_workspace(&session_id, &workspace_path);
    let (metadata, session_dir) = {
        let guard = orch_arc.lock().await;
        (guard.metadata.clone(), guard.session_dir.clone())
    };

    spawn_supervised_discussion_run(
        app,
        manager.active_orchestrators.clone(),
        session_id,
        session_dir,
        orch_arc,
    );

    Ok(metadata)
}

#[tauri::command]
pub async fn cmd_cancel_discussion(
    manager: tauri::State<'_, SharedDiscussionManager>,
    session_id: String,
) -> Result<DiscussionMetadata, String> {
    let active = manager.active_orchestrators.lock().await;
    if let Some(orch_arc) = active.get(&session_id) {
        let mut guard = orch_arc.lock().await;
        guard.cancel()?;
        Ok(guard.metadata.clone())
    } else {
        Err(format!("No active discussion session: {}", session_id))
    }
}

#[tauri::command]
pub async fn cmd_inject_discussion_guidance(
    app: AppHandle,
    manager: tauri::State<'_, SharedDiscussionManager>,
    store: tauri::State<'_, crate::store::SharedStore>,
    session_id: String,
    guidance: String,
) -> Result<DiscussionMetadata, String> {
    let orch_arc = {
        let mut active = manager.active_orchestrators.lock().await;
        if let Some(existing) = active.get(&session_id) {
            existing.clone()
        } else if let Some(ws) = manager.lookup_session_workspace(&session_id) {
            let config_path = Path::new(&ws)
                .join(".flymd")
                .join("discussions")
                .join(&session_id)
                .join("config.json");
            let persisted_config = fs::read(&config_path)
                .ok()
                .and_then(|b| serde_json::from_slice::<DiscussionConfig>(&b).ok())
                .ok_or_else(|| format!("Discussion session config not found: {}", session_id))?;
            let providers =
                build_provider_map(&persisted_config, manager.client.clone(), Some(&store));
            let mut recovered =
                DiscussionOrchestrator::recover(Path::new(&ws), &session_id, providers)?;
            recovered.set_event_listener(Arc::new(TauriDiscussionListener { app: app.clone() }));
            let arc = Arc::new(Mutex::new(recovered));
            active.insert(session_id.clone(), arc.clone());
            arc
        } else {
            return Err(format!("Discussion session not loaded: {}", session_id));
        }
    };

    let (metadata, session_dir) = {
        let mut guard = orch_arc.lock().await;
        guard.inject_user_guidance(&guidance)?;
        (guard.metadata.clone(), guard.session_dir.clone())
    };

    spawn_supervised_discussion_run(
        app,
        manager.active_orchestrators.clone(),
        session_id,
        session_dir,
        orch_arc,
    );

    Ok(metadata)
}

#[tauri::command]
pub fn cmd_get_discussion_transcript(
    workspace_path: String,
    session_id: String,
) -> Result<Vec<DiscussionMessage>, String> {
    let session_dir = Path::new(&workspace_path)
        .join(".flymd")
        .join("discussions")
        .join(&session_id);
    let (transcript, _) = read_transcript_with_recovery(&session_dir)?;
    Ok(transcript)
}

#[tauri::command]
pub async fn cmd_get_discussion_metadata(
    manager: tauri::State<'_, SharedDiscussionManager>,
    workspace_path: String,
    session_id: String,
) -> Result<DiscussionMetadata, String> {
    manager.record_session_workspace(&session_id, &workspace_path);
    let session_dir = Path::new(&workspace_path)
        .join(".flymd")
        .join("discussions")
        .join(&session_id);
    let is_active = {
        let active = manager.active_orchestrators.lock().await;
        active.contains_key(&session_id)
    };
    heal_orphaned_session_on_disk(&session_dir, is_active)
}

#[tauri::command]
pub fn cmd_get_discussion_report(
    workspace_path: String,
    session_id: String,
    version: Option<u32>,
) -> Result<String, String> {
    let session_dir = Path::new(&workspace_path)
        .join(".flymd")
        .join("discussions")
        .join(&session_id);
    let reports_dir = session_dir.join("reports");

    let report_file = if let Some(v) = version {
        reports_dir.join(format!("final-report-v{}.md", v))
    } else {
        reports_dir.join("final-report-latest.md")
    };

    if report_file.exists() {
        fs::read_to_string(&report_file)
            .map_err(|e| format!("Failed to read report {:?}: {}", report_file, e))
    } else {
        Err(format!("Report file not found: {:?}", report_file))
    }
}

#[tauri::command]
pub async fn cmd_list_discussions(
    manager: tauri::State<'_, SharedDiscussionManager>,
    workspace_path: String,
) -> Result<Vec<DiscussionMetadata>, String> {
    let base_dir = Path::new(&workspace_path)
        .join(".flymd")
        .join("discussions");
    if !base_dir.exists() {
        return Ok(Vec::new());
    }

    let active_ids: std::collections::HashSet<String> = {
        let active = manager.active_orchestrators.lock().await;
        active.keys().cloned().collect()
    };

    let mut list = Vec::new();
    if let Ok(entries) = fs::read_dir(&base_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                let sid = p
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or_default()
                    .to_string();
                let is_active = active_ids.contains(&sid);
                if let Ok(meta) = heal_orphaned_session_on_disk(&p, is_active) {
                    manager.record_session_workspace(&meta.session_id, &workspace_path);
                    list.push(meta);
                }
            }
        }
    }

    list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(list)
}

#[tauri::command]
pub async fn cmd_delete_discussion(
    manager: tauri::State<'_, SharedDiscussionManager>,
    workspace_path: String,
    session_id: String,
) -> Result<(), String> {
    // 1. Cancel and remove active orchestrator if present
    {
        let mut active = manager.active_orchestrators.lock().await;
        if let Some(orch_arc) = active.remove(&session_id) {
            let mut guard = orch_arc.lock().await;
            let _ = guard.cancel();
        }
    }

    // 2. Remove session directory from disk
    let session_dir = Path::new(&workspace_path)
        .join(".flymd")
        .join("discussions")
        .join(&session_id);

    if session_dir.exists() {
        let lock_path = session_dir.join(".session.lock");
        if lock_path.exists() {
            let _ = fs::remove_file(&lock_path);
        }

        fs::remove_dir_all(&session_dir)
            .map_err(|e| format!("Failed to delete discussion directory: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn cmd_clear_all_discussions(
    manager: tauri::State<'_, SharedDiscussionManager>,
    workspace_path: String,
) -> Result<usize, String> {
    // 1. Cancel and clear all active orchestrators
    {
        let mut active = manager.active_orchestrators.lock().await;
        for (_, orch_arc) in active.drain() {
            let mut guard = orch_arc.lock().await;
            let _ = guard.cancel();
        }
    }

    // 2. Remove all session directories from disk
    let base_dir = Path::new(&workspace_path)
        .join(".flymd")
        .join("discussions");

    let mut count = 0;
    if base_dir.exists() {
        if let Ok(entries) = fs::read_dir(&base_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let lock_path = path.join(".session.lock");
                    if lock_path.exists() {
                        let _ = fs::remove_file(&lock_path);
                    }
                    if fs::remove_dir_all(&path).is_ok() {
                        count += 1;
                    }
                }
            }
        }
    }

    Ok(count)
}

#[tauri::command]
pub async fn cmd_set_discussion_step_mode(
    manager: tauri::State<'_, SharedDiscussionManager>,
    workspace_path: String,
    session_id: String,
    enabled: bool,
) -> Result<(), String> {
    let active = manager.active_orchestrators.lock().await;
    if let Some(orch_arc) = active.get(&session_id) {
        let mut guard = orch_arc.lock().await;
        guard.set_step_mode(enabled);
        Ok(())
    } else {
        let config_path = Path::new(&workspace_path)
            .join(".flymd")
            .join("discussions")
            .join(&session_id)
            .join("config.json");
        if config_path.exists() {
            let bytes =
                fs::read(&config_path).map_err(|e| format!("Failed to read config.json: {}", e))?;
            let mut config: DiscussionConfig = serde_json::from_slice(&bytes)
                .map_err(|e| format!("Failed to parse config.json: {}", e))?;
            config.step_mode = enabled;
            super::storage::atomic_write_json(&config_path, &config)?;
            Ok(())
        } else {
            Err(format!("Discussion session not found: {}", session_id))
        }
    }
}

#[tauri::command]
pub async fn cmd_dispatch_targeted_action(
    app: AppHandle,
    manager: tauri::State<'_, SharedDiscussionManager>,
    store: tauri::State<'_, crate::store::SharedStore>,
    session_id: String,
    agent_id: String,
    action_name: Option<String>,
    action_query: String,
) -> Result<DiscussionMessage, String> {
    let orch_arc = {
        let mut active = manager.active_orchestrators.lock().await;
        if let Some(existing) = active.get(&session_id) {
            existing.clone()
        } else if let Some(ws) = manager.lookup_session_workspace(&session_id) {
            let config_path = Path::new(&ws)
                .join(".flymd")
                .join("discussions")
                .join(&session_id)
                .join("config.json");
            let persisted_config = fs::read(&config_path)
                .ok()
                .and_then(|b| serde_json::from_slice::<DiscussionConfig>(&b).ok())
                .ok_or_else(|| format!("Discussion session config not found: {}", session_id))?;
            let providers =
                build_provider_map(&persisted_config, manager.client.clone(), Some(&store));
            let mut recovered =
                DiscussionOrchestrator::recover(Path::new(&ws), &session_id, providers)?;
            recovered.set_event_listener(Arc::new(TauriDiscussionListener { app: app.clone() }));
            let arc = Arc::new(Mutex::new(recovered));
            active.insert(session_id.clone(), arc.clone());
            arc
        } else {
            return Err(format!("Discussion session not loaded: {}", session_id));
        }
    };

    let mut guard = orch_arc.lock().await;
    guard
        .dispatch_targeted_action(&agent_id, action_name, action_query)
        .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::discussion::storage::append_transcript_message;
    use crate::discussion::types::{AgentRole, DiscussionMessageKind, DiscussionParticipant};

    #[test]
    fn test_heal_orphaned_session_synthesizes_missing_report_and_transitions_to_review() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_heal_test_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let arabic_topic = "درس في الفيزياء النظرية و التطبيقية".to_string();
        let arabic_idea = "شرح تطور فيزياء الضوء حتى الوصول الى نظرية الكم بطريقة مسلية و تساعد الطلاب في طور الثانوي على فهم الموضوع بشكل سلس و مرح.".to_string();

        let config = DiscussionConfig {
            schema_version: 1,
            session_id: "disc-heal-1".to_string(),
            topic: arabic_topic.clone(),
            user_idea: arabic_idea.clone(),
            workspace_path: temp_dir.to_string_lossy().to_string(),
            max_rounds: 2,
            turn_timeout_secs: 60,
            participants: vec![DiscussionParticipant {
                agent_id: "agent-1".to_string(),
                provider_id: "mock".to_string(),
                model_id: "mock-v1".to_string(),
                display_name: "Teacher".to_string(),
                role: AgentRole::Custom("Teacher".to_string()),
                role_description: "Physics Teacher".to_string(),
                avatar_color: "#38bdf8".to_string(),
                assigned_skill_uris: Vec::new(),
                context_budget_tokens: 16000,
                custom_action: None,
                custom_query: None,
                thinking_enabled: true,
                effort_level: Some("medium".to_string()),
            }],
            active_skill_uris: Vec::new(),
            step_mode: false,
        };
        super::super::storage::atomic_write_json(&temp_dir.join("config.json"), &config).unwrap();

        for r in 1..=2 {
            let msg = DiscussionMessage {
                id: format!("msg-r{}", r),
                session_id: "disc-heal-1".to_string(),
                round_number: r,
                turn_index: 1,
                author_agent_id: "agent-1".to_string(),
                author_role: "custom".to_string(),
                author_provider: "mock".to_string(),
                message_kind: DiscussionMessageKind::InitialAnalysis,
                target_peer_ids: vec![],
                content: format!(
                    "Focus Area / Action: Teacher\n- **Core Focus**: Domain analysis for {}\n",
                    arabic_idea
                ),
                timestamp: now_ms(),
                token_usage: None,
                duration_ms: 500,
                truncated: false,
                thinking_content: None,
                action_name: None,
                model_id: None,
                simulated: true,
                author_display_name: Some("Teacher".to_string()),
            };
            append_transcript_message(&temp_dir, &msg).unwrap();
        }

        // Write stale lock from non-existent PID 99999999 and stuck `Running` metadata
        fs::write(
            temp_dir.join(".session.lock"),
            r#"{"pid":99999999,"timestamp":1,"sessionId":"disc-heal-1"}"#,
        )
        .unwrap();
        let stuck_meta = DiscussionMetadata {
            schema_version: 1,
            session_id: "disc-heal-1".to_string(),
            topic: Some(arabic_topic),
            status: DiscussionStatus::Running,
            current_round: 2,
            created_at: now_ms(),
            started_at: Some(now_ms()),
            updated_at: now_ms(),
            completed_at: None,
            total_messages: 2,
            total_tokens: 900,
            error_message: None,
            active_disagreements_count: 0,
            decisions_count: 0,
            latest_report_version: 0,
        };
        save_metadata(&temp_dir, &stuck_meta).unwrap();

        let healed = heal_orphaned_session_on_disk(&temp_dir, false).unwrap();
        assert_eq!(healed.status, DiscussionStatus::AwaitingReview);
        assert_eq!(healed.latest_report_version, 1);
        assert!(!temp_dir.join(".session.lock").exists());
        assert!(temp_dir
            .join("reports")
            .join("final-report-latest.md")
            .exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
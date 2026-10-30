//! Tauri IPC Command handlers for Multi-Agent Discussion System.

use super::orchestrator::{DiscussionEvent, DiscussionEventListener, DiscussionOrchestrator};
use super::runner::{CliProvider, CliType, DiscussionProvider, HttpProvider, MockProvider};
use super::storage::{load_metadata, read_transcript_with_recovery};
use super::types::{DiscussionConfig, DiscussionMessage, DiscussionMetadata};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

pub type SharedDiscussionManager = Arc<DiscussionManager>;

pub struct DiscussionManager {
    active_orchestrators: Arc<Mutex<HashMap<String, Arc<Mutex<DiscussionOrchestrator>>>>>,
    client: reqwest::Client,
}

impl DiscussionManager {
    pub fn new() -> Self {
        Self {
            active_orchestrators: Arc::new(Mutex::new(HashMap::new())),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(180))
                .build()
                .unwrap_or_default(),
        }
    }
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
        },
        AvailableProviderInfo {
            id: "deepseek".to_string(),
            name: "DeepSeek Reasoning (R1)".to_string(),
            provider_type: "http".to_string(),
            available: deepseek_has_key,
            description: "Native reasoning engine with chain-of-thought tokens.".to_string(),
            default_model: "deepseek-reasoner".to_string(),
            supports_thinking: true,
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
        },
        AvailableProviderInfo {
            id: "claude-code".to_string(),
            name: "Claude Code CLI".to_string(),
            provider_type: "cli".to_string(),
            available: claude_available,
            description: "Anthropic Claude Code CLI in plan/read-only mode.".to_string(),
            default_model: "claude-3-7-sonnet".to_string(),
            supports_thinking: true,
        },
        AvailableProviderInfo {
            id: "gemini-antigravity".to_string(),
            name: "Antigravity Gemini CLI (agy)".to_string(),
            provider_type: "cli".to_string(),
            available: gemini_available,
            description: "Google Antigravity CLI sandbox runner.".to_string(),
            default_model: "gemini-2.5-pro".to_string(),
            supports_thinking: true,
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
    let providers = build_provider_map(&config, manager.client.clone(), Some(&store));

    let mut orchestrator = DiscussionOrchestrator::new(config, providers)?;
    orchestrator.set_event_listener(Arc::new(TauriDiscussionListener { app: app.clone() }));

    let metadata = orchestrator.metadata.clone();
    let orch_arc = Arc::new(Mutex::new(orchestrator));

    {
        let mut active = manager.active_orchestrators.lock().await;
        active.insert(session_id.clone(), orch_arc.clone());
    }

    // Spawn execution loop in background
    tauri::async_runtime::spawn(async move {
        let mut guard = orch_arc.lock().await;
        let _ = guard.run_discussion().await;
    });

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

    let metadata = {
        let guard = orch_arc.lock().await;
        guard.metadata.clone()
    };

    // Spawn resumption in background
    let orch_clone = orch_arc.clone();
    tauri::async_runtime::spawn(async move {
        let mut guard = orch_clone.lock().await;
        let _ = guard.run_discussion().await;
    });

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
    _app: AppHandle,
    manager: tauri::State<'_, SharedDiscussionManager>,
    session_id: String,
    guidance: String,
) -> Result<DiscussionMetadata, String> {
    let orch_arc = {
        let active = manager.active_orchestrators.lock().await;
        active
            .get(&session_id)
            .cloned()
            .ok_or_else(|| format!("Discussion session not loaded: {}", session_id))?
    };

    let metadata = {
        let mut guard = orch_arc.lock().await;
        guard.inject_user_guidance(&guidance)?;
        guard.metadata.clone()
    };

    // Run next round in background
    let orch_clone = orch_arc.clone();
    tauri::async_runtime::spawn(async move {
        let mut guard = orch_clone.lock().await;
        let _ = guard.run_discussion().await;
    });

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
pub fn cmd_get_discussion_metadata(
    workspace_path: String,
    session_id: String,
) -> Result<DiscussionMetadata, String> {
    let session_dir = Path::new(&workspace_path)
        .join(".flymd")
        .join("discussions")
        .join(&session_id);
    load_metadata(&session_dir)
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
pub fn cmd_list_discussions(workspace_path: String) -> Result<Vec<DiscussionMetadata>, String> {
    let base_dir = Path::new(&workspace_path)
        .join(".flymd")
        .join("discussions");
    if !base_dir.exists() {
        return Ok(Vec::new());
    }

    let mut list = Vec::new();
    if let Ok(entries) = fs::read_dir(&base_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                if let Ok(meta) = load_metadata(&entry.path()) {
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
    manager: tauri::State<'_, SharedDiscussionManager>,
    session_id: String,
    agent_id: String,
    action_name: Option<String>,
    action_query: String,
) -> Result<DiscussionMessage, String> {
    let orch_arc = {
        let active = manager.active_orchestrators.lock().await;
        active
            .get(&session_id)
            .cloned()
            .ok_or_else(|| format!("Discussion session not loaded: {}", session_id))?
    };

    let mut guard = orch_arc.lock().await;
    guard
        .dispatch_targeted_action(&agent_id, action_name, action_query)
        .await
}
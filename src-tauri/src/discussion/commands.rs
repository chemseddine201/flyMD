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

fn build_provider_map(
    config: &DiscussionConfig,
    client: reqwest::Client,
) -> HashMap<String, Arc<dyn DiscussionProvider>> {
    let mut map: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
    let session_sandbox = PathBuf::from(&config.workspace_path)
        .join(".flymd")
        .join("discussions")
        .join(&config.session_id)
        .join(".sandbox");

    for p in &config.participants {
        if map.contains_key(&p.provider_id) {
            continue;
        }

        match p.provider_id.as_str() {
            "claude-code" => {
                if let Some(exe) = resolve_executable("claude") {
                    map.insert(
                        p.provider_id.clone(),
                        Arc::new(CliProvider::new(
                            CliType::ClaudeCode,
                            exe,
                            session_sandbox.clone(),
                        )),
                    );
                } else {
                    map.insert(
                        p.provider_id.clone(),
                        Arc::new(MockProvider::new("claude-code")),
                    );
                }
            }
            "gemini-antigravity" => {
                if let Some(exe) = resolve_executable("agy") {
                    map.insert(
                        p.provider_id.clone(),
                        Arc::new(CliProvider::new(
                            CliType::AntigravityGemini,
                            exe,
                            session_sandbox.clone(),
                        )),
                    );
                } else {
                    map.insert(
                        p.provider_id.clone(),
                        Arc::new(MockProvider::new("gemini-antigravity")),
                    );
                }
            }
            "mock" => {
                map.insert(p.provider_id.clone(), Arc::new(MockProvider::new("mock")));
            }
            "http-llm" | "ollama" | "deepseek" | "kimi" => {
                let is_ollama = p.provider_id == "ollama";
                let endpoint = if is_ollama {
                    "http://127.0.0.1:11434"
                } else {
                    "https://api.openai.com/v1"
                };
                map.insert(
                    p.provider_id.clone(),
                    Arc::new(HttpProvider::new(
                        &p.provider_id,
                        client.clone(),
                        endpoint,
                        None,
                        &p.model_id,
                        is_ollama,
                    )),
                );
            }
            _ => {
                map.insert(
                    p.provider_id.clone(),
                    Arc::new(MockProvider::new(&p.provider_id)),
                );
            }
        }
    }

    map
}

#[tauri::command]
pub async fn cmd_start_discussion(
    app: AppHandle,
    manager: tauri::State<'_, SharedDiscussionManager>,
    config: DiscussionConfig,
) -> Result<DiscussionMetadata, String> {
    let session_id = config.session_id.clone();
    let providers = build_provider_map(&config, manager.client.clone());

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
    session_id: String,
    workspace_path: String,
) -> Result<DiscussionMetadata, String> {
    let orch_arc = {
        let mut active = manager.active_orchestrators.lock().await;
        if let Some(existing) = active.get(&session_id) {
            existing.clone()
        } else {
            // Recover from disk
            let base_config = DiscussionConfig {
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
            };
            let providers = build_provider_map(&base_config, manager.client.clone());
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

//! Discussion lifecycle supervisor, background runtime manager, and crash-recovery healer.

use super::orchestrator::{DiscussionEvent, DiscussionEventListener, DiscussionOrchestrator};
use super::report::ReportGenerator;
use super::storage::{
    has_live_external_lock, load_metadata, read_transcript_with_recovery, save_metadata,
};
use super::types::{now_ms, DiscussionConfig, DiscussionMetadata, DiscussionStatus};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

pub type SharedDiscussionManager = Arc<DiscussionManager>;

#[derive(Clone)]
pub struct SessionControls {
    pub pause_flag: Arc<std::sync::atomic::AtomicBool>,
    pub cancel_flag: Arc<std::sync::atomic::AtomicBool>,
    pub workspace_path: String,
}

pub struct DiscussionManager {
    pub active_orchestrators: Arc<Mutex<HashMap<String, Arc<Mutex<DiscussionOrchestrator>>>>>,
    pub session_controls: Arc<std::sync::Mutex<HashMap<String, SessionControls>>>,
    pub session_workspaces: Arc<std::sync::Mutex<HashMap<String, String>>>,
    pub client: reqwest::Client,
}

impl DiscussionManager {
    pub fn new() -> Self {
        Self {
            active_orchestrators: Arc::new(Mutex::new(HashMap::new())),
            session_controls: Arc::new(std::sync::Mutex::new(HashMap::new())),
            session_workspaces: Arc::new(std::sync::Mutex::new(HashMap::new())),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(180))
                .build()
                .unwrap_or_default(),
        }
    }

    pub fn register_session_controls(
        &self,
        session_id: &str,
        pause_flag: Arc<std::sync::atomic::AtomicBool>,
        cancel_flag: Arc<std::sync::atomic::AtomicBool>,
        workspace_path: &str,
    ) {
        let mut map = self
            .session_controls
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        map.insert(
            session_id.to_string(),
            SessionControls {
                pause_flag,
                cancel_flag,
                workspace_path: workspace_path.to_string(),
            },
        );
    }

    pub fn unregister_session_controls(&self, session_id: &str) {
        let mut map = self
            .session_controls
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        map.remove(session_id);
    }

    pub fn lookup_session_controls(&self, session_id: &str) -> Option<SessionControls> {
        let map = self
            .session_controls
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        map.get(session_id).cloned()
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

impl Default for DiscussionManager {
    fn default() -> Self {
        Self::new()
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
pub fn spawn_supervised_discussion_run(
    app: AppHandle,
    active_map: Arc<Mutex<HashMap<String, Arc<Mutex<DiscussionOrchestrator>>>>>,
    controls_map: Arc<std::sync::Mutex<HashMap<String, SessionControls>>>,
    session_id: String,
    session_dir: PathBuf,
    orch_arc: Arc<Mutex<DiscussionOrchestrator>>,
) {
    let clean_controls = {
        let controls = controls_map.clone();
        let sid = session_id.clone();
        move || {
            if let Ok(mut c) = controls.lock() {
                c.remove(&sid);
            }
        }
    };

    tauri::async_runtime::spawn(async move {
        let inner_orch = orch_arc.clone();
        let join_res = tokio::spawn(async move {
            let mut guard = inner_orch.lock().await;
            guard.run_discussion().await
        })
        .await;

        clean_controls();

        match join_res {
            Ok(Ok(final_status)) => {
                // If the discussion reached a terminal state (not Paused and not Running),
                // remove it from active_map to release memory and allow clean disk reconciliation.
                if final_status != DiscussionStatus::Running && final_status != DiscussionStatus::Paused {
                    let mut active = active_map.lock().await;
                    active.remove(&session_id);
                }
                let status_evt = DiscussionEvent::StatusChanged {
                    session_id,
                    new_status: final_status,
                };
                app.emit("discussion:event", &status_evt).ok();
            }
            Ok(Err(run_err)) => {
                eprintln!(
                    "[DiscussionSupervisor] Discussion '{}' returned error: {}",
                    session_id, run_err
                );
                let lock_path = session_dir.join(".session.lock");
                let _ = fs::remove_file(&lock_path);
                if let Ok(mut meta) = load_metadata(&session_dir) {
                    meta.status = DiscussionStatus::Failed;
                    meta.error_message = Some(run_err);
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
            Err(join_err) => {
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

            if meta.converged_at_round.is_some()
                || (meta.current_round >= config.max_rounds && final_round_msgs >= active_count)
            {
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

pub struct TauriDiscussionListener {
    pub app: AppHandle,
}

impl DiscussionEventListener for TauriDiscussionListener {
    fn on_event(&self, event: DiscussionEvent) {
        self.app.emit("discussion:event", &event).ok();
    }
}


//! Tauri IPC Command handlers for Multi-Agent Discussion System.

use super::manager::{
    heal_orphaned_session_on_disk, spawn_supervised_discussion_run, SharedDiscussionManager,
    TauriDiscussionListener,
};
use super::orchestrator::DiscussionOrchestrator;
use super::provider_registry::{
    build_provider_map, detect_available_providers, AvailableProviderInfo,
};
use super::skills::{SkillDescriptor, SkillsManager};
use super::storage::read_transcript_with_recovery;
use super::types::{DiscussionConfig, DiscussionMessage, DiscussionMetadata};
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::Mutex;

#[tauri::command]
pub fn cmd_get_available_providers(
    store: tauri::State<'_, crate::store::SharedStore>,
) -> Vec<AvailableProviderInfo> {
    detect_available_providers(&store)
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
                    custom_skills_dir: None,
                    include_default_skills: true,
                    token_budget_cap: None,
                    ..Default::default()
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

    list.sort_by_key(|a| std::cmp::Reverse(a.created_at));
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

#[tauri::command]
pub fn cmd_scan_custom_skills_dir(path: String) -> Result<Vec<SkillDescriptor>, String> {
    let p = Path::new(&path);
    if !p.exists() || !p.is_dir() {
        return Err(format!(
            "Custom skills directory not found or is not a directory: {}",
            path
        ));
    }
    let mut mgr = SkillsManager::new();
    let discovered = mgr.discover_custom_skills(p, None);
    Ok(discovered)
}

#[tauri::command]
pub fn cmd_get_available_skills(
    workspace_path: String,
    custom_skills_dir: Option<String>,
    include_default_skills: Option<bool>,
) -> Result<Vec<SkillDescriptor>, String> {
    let mut mgr = SkillsManager::new();
    let skills = mgr.discover_all_skills(
        &workspace_path,
        custom_skills_dir.as_deref(),
        include_default_skills.unwrap_or(true),
    );
    Ok(skills)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::discussion::storage::append_transcript_message;
    use crate::discussion::types::{
        now_ms, AgentRole, DiscussionMessageKind, DiscussionParticipant, DiscussionStatus,
    };

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
            custom_skills_dir: None,
            include_default_skills: true,
            token_budget_cap: None,
            ..Default::default()
        };
        crate::discussion::storage::atomic_write_json(&temp_dir.join("config.json"), &config).unwrap();

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
            ..Default::default()
        };
        crate::discussion::storage::save_metadata(&temp_dir, &stuck_meta).unwrap();

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

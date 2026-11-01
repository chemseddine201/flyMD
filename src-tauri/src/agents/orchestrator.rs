//! `AgentOrchestrator`: coordinates agent discovery, credentials, checkpoints, and task lifecycle.

use super::auth_launcher::{launch_cli_login_terminal, launch_web_auth_browser};
use super::handoff_prompt::{
    assemble_task_handoff_package, prepare_parallel_worktree, resolve_effective_workspace,
};
use super::process_manager::ProcessTreeManager;
use super::types::{
    now_ms, AgentCheckpoint, AgentCredentialConfig, AgentProfile, AgentTaskRecord,
    AgentTaskRequest, AgentToolAction,
};
use super::{checkpoint, discovery, runner};
use crate::store::SharedStore;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

pub struct AgentOrchestrator {
    pub(crate) store: SharedStore,
    pub(crate) app_handle: AppHandle,
    pub(crate) cancel_flags: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
    pub process_manager: ProcessTreeManager,
}

pub type SharedAgentOrchestrator = Arc<AgentOrchestrator>;

impl AgentOrchestrator {
    pub fn new(app_handle: AppHandle, store: SharedStore) -> SharedAgentOrchestrator {
        Arc::new(AgentOrchestrator {
            store,
            app_handle,
            cancel_flags: Arc::new(Mutex::new(HashMap::new())),
            process_manager: ProcessTreeManager::new(),
        })
    }

    pub fn discover_agents(&self) -> Vec<AgentProfile> {
        let creds = self.store.get_agent_credentials();
        discovery::discover_agent_profiles(&creds)
    }

    pub fn remove_agent_profile(&self, agent_id: &str) -> Vec<AgentProfile> {
        self.store.remove_agent_credential(agent_id);
        let updated = self.discover_agents();
        self.app_handle
            .emit("agent:profiles-updated", &updated)
            .ok();
        updated
    }

    pub fn save_agent_credential(
        &self,
        agent_id: &str,
        cred: AgentCredentialConfig,
    ) -> Vec<AgentProfile> {
        self.store.set_agent_credential(agent_id, cred);
        let updated = self.discover_agents();
        self.app_handle
            .emit("agent:profiles-updated", &updated)
            .ok();
        updated
    }

    pub fn launch_agent_login(&self, agent_id: &str) -> Result<String, String> {
        let profiles = self.discover_agents();
        let profile = profiles
            .iter()
            .find(|p| p.id == agent_id)
            .ok_or_else(|| format!("Unknown agent: {}", agent_id))?;

        launch_cli_login_terminal(profile, agent_id)?;

        let mut creds = self.store.get_agent_credentials();
        let mut entry = creds.remove(agent_id).unwrap_or_default();
        entry.oauth_verified = true;
        if entry.connected_account_label.is_none() {
            entry.connected_account_label =
                Some(format!("{} Official Session", profile.short_name));
        }
        self.store.set_agent_credential(agent_id, entry);

        let updated = self.discover_agents();
        self.app_handle
            .emit("agent:profiles-updated", &updated)
            .ok();

        Ok(format!("Opened CLI login terminal for {}", profile.name))
    }

    pub fn launch_agent_web_auth(
        &self,
        agent_id: &str,
        task_prompt: Option<String>,
        _task_id: Option<String>,
        _report_path: Option<String>,
    ) -> Result<String, String> {
        let profiles = self.discover_agents();
        let profile = profiles
            .iter()
            .find(|p| p.id == agent_id)
            .ok_or_else(|| format!("Unknown agent: {}", agent_id))?
            .clone();

        let target_url = launch_web_auth_browser(&profile, task_prompt.as_deref())?;

        let mut creds = self.store.get_agent_credentials();
        let mut entry = creds.remove(agent_id).unwrap_or_default();
        entry.web_session_verified = true;
        if entry.connected_account_label.is_none() {
            entry.connected_account_label = Some(format!(
                "{} Browser Session (Free Tier)",
                profile.short_name
            ));
        }
        self.store.set_agent_credential(agent_id, entry);
        let updated_profiles = self.discover_agents();
        self.app_handle
            .emit("agent:profiles-updated", &updated_profiles)
            .ok();

        Ok(if task_prompt.is_some() {
            format!(
                "Opened {} in your default browser and copied the Markdown task prompt to your clipboard (Press Ctrl+V in the chat)!",
                profile.name
            )
        } else {
            format!(
                "Opened {} ({}) in your system default browser!",
                profile.name, target_url
            )
        })
    }

    pub fn complete_web_task_with_reply(
        &self,
        task_id: &str,
        reply_markdown: &str,
    ) -> Result<AgentTaskRecord, String> {
        let mut report_meta: Option<(Option<String>, String)> = None;
        let all_tasks = self
            .store
            .mutate_agent_task(task_id, true, true, |t| {
                let formatted_report = format!(
                    "# {} Response Report — `{}`\n\n{}\n",
                    t.target_agent_id.to_uppercase(),
                    t.file_name,
                    reply_markdown.trim()
                );
                report_meta = Some((t.output_report_path.clone(), formatted_report.clone()));
                t.status = "completed".to_string();
                t.completed_at = Some(now_ms());
                t.progress_stage = Some("completed".to_string());
                t.progress_percent = 100;
                t.response_markdown = Some(formatted_report);
                if t.checklist_total > 0 {
                    t.checklist_completed = t.checklist_total;
                }
                t.logs.push(
                    "[In-App Studio] Attached external agent Markdown reply and updated report."
                        .to_string(),
                );
            })
            .flatten()
            .ok_or_else(|| format!("Task not found: {}", task_id))?;

        if let Some((Some(r_path), formatted_report)) = report_meta {
            if let Some(parent) = Path::new(&r_path).parent() {
                fs::create_dir_all(parent).ok();
            }
            fs::write(&r_path, &formatted_report).ok();
        }

        self.app_handle.emit("agent:tasks-updated", &all_tasks).ok();

        all_tasks
            .into_iter()
            .find(|t| t.id == task_id)
            .ok_or_else(|| format!("Task not found after update: {}", task_id))
    }

    pub fn create_safety_checkpoint(
        &self,
        task_id: &str,
        agent_id: &str,
        workspace_path: &str,
        target_file_path: &str,
    ) -> Option<AgentCheckpoint> {
        checkpoint::create_safety_checkpoint(
            &self.store,
            &self.app_handle,
            task_id,
            agent_id,
            workspace_path,
            target_file_path,
        )
    }

    pub fn restore_checkpoint(&self, checkpoint_id: &str) -> Result<String, String> {
        checkpoint::restore_checkpoint(&self.store, &self.app_handle, checkpoint_id)
    }

    pub fn dispatch_task(&self, req: AgentTaskRequest) -> Result<AgentTaskRecord, String> {
        let task_id = format!("task-{}", now_ms());
        let effective_ws = resolve_effective_workspace(&req);

        let ws_path = Path::new(&effective_ws);
        let flymd_dir = ws_path.join(".flymd");
        let handoffs_dir = flymd_dir.join("handoffs");
        let reports_dir = flymd_dir.join("reports");
        fs::create_dir_all(&handoffs_dir).ok();
        fs::create_dir_all(&reports_dir).ok();

        let checkpoint = if req.create_safety_checkpoint {
            self.create_safety_checkpoint(
                &task_id,
                &req.target_agent_id,
                &effective_ws,
                &req.file_path,
            )
        } else {
            None
        };

        let worktree_path = if req.safe_parallel_mode {
            prepare_parallel_worktree(&flymd_dir, ws_path, &req.target_agent_id, &task_id)
        } else {
            None
        };

        let handoff_file = handoffs_dir.join(format!("{}-{}.md", task_id, req.target_agent_id));
        let report_file =
            reports_dir.join(format!("report-{}-{}.md", task_id, req.target_agent_id));

        let existing_tasks = self.store.get_agent_tasks();
        let pkg = assemble_task_handoff_package(&req, &effective_ws, &existing_tasks);
        fs::write(&handoff_file, &pkg.handoff_content).ok();

        let record = AgentTaskRecord {
            id: task_id.clone(),
            target_agent_id: req.target_agent_id.clone(),
            source_agent_id: req.source_agent_id.clone(),
            file_path: req.file_path.clone(),
            file_name: req.file_name.clone(),
            intent: req.intent.clone(),
            custom_prompt: req.custom_prompt.clone(),
            workspace_path: effective_ws.clone(),
            worktree_path,
            checkpoint_id: checkpoint.map(|c| c.id),
            handoff_file_path: Some(handoff_file.to_string_lossy().to_string()),
            output_report_path: Some(report_file.to_string_lossy().to_string()),
            status: "running".to_string(),
            created_at: now_ms(),
            started_at: Some(now_ms()),
            completed_at: None,
            logs: vec![
                format!(
                    "[FlyMD Studio] Created Handoff Package: {}",
                    handoff_file.to_string_lossy()
                ),
                format!(
                    "[FlyMD Studio] Assigned Agent: {} | Mode: {}",
                    req.target_agent_id, req.intent
                ),
                pkg.epistemic_log_line.clone(),
            ],
            checklist_total: pkg.total_checklists,
            checklist_completed: pkg.completed_checklists,
            error: None,
            pipeline_id: req.pipeline_id.clone(),
            next_agent_in_chain: req.next_agent_in_chain.clone(),
            next_intent_in_chain: req.next_intent_in_chain.clone(),
            response_markdown: None,
            thinking_trace: vec![
                format!(
                    "Created task handoff specification for {} in `{}`",
                    req.target_agent_id, req.file_name
                ),
                pkg.epistemic_log_line,
            ],
            progress_stage: Some("snapshot".to_string()),
            progress_percent: 20,
            tool_actions: vec![AgentToolAction::new(
                format!("tool-init-{}", now_ms()),
                "handoff".to_string(),
                format!("Prepared Handoff Package `{}`", req.file_name),
                Some(handoff_file.to_string_lossy().to_string()),
                "done".to_string(),
                now_ms(),
            )],
            custom_action_id: req.custom_action_label.clone(),
            step_note: req.step_note.clone(),
            verification_report: None,
            outcome_reason: None,
            attempt_count: req.attempt_count,
            error_diagnostic: None,
            cli_session_id: pkg.resolved_resume_session_id,
            modified_files: Vec::new(),
            effort_level: req
                .effort_level
                .clone()
                .or_else(|| Some("medium".to_string())),
            thinking_enabled: req.thinking_enabled.or(Some(true)),
            model_id: req.model_id.clone(),
        };

        let memory_entry = format!(
            "### [{}] Task `{}` ({}) — Dispatched\n- **Agent**: `{}`\n- **File**: `{}`\n- **Intent**: `{}`\n- **Handoff**: `{}`\n",
            now_ms(),
            task_id,
            req.intent,
            req.target_agent_id,
            req.file_name,
            req.intent,
            handoff_file.to_string_lossy()
        );
        checkpoint::append_project_memory(&effective_ws, &memory_entry);

        let mut tasks = existing_tasks;
        tasks.insert(0, record.clone());
        self.store.save_agent_tasks(tasks.clone());
        self.app_handle.emit("agent:tasks-updated", &tasks).ok();

        if req.execution_mode.as_deref() == Some("web") {
            let web_prompt = format!(
                "# FlyMD Assigned Mission ({})\n\n{}\n\n---\n\n## Source Markdown Document (`{}`)\n\n{}",
                req.intent.to_uppercase(),
                pkg.instructions,
                req.file_name,
                pkg.body_to_process
            );
            let _ = self.launch_agent_web_auth(
                &req.target_agent_id,
                Some(web_prompt),
                Some(task_id.clone()),
                Some(report_file.to_string_lossy().to_string()),
            );
        }

        let store_arc = Arc::clone(&self.store);
        let app_handle = self.app_handle.clone();
        let cancel_flag = Arc::new(AtomicBool::new(false));
        {
            let mut flags = self.cancel_flags.lock().unwrap_or_else(|e| e.into_inner());
            flags.insert(task_id.clone(), Arc::clone(&cancel_flag));
        }

        runner::spawn_agent_execution(
            store_arc,
            app_handle,
            record.clone(),
            handoff_file,
            report_file,
            pkg.instructions,
            pkg.body_to_process,
            cancel_flag,
            self.process_manager.clone(),
        );

        Ok(record)
    }

    pub fn cancel_task(&self, task_id: &str) -> Vec<AgentTaskRecord> {
        if let Some(flag) = self
            .cancel_flags
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(task_id)
        {
            flag.store(true, Ordering::Relaxed);
        }
        self.process_manager.terminate_task_tree(task_id);
        runner::finalize_task(&self.store, &self.app_handle, task_id, "cancelled", None);
        self.store.get_agent_tasks()
    }

    pub fn clear_completed_tasks(&self) -> Vec<AgentTaskRecord> {
        let mut tasks = self.store.get_agent_tasks();
        let running_ids: HashSet<String> = tasks
            .iter()
            .filter(|t| t.status == "running" || t.status == "queued")
            .map(|t| t.id.clone())
            .collect();
        {
            let mut flags = self.cancel_flags.lock().unwrap_or_else(|e| e.into_inner());
            flags.retain(|id, _| running_ids.contains(id));
        }
        tasks.retain(|t| t.status == "running" || t.status == "queued");
        self.store.save_agent_tasks(tasks.clone());
        self.app_handle.emit("agent:tasks-updated", &tasks).ok();
        tasks
    }

    pub fn clear_task_logs(&self, task_id: &str) -> Vec<AgentTaskRecord> {
        if let Some(Some(tasks)) = self.store.mutate_agent_task(task_id, true, true, |t| {
            t.logs.clear();
        }) {
            self.app_handle.emit("agent:tasks-updated", &tasks).ok();
            tasks
        } else {
            self.store.get_agent_tasks()
        }
    }

    pub fn delete_task(&self, task_id: &str) -> Vec<AgentTaskRecord> {
        if let Some(flag) = self
            .cancel_flags
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(task_id)
        {
            flag.store(true, Ordering::Relaxed);
        }
        self.process_manager.terminate_task_tree(task_id);
        let mut tasks = self.store.get_agent_tasks();
        tasks.retain(|t| t.id != task_id);
        self.store.save_agent_tasks(tasks.clone());
        self.app_handle.emit("agent:tasks-updated", &tasks).ok();
        tasks
    }
}

//! Multi-Agent Studio & Autonomous Supervisor orchestration subsystem.
//!
//! Organized into clear submodules:
//! - `types`: Core data models and serialization structs
//! - `discovery`: System binary detection and agent credentials
//! - `runner`: Subprocess CLI execution and markdown streaming synthesis
//! - `checkpoint`: Safety restore points and project memory ledger
//! - `commands`: Tauri IPC command endpoints

pub mod checkpoint;
pub mod commands;
pub mod discovery;
pub mod runner;
pub mod types;

pub use checkpoint::*;
pub use commands::*;
pub use discovery::*;
pub use runner::*;
pub use types::*;

use crate::store::SharedStore;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

pub struct AgentOrchestrator {
    pub(crate) store: SharedStore,
    pub(crate) app_handle: AppHandle,
    pub(crate) cancel_flags: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

pub type SharedAgentOrchestrator = Arc<AgentOrchestrator>;

impl AgentOrchestrator {
    pub fn new(app_handle: AppHandle, store: SharedStore) -> SharedAgentOrchestrator {
        Arc::new(AgentOrchestrator {
            store,
            app_handle,
            cancel_flags: Arc::new(Mutex::new(HashMap::new())),
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

        let login_cmd = profile
            .login_command
            .clone()
            .or_else(|| profile.detected_binary_path.clone())
            .unwrap_or_else(|| {
                profile
                    .binary_names
                    .first()
                    .cloned()
                    .unwrap_or_else(|| profile.id.clone())
            });

        let bin_name = login_cmd
            .split_whitespace()
            .next()
            .unwrap_or(&login_cmd)
            .to_string();

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NEW_CONSOLE: u32 = 0x00000010;

            let safe_id: String = agent_id
                .chars()
                .map(|c| {
                    if c.is_alphanumeric() || c == '-' {
                        c
                    } else {
                        '_'
                    }
                })
                .collect();
            let bat_path = std::env::temp_dir().join(format!("flymd-cli-login-{}.cmd", safe_id));
            let web_fallback = profile
                .web_url
                .clone()
                .unwrap_or_else(|| "https://claude.ai".to_string());

            let bat_content = format!(
                "@echo off\r\n\
                title FlyMD CLI Login - {name}\r\n\
                color 0B\r\n\
                echo ============================================================\r\n\
                echo   FlyMD Multi-Agent Supervisor - Official CLI Login\r\n\
                echo   Agent:   {name} ({vendor})\r\n\
                echo   Command: {cmd}\r\n\
                echo ============================================================\r\n\
                echo.\r\n\
                where \"{bin}\" >nul 2>nul\r\n\
                if %ERRORLEVEL% NEQ 0 (\r\n\
                    if not exist \"{bin}\" (\r\n\
                        color 0E\r\n\
                        echo [Notice] The CLI tool \"{bin}\" was not found on your system PATH.\r\n\
                        echo.\r\n\
                        echo You do NOT need the CLI tool to use {name} with FlyMD!\r\n\
                        echo Opening {name} in your default web browser ({url}) so you can sign in for free...\r\n\
                        echo.\r\n\
                        rundll32.exe url.dll,FileProtocolHandler \"{url}\"\r\n\
                        pause\r\n\
                        exit /b 0\r\n\
                    )\r\n\
                )\r\n\
                echo Running: {cmd}\r\n\
                echo.\r\n\
                call {cmd}\r\n\
                echo.\r\n\
                echo [FlyMD] CLI Login session finished.\r\n\
                pause\r\n",
                name = profile.name,
                vendor = profile.vendor,
                cmd = login_cmd,
                bin = bin_name,
                url = web_fallback
            );

            fs::write(&bat_path, bat_content)
                .map_err(|e| format!("Failed to prepare CLI login script: {}", e))?;

            Command::new("cmd.exe")
                .args(["/C", &bat_path.to_string_lossy()])
                .creation_flags(CREATE_NEW_CONSOLE)
                .spawn()
                .map_err(|e| format!("Failed to launch CLI login terminal: {}", e))?;
        }

        #[cfg(target_os = "macos")]
        {
            Command::new("osascript")
                .args([
                    "-e",
                    &format!(
                        "tell application \"Terminal\" to do script \"{}\"",
                        login_cmd
                    ),
                ])
                .spawn()
                .map_err(|e| format!("Failed to launch Terminal: {}", e))?;
        }

        #[cfg(all(unix, not(target_os = "macos")))]
        {
            Command::new("sh")
                .args(["-c", &login_cmd])
                .spawn()
                .map_err(|e| format!("Failed to launch login command: {}", e))?;
        }

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

        let target_url = profile
            .web_url
            .clone()
            .filter(|u| !u.trim().is_empty())
            .unwrap_or_else(|| "https://claude.ai/new".to_string());

        if let Some(ref prompt_text) = task_prompt {
            if !prompt_text.trim().is_empty() {
                #[cfg(target_os = "windows")]
                {
                    use std::io::Write;
                    use std::os::windows::process::CommandExt;
                    const CREATE_NO_WINDOW: u32 = 0x08000000;
                    if let Ok(mut child) = Command::new("clip.exe")
                        .stdin(Stdio::piped())
                        .creation_flags(CREATE_NO_WINDOW)
                        .spawn()
                    {
                        if let Some(mut stdin) = child.stdin.take() {
                            let _ = stdin.write_all(prompt_text.as_bytes());
                        }
                        let _ = child.wait();
                    }
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            Command::new("rundll32.exe")
                .args(["url.dll,FileProtocolHandler", &target_url])
                .spawn()
                .or_else(|_| Command::new("explorer.exe").arg(&target_url).spawn())
                .map_err(|e| format!("Failed to open system default browser: {}", e))?;
        }

        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg(&target_url)
                .spawn()
                .map_err(|e| format!("Failed to open default browser: {}", e))?;
        }

        #[cfg(all(unix, not(target_os = "macos")))]
        {
            Command::new("xdg-open")
                .arg(&target_url)
                .spawn()
                .map_err(|e| format!("Failed to open default browser: {}", e))?;
        }

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
        let mut tasks = self.store.get_agent_tasks();
        let idx = tasks
            .iter()
            .position(|t| t.id == task_id)
            .ok_or_else(|| format!("Task not found: {}", task_id))?;

        let agent_id = tasks[idx].target_agent_id.clone();
        let file_name = tasks[idx].file_name.clone();
        let report_path = tasks[idx].output_report_path.clone();

        let formatted_report = format!(
            "# {} Response Report — `{}`\n\n\
            {}\n",
            agent_id.to_uppercase(),
            file_name,
            reply_markdown.trim()
        );

        if let Some(ref r_path) = report_path {
            if let Some(parent) = Path::new(r_path).parent() {
                fs::create_dir_all(parent).ok();
            }
            fs::write(r_path, &formatted_report).ok();
        }

        tasks[idx].status = "completed".to_string();
        tasks[idx].completed_at = Some(now_ms());
        tasks[idx].progress_stage = Some("completed".to_string());
        tasks[idx].progress_percent = 100;
        tasks[idx].response_markdown = Some(formatted_report.clone());
        if tasks[idx].checklist_total > 0 {
            tasks[idx].checklist_completed = tasks[idx].checklist_total;
        }
        tasks[idx].logs.push(
            "[In-App Studio] Attached external agent Markdown reply and updated report."
                .to_string(),
        );

        let updated_record = tasks[idx].clone();
        self.store.save_agent_tasks(tasks.clone());
        self.app_handle.emit("agent:tasks-updated", &tasks).ok();

        Ok(updated_record)
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
        let effective_ws =
            if !req.workspace_path.trim().is_empty() && Path::new(&req.workspace_path).exists() {
                req.workspace_path.clone()
            } else if !req.file_path.trim().is_empty() {
                Path::new(&req.file_path)
                    .parent()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|| ".".to_string())
            } else {
                std::env::current_dir()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|_| ".".to_string())
            };

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
            let wt_dir = flymd_dir.join("worktrees").join(&task_id);
            fs::create_dir_all(&wt_dir).ok();
            let branch_name = format!("flymd/{}-{}", req.target_agent_id, task_id);
            let _ = Command::new("git")
                .args([
                    "worktree",
                    "add",
                    "-B",
                    &branch_name,
                    &wt_dir.to_string_lossy(),
                ])
                .current_dir(ws_path)
                .output();
            Some(wt_dir.to_string_lossy().to_string())
        } else {
            None
        };

        let handoff_file = handoffs_dir.join(format!("{}-{}.md", task_id, req.target_agent_id));
        let report_file =
            reports_dir.join(format!("report-{}-{}.md", task_id, req.target_agent_id));

        let instructions = runner::intent_instructions(&req.intent, req.custom_prompt.as_deref());
        let shared_memory = if req.attach_shared_memory {
            checkpoint::read_project_memory(&effective_ws)
        } else {
            String::new()
        };

        let body_to_process = if let Some(ref items) = req.selected_checklist_items {
            if !items.is_empty() {
                let mut s = String::from("### Assigned Checklist Steps:\n");
                for item in items {
                    s.push_str(&format!("- [ ] {}\n", item));
                }
                s.push_str("\n---\n### Full Reference Document:\n");
                s.push_str(&req.markdown_content);
                s
            } else {
                req.selected_excerpt
                    .clone()
                    .unwrap_or(req.markdown_content.clone())
            }
        } else {
            req.selected_excerpt
                .clone()
                .unwrap_or(req.markdown_content.clone())
        };

        let mut handoff_content = format!(
            "# FlyMD Agent Task Package — `{}`\n\n\
            > **Target Agent**: `{}`\n\
            > **Source Agent**: `{}`\n\
            > **Intent Mode**: `{}`\n\
            > **Workspace Path**: `{}`\n\
            > **Source File**: `{}`\n\
            > **Timestamp**: `{}`\n\n\
            ---\n\n\
            ## Mission Instructions\n\n{}\n\n",
            req.file_name,
            req.target_agent_id,
            req.source_agent_id.as_deref().unwrap_or("User"),
            req.intent,
            effective_ws,
            req.file_path,
            now_ms(),
            instructions
        );

        if !shared_memory.is_empty() {
            handoff_content.push_str("## Shared Project Memory Context\n\n");
            handoff_content.push_str(&shared_memory);
            handoff_content.push_str("\n\n---\n\n");
        }

        handoff_content.push_str("## Source Specification / Document Content\n\n");
        handoff_content.push_str(&body_to_process);
        handoff_content.push('\n');

        fs::write(&handoff_file, &handoff_content).ok();

        let (total_checklists, completed_checklists) =
            types::count_markdown_checklists(&body_to_process);

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
            ],
            checklist_total: total_checklists,
            checklist_completed: completed_checklists,
            error: None,
            pipeline_id: req.pipeline_id.clone(),
            next_agent_in_chain: req.next_agent_in_chain.clone(),
            next_intent_in_chain: req.next_intent_in_chain.clone(),
            response_markdown: None,
            thinking_trace: vec![format!(
                "Created task handoff specification for {} in `{}`",
                req.target_agent_id, req.file_name
            )],
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

        let mut tasks = self.store.get_agent_tasks();
        tasks.insert(0, record.clone());
        self.store.save_agent_tasks(tasks.clone());
        self.app_handle.emit("agent:tasks-updated", &tasks).ok();

        // If execution mode is "web", launch default browser with prompt in clipboard
        if req.execution_mode.as_deref() == Some("web") {
            let web_prompt = format!(
                "# FlyMD Assigned Mission ({})\n\n{}\n\n---\n\n## Source Markdown Document (`{}`)\n\n{}",
                req.intent.to_uppercase(),
                instructions,
                req.file_name,
                body_to_process
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
            let mut flags = self.cancel_flags.lock().unwrap();
            flags.insert(task_id.clone(), Arc::clone(&cancel_flag));
        }

        runner::spawn_agent_execution(
            store_arc,
            app_handle,
            record.clone(),
            handoff_file,
            report_file,
            instructions,
            body_to_process,
            cancel_flag,
        );

        Ok(record)
    }

    pub fn cancel_task(&self, task_id: &str) -> Vec<AgentTaskRecord> {
        if let Some(flag) = self.cancel_flags.lock().unwrap().get(task_id) {
            flag.store(true, Ordering::Relaxed);
        }
        runner::finalize_task(&self.store, &self.app_handle, task_id, "cancelled", None);
        self.store.get_agent_tasks()
    }

    pub fn clear_completed_tasks(&self) -> Vec<AgentTaskRecord> {
        let mut tasks = self.store.get_agent_tasks();
        tasks.retain(|t| t.status == "running" || t.status == "queued");
        self.store.save_agent_tasks(tasks.clone());
        self.app_handle.emit("agent:tasks-updated", &tasks).ok();
        tasks
    }

    pub fn clear_task_logs(&self, task_id: &str) -> Vec<AgentTaskRecord> {
        let mut tasks = self.store.get_agent_tasks();
        if let Some(t) = tasks.iter_mut().find(|t| t.id == task_id) {
            t.logs.clear();
        }
        self.store.save_agent_tasks(tasks.clone());
        self.app_handle.emit("agent:tasks-updated", &tasks).ok();
        tasks
    }

    pub fn delete_task(&self, task_id: &str) -> Vec<AgentTaskRecord> {
        if let Some(flag) = self.cancel_flags.lock().unwrap().get(task_id) {
            flag.store(true, Ordering::Relaxed);
        }
        let mut tasks = self.store.get_agent_tasks();
        tasks.retain(|t| t.id != task_id);
        self.store.save_agent_tasks(tasks.clone());
        self.app_handle.emit("agent:tasks-updated", &tasks).ok();
        tasks
    }
}

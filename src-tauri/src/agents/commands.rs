//! Tauri IPC Command endpoints for Agent operations.

use super::types::{
    AgentCheckpoint, AgentCredentialConfig, AgentProfile, AgentTaskRecord, AgentTaskRequest,
};
use super::SharedAgentOrchestrator;
use crate::store::SharedStore;
use std::collections::HashMap;

#[tauri::command]
pub fn cmd_discover_agents(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
) -> Vec<AgentProfile> {
    orchestrator.discover_agents()
}

#[tauri::command]
pub fn cmd_save_agent_credential(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    agent_id: String,
    credential: AgentCredentialConfig,
) -> Vec<AgentProfile> {
    orchestrator.save_agent_credential(&agent_id, credential)
}

#[tauri::command]
pub fn cmd_get_agent_credentials(
    store: tauri::State<'_, SharedStore>,
) -> HashMap<String, AgentCredentialConfig> {
    store.get_agent_credentials()
}

#[tauri::command]
pub fn cmd_launch_agent_login(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    agent_id: String,
) -> Result<String, String> {
    orchestrator.launch_agent_login(&agent_id)
}

#[tauri::command]
pub fn cmd_launch_agent_web_auth(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    agent_id: String,
    task_prompt: Option<String>,
    task_id: Option<String>,
) -> Result<String, String> {
    orchestrator.launch_agent_web_auth(&agent_id, task_prompt, task_id, None)
}

#[tauri::command]
pub fn cmd_dispatch_agent_task(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    request: AgentTaskRequest,
) -> Result<AgentTaskRecord, String> {
    orchestrator.dispatch_task(request)
}

#[tauri::command]
pub fn cmd_get_agent_tasks(store: tauri::State<'_, SharedStore>) -> Vec<AgentTaskRecord> {
    store.get_agent_tasks()
}

#[tauri::command]
pub fn cmd_cancel_agent_task(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    task_id: String,
) -> Vec<AgentTaskRecord> {
    orchestrator.cancel_task(&task_id)
}

#[tauri::command]
pub fn cmd_clear_agent_tasks(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
) -> Vec<AgentTaskRecord> {
    orchestrator.clear_completed_tasks()
}

#[tauri::command]
pub fn cmd_get_agent_checkpoints(store: tauri::State<'_, SharedStore>) -> Vec<AgentCheckpoint> {
    store.get_agent_checkpoints()
}

#[tauri::command]
pub fn cmd_restore_agent_checkpoint(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    checkpoint_id: String,
) -> Result<String, String> {
    orchestrator.restore_checkpoint(&checkpoint_id)
}

#[tauri::command]
pub fn cmd_remove_agent_profile(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    agent_id: String,
) -> Vec<AgentProfile> {
    orchestrator.remove_agent_profile(&agent_id)
}

#[tauri::command]
pub fn cmd_complete_web_task_with_reply(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    task_id: String,
    reply_markdown: String,
) -> Result<AgentTaskRecord, String> {
    orchestrator.complete_web_task_with_reply(&task_id, &reply_markdown)
}

#[tauri::command]
pub fn cmd_clear_agent_task_logs(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    task_id: String,
) -> Vec<AgentTaskRecord> {
    orchestrator.clear_task_logs(&task_id)
}

#[tauri::command]
pub fn cmd_delete_agent_task(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    task_id: String,
) -> Vec<AgentTaskRecord> {
    orchestrator.delete_task(&task_id)
}

#[tauri::command]
pub fn cmd_clear_workspace_cache(
    workspace_path: String,
    clear_memory: bool,
) -> Result<String, String> {
    super::checkpoint::clear_workspace_memory_and_cache(&workspace_path, clear_memory)
}

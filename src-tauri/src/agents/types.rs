//! Data models, task records, and serialization contracts for the FlyMD Multi-Agent system.

use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

/// Returns current timestamp in milliseconds since Unix epoch.
pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Counts total checklist items (`- [ ]`, `- [x]`) and completed items.
pub fn count_markdown_checklists(content: &str) -> (usize, usize) {
    let mut total = 0usize;
    let mut done = 0usize;
    for line in content.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("- [ ] ") || trimmed.starts_with("* [ ] ") {
            total += 1;
        } else if trimmed.starts_with("- [x] ")
            || trimmed.starts_with("- [X] ")
            || trimmed.starts_with("* [x] ")
            || trimmed.starts_with("* [X] ")
        {
            total += 1;
            done += 1;
        }
    }
    (total, done)
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct AgentCredentialConfig {
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
    #[serde(rename = "customBinaryPath")]
    pub custom_binary_path: Option<String>,
    #[serde(rename = "customArgs")]
    pub custom_args: Option<String>,
    #[serde(rename = "connectedAccountLabel")]
    pub connected_account_label: Option<String>,
    #[serde(rename = "oauthVerified", default)]
    pub oauth_verified: bool,
    #[serde(rename = "webSessionVerified", default)]
    pub web_session_verified: bool,
    #[serde(rename = "preferredMode")]
    pub preferred_mode: Option<String>,
    #[serde(rename = "isCustomAgent", default)]
    pub is_custom_agent: bool,
    #[serde(rename = "customName")]
    pub custom_name: Option<String>,
    #[serde(rename = "customVendor")]
    pub custom_vendor: Option<String>,
    #[serde(rename = "customDescription")]
    pub custom_description: Option<String>,
    #[serde(rename = "customAccentColor")]
    pub custom_accent_color: Option<String>,
    #[serde(rename = "customWebUrl")]
    pub custom_web_url: Option<String>,
    #[serde(rename = "customLoginCommand")]
    pub custom_login_command: Option<String>,
    #[serde(rename = "disabled", default)]
    pub disabled: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AgentToolAction {
    pub id: String,
    pub kind: String,
    pub label: String,
    #[serde(rename = "targetPath")]
    pub target_path: Option<String>,
    pub status: String,
    pub timestamp: i64,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub output: Option<String>,
    #[serde(default, rename = "durationMs")]
    pub duration_ms: Option<u64>,
}

impl AgentToolAction {
    pub fn new(
        id: String,
        kind: String,
        label: String,
        target_path: Option<String>,
        status: String,
        timestamp: i64,
    ) -> Self {
        Self {
            id,
            kind,
            label,
            target_path,
            status,
            timestamp,
            command: None,
            output: None,
            duration_ms: None,
        }
    }

    pub fn with_details(
        id: String,
        kind: String,
        label: String,
        target_path: Option<String>,
        status: String,
        timestamp: i64,
        command: Option<String>,
        output: Option<String>,
        duration_ms: Option<u64>,
    ) -> Self {
        Self {
            id,
            kind,
            label,
            target_path,
            status,
            timestamp,
            command,
            output,
            duration_ms,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AgentProfile {
    pub id: String,
    pub name: String,
    #[serde(rename = "shortName")]
    pub short_name: String,
    pub vendor: String,
    pub description: String,
    #[serde(rename = "accentColor")]
    pub accent_color: String,
    #[serde(rename = "badgeBg")]
    pub badge_bg: String,
    #[serde(rename = "badgeText")]
    pub badge_text: String,
    #[serde(rename = "binaryNames")]
    pub binary_names: Vec<String>,
    #[serde(rename = "detectedBinaryPath")]
    pub detected_binary_path: Option<String>,
    pub installed: bool,
    #[serde(rename = "authStatus")]
    pub auth_status: String,
    pub tier: String,
    #[serde(rename = "loginCommand")]
    pub login_command: Option<String>,
    #[serde(rename = "webUrl")]
    pub web_url: Option<String>,
    #[serde(rename = "envKeyName")]
    pub env_key_name: Option<String>,
    #[serde(rename = "hasApiKey")]
    pub has_api_key: bool,
    #[serde(rename = "webAuthConnected", default)]
    pub web_auth_connected: bool,
    #[serde(rename = "connectedAccountLabel")]
    pub connected_account_label: Option<String>,
    #[serde(rename = "artifactWatchPaths")]
    pub artifact_watch_paths: Vec<String>,
    pub enabled: bool,
    #[serde(rename = "isCustom", default)]
    pub is_custom: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AgentTaskRequest {
    #[serde(rename = "targetAgentId")]
    pub target_agent_id: String,
    #[serde(rename = "sourceAgentId")]
    pub source_agent_id: Option<String>,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "markdownContent")]
    pub markdown_content: String,
    #[serde(rename = "selectedExcerpt")]
    pub selected_excerpt: Option<String>,
    #[serde(rename = "selectedChecklistItems")]
    pub selected_checklist_items: Option<Vec<String>>,
    pub intent: String,
    #[serde(rename = "customPrompt")]
    pub custom_prompt: Option<String>,
    #[serde(rename = "workspacePath")]
    pub workspace_path: String,
    #[serde(rename = "createSafetyCheckpoint", default)]
    pub create_safety_checkpoint: bool,
    #[serde(rename = "safeParallelMode", default)]
    pub safe_parallel_mode: bool,
    #[serde(rename = "attachSharedMemory", default)]
    pub attach_shared_memory: bool,
    #[serde(rename = "executionMode")]
    pub execution_mode: Option<String>,
    #[serde(rename = "pipelineId")]
    pub pipeline_id: Option<String>,
    #[serde(rename = "nextAgentInChain")]
    pub next_agent_in_chain: Option<String>,
    #[serde(rename = "nextIntentInChain")]
    pub next_intent_in_chain: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AgentTaskRecord {
    pub id: String,
    #[serde(rename = "targetAgentId")]
    pub target_agent_id: String,
    #[serde(rename = "sourceAgentId")]
    pub source_agent_id: Option<String>,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    pub intent: String,
    #[serde(rename = "customPrompt")]
    pub custom_prompt: Option<String>,
    #[serde(rename = "workspacePath")]
    pub workspace_path: String,
    #[serde(rename = "worktreePath")]
    pub worktree_path: Option<String>,
    #[serde(rename = "checkpointId")]
    pub checkpoint_id: Option<String>,
    #[serde(rename = "handoffFilePath")]
    pub handoff_file_path: Option<String>,
    #[serde(rename = "outputReportPath")]
    pub output_report_path: Option<String>,
    pub status: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "startedAt")]
    pub started_at: Option<i64>,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<i64>,
    #[serde(default)]
    pub logs: Vec<String>,
    #[serde(rename = "checklistTotal", default)]
    pub checklist_total: usize,
    #[serde(rename = "checklistCompleted", default)]
    pub checklist_completed: usize,
    pub error: Option<String>,
    #[serde(rename = "pipelineId")]
    pub pipeline_id: Option<String>,
    #[serde(rename = "nextAgentInChain")]
    pub next_agent_in_chain: Option<String>,
    #[serde(rename = "nextIntentInChain")]
    pub next_intent_in_chain: Option<String>,
    #[serde(rename = "responseMarkdown")]
    pub response_markdown: Option<String>,
    #[serde(rename = "thinkingTrace", default)]
    pub thinking_trace: Vec<String>,
    #[serde(rename = "progressStage")]
    pub progress_stage: Option<String>,
    #[serde(rename = "progressPercent", default)]
    pub progress_percent: u8,
    #[serde(rename = "toolActions", default)]
    pub tool_actions: Vec<AgentToolAction>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AgentCheckpoint {
    pub id: String,
    #[serde(rename = "taskId")]
    pub task_id: String,
    #[serde(rename = "agentId")]
    pub agent_id: String,
    #[serde(rename = "workspacePath")]
    pub workspace_path: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    pub label: String,
    #[serde(rename = "gitRef")]
    pub git_ref: Option<String>,
    #[serde(rename = "backupDir")]
    pub backup_dir: Option<String>,
    #[serde(default)]
    pub restored: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AgentStreamEvent {
    #[serde(rename = "taskId")]
    pub task_id: String,
    #[serde(rename = "agentId")]
    pub agent_id: String,
    pub line: String,
    pub timestamp: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CouncilAgentFeedback {
    #[serde(rename = "agentId")]
    pub agent_id: String,
    #[serde(rename = "agentName")]
    pub agent_name: String,
    pub recommendation: String,
    pub confidence: u8,
    pub observations: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CouncilBroadcastResponse {
    pub feedbacks: Vec<CouncilAgentFeedback>,
    pub consensus: String,
    pub summary: String,
}

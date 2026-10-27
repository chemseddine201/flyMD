//! Data contracts and domain models for Multi-Agent Discussion System.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const CURRENT_SCHEMA_VERSION: u32 = 1;

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DiscussionStatus {
    Created,
    Running,
    Paused,
    AwaitingReview,
    Completed,
    Failed,
    Cancelled,
    Interrupted,
}

impl Default for DiscussionStatus {
    fn default() -> Self {
        DiscussionStatus::Created
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AgentRole {
    Architect,
    Critic,
    Auditor,
    Implementer,
    Researcher,
    Custom(String),
}

impl Default for AgentRole {
    fn default() -> Self {
        AgentRole::Architect
    }
}

impl AgentRole {
    pub fn as_str(&self) -> &str {
        match self {
            AgentRole::Architect => "Architect",
            AgentRole::Critic => "Critic",
            AgentRole::Auditor => "Auditor",
            AgentRole::Implementer => "Implementer",
            AgentRole::Researcher => "Researcher",
            AgentRole::Custom(s) => s.as_str(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TokenUsage {
    #[serde(rename = "promptTokens", default)]
    pub prompt_tokens: u32,
    #[serde(rename = "completionTokens", default)]
    pub completion_tokens: u32,
    #[serde(rename = "totalTokens", default)]
    pub total_tokens: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiscussionParticipant {
    #[serde(rename = "agentId")]
    pub agent_id: String,
    #[serde(rename = "providerId")]
    pub provider_id: String,
    #[serde(rename = "modelId")]
    pub model_id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub role: AgentRole,
    #[serde(rename = "roleDescription", default)]
    pub role_description: String,
    #[serde(rename = "avatarColor", default = "default_avatar_color")]
    pub avatar_color: String,
    #[serde(rename = "assignedSkillUris", default)]
    pub assigned_skill_uris: Vec<String>,
    #[serde(rename = "contextBudgetTokens", default = "default_context_budget")]
    pub context_budget_tokens: u32,
}

fn default_avatar_color() -> String {
    "#38bdf8".to_string()
}

fn default_context_budget() -> u32 {
    16000
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DiscussionMessageKind {
    InitialAnalysis,
    PeerCritique,
    RebuttalRevision,
    SynthesisReport,
    UserIntervention,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiscussionMessage {
    pub id: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "roundNumber")]
    pub round_number: u32,
    #[serde(rename = "turnIndex")]
    pub turn_index: u32,
    #[serde(rename = "authorAgentId")]
    pub author_agent_id: String,
    #[serde(rename = "authorRole")]
    pub author_role: String,
    #[serde(rename = "authorProvider")]
    pub author_provider: String,
    #[serde(rename = "messageKind")]
    pub message_kind: DiscussionMessageKind,
    #[serde(rename = "targetPeerIds", default)]
    pub target_peer_ids: Vec<String>,
    pub content: String,
    pub timestamp: i64,
    #[serde(rename = "tokenUsage", default)]
    pub token_usage: Option<TokenUsage>,
    #[serde(rename = "durationMs", default)]
    pub duration_ms: u64,
    #[serde(default)]
    pub truncated: bool,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DisagreementStatus {
    UnresolvedDivergence,
    ResolvedConsensus,
    DeferredToUser,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DisagreementItem {
    pub id: String,
    pub topic: String,
    #[serde(rename = "agentStances")]
    pub agent_stances: HashMap<String, String>,
    pub status: DisagreementStatus,
    #[serde(rename = "resolutionNotes")]
    pub resolution_notes: Option<String>,
    #[serde(rename = "roundFirstObserved")]
    pub round_first_observed: u32,
    #[serde(rename = "roundLastUpdated")]
    pub round_last_updated: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DecisionItem {
    pub id: String,
    pub topic: String,
    pub decision: String,
    pub rationale: String,
    #[serde(rename = "agreedByAgents")]
    pub agreed_by_agents: Vec<String>,
    #[serde(rename = "agreedRound")]
    pub agreed_round: u32,
    #[serde(rename = "evidenceCitations", default)]
    pub evidence_citations: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiscussionConfig {
    #[serde(rename = "schemaVersion", default = "default_schema_version")]
    pub schema_version: u32,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub topic: String,
    #[serde(rename = "userIdea")]
    pub user_idea: String,
    #[serde(rename = "workspacePath")]
    pub workspace_path: String,
    #[serde(rename = "maxRounds", default = "default_max_rounds")]
    pub max_rounds: u32,
    #[serde(rename = "turnTimeoutSecs", default = "default_turn_timeout")]
    pub turn_timeout_secs: u64,
    pub participants: Vec<DiscussionParticipant>,
    #[serde(rename = "activeSkillUris", default)]
    pub active_skill_uris: Vec<String>,
}

fn default_schema_version() -> u32 {
    CURRENT_SCHEMA_VERSION
}

fn default_max_rounds() -> u32 {
    3
}

fn default_turn_timeout() -> u64 {
    120
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiscussionMetadata {
    #[serde(rename = "schemaVersion", default = "default_schema_version")]
    pub schema_version: u32,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub status: DiscussionStatus,
    #[serde(rename = "currentRound")]
    pub current_round: u32,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "startedAt")]
    pub started_at: Option<i64>,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<i64>,
    #[serde(rename = "totalMessages")]
    pub total_messages: usize,
    #[serde(rename = "totalTokens")]
    pub total_tokens: u32,
    #[serde(rename = "errorMessage")]
    pub error_message: Option<String>,
    #[serde(rename = "activeDisagreementsCount")]
    pub active_disagreements_count: usize,
    #[serde(rename = "decisionsCount")]
    pub decisions_count: usize,
    #[serde(rename = "latestReportVersion")]
    pub latest_report_version: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_discussion_status_serialization() {
        let status = DiscussionStatus::AwaitingReview;
        let serialized = serde_json::to_string(&status).unwrap();
        assert_eq!(serialized, "\"awaiting_review\"");
        let deserialized: DiscussionStatus = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized, DiscussionStatus::AwaitingReview);
    }

    #[test]
    fn test_default_metadata_values() {
        let meta = DiscussionMetadata {
            schema_version: CURRENT_SCHEMA_VERSION,
            session_id: "test-01".to_string(),
            status: DiscussionStatus::Created,
            current_round: 1,
            created_at: now_ms(),
            started_at: None,
            updated_at: now_ms(),
            completed_at: None,
            total_messages: 0,
            total_tokens: 0,
            error_message: None,
            active_disagreements_count: 0,
            decisions_count: 0,
            latest_report_version: 0,
        };
        assert_eq!(meta.schema_version, 1);
        assert_eq!(meta.status, DiscussionStatus::Created);
    }
}

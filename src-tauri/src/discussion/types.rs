//! Data contracts and domain models for Multi-Agent Discussion System.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const CURRENT_SCHEMA_VERSION: u32 = 1;

pub fn now_ms() -> i64 {
    crate::common::time::now_ms()
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DiscussionStatus {
    #[default]
    Created,
    Running,
    Paused,
    AwaitingReview,
    Completed,
    Failed,
    Cancelled,
    Interrupted,
}

/// Agent role. Serialized as a plain lowercase string (e.g. `"critic"`); any
/// unrecognised string becomes `Custom(..)` so user-defined roles round-trip.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub enum AgentRole {
    #[default]
    Architect,
    Critic,
    Auditor,
    Implementer,
    Researcher,
    Custom(String),
}

impl AgentRole {
    pub fn from_str_lossy(s: &str) -> Self {
        match s.trim().to_lowercase().as_str() {
            "architect" => AgentRole::Architect,
            "critic" => AgentRole::Critic,
            "auditor" => AgentRole::Auditor,
            "implementer" => AgentRole::Implementer,
            "researcher" => AgentRole::Researcher,
            "" => AgentRole::Architect,
            _ => AgentRole::Custom(s.trim().to_string()),
        }
    }

    fn wire_name(&self) -> String {
        match self {
            AgentRole::Custom(s) => s.clone(),
            other => other.as_str().to_lowercase(),
        }
    }
}

impl Serialize for AgentRole {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.wire_name())
    }
}

impl<'de> Deserialize<'de> for AgentRole {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        // Accept a plain string, or the legacy externally-tagged `{ "custom": "x" }` form.
        let value = serde_json::Value::deserialize(deserializer)?;
        match value {
            serde_json::Value::String(s) => Ok(AgentRole::from_str_lossy(&s)),
            serde_json::Value::Object(map) => {
                if let Some(serde_json::Value::String(s)) = map.get("custom") {
                    Ok(AgentRole::Custom(s.clone()))
                } else {
                    Err(serde::de::Error::custom("invalid agent role object"))
                }
            }
            _ => Err(serde::de::Error::custom("agent role must be a string")),
        }
    }
}

/// A user-defined (or catalog) action that focuses an agent on a specific task.
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub struct AgentCustomAction {
    #[serde(default)]
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(rename = "promptDirective", default)]
    pub prompt_directive: String,
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

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub struct TokenUsage {
    #[serde(rename = "promptTokens", default)]
    pub prompt_tokens: u32,
    #[serde(rename = "completionTokens", default)]
    pub completion_tokens: u32,
    #[serde(rename = "reasoningTokens", default)]
    pub reasoning_tokens: u32,
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
    /// Standing action assigned to this agent for every round (optional).
    #[serde(rename = "customAction", default)]
    pub custom_action: Option<AgentCustomAction>,
    /// Free-form question / instruction the user wants this agent to answer (optional).
    #[serde(rename = "customQuery", default)]
    pub custom_query: Option<String>,
    /// Ask the model to reason step-by-step before answering.
    #[serde(rename = "thinkingEnabled", default = "default_true")]
    pub thinking_enabled: bool,
    /// Effort level for this agent (low, medium, high, xhigh, max). Defaults to medium.
    #[serde(rename = "effortLevel", default = "default_medium_effort")]
    pub effort_level: Option<String>,
}

fn default_medium_effort() -> Option<String> {
    Some("medium".to_string())
}

fn default_true() -> bool {
    true
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
    /// Out-of-band turn requested by the user for one specific agent.
    TargetedAction,
    /// Zero-query record indicating a step or round was skipped due to successive summary convergence.
    SkippedConsensus,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RoundExecutionStatus {
    #[default]
    Executed,
    ConvergedEarly,
    IgnoredConsensus,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct RoundExecutionRecord {
    #[serde(rename = "roundNumber")]
    pub round_number: u32,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub status: RoundExecutionStatus,
    #[serde(rename = "convergedFromRound", default, skip_serializing_if = "Option::is_none")]
    pub converged_from_round: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(rename = "skippedAgentNames", default)]
    pub skipped_agent_names: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiscussionRoundSlot {
    #[serde(rename = "slotId", default)]
    pub slot_id: String,
    pub participant: DiscussionParticipant,
    #[serde(rename = "roundDirective", default, skip_serializing_if = "Option::is_none")]
    pub round_directive: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiscussionRoundPlan {
    #[serde(rename = "roundNumber")]
    pub round_number: u32,
    #[serde(default)]
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub objective: Option<String>,
    #[serde(default)]
    pub slots: Vec<DiscussionRoundSlot>,
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
    /// Model reasoning captured separately from the answer (never fed to peers).
    #[serde(rename = "thinkingContent", default, skip_serializing_if = "Option::is_none")]
    pub thinking_content: Option<String>,
    /// Name of the custom action this turn executed, if any.
    #[serde(rename = "actionName", default, skip_serializing_if = "Option::is_none")]
    pub action_name: Option<String>,
    /// Actual model / runtime that produced the turn.
    #[serde(rename = "modelId", default, skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
    /// True when produced by the offline simulator rather than a real model.
    #[serde(default)]
    pub simulated: bool,
    /// Display name of the authoring agent.
    #[serde(rename = "authorDisplayName", default, skip_serializing_if = "Option::is_none")]
    pub author_display_name: Option<String>,
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

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct DiscussionAttachedFile {
    #[serde(default)]
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub size: u64,
    #[serde(default)]
    pub extension: String,
    #[serde(rename = "mimeType", default, skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(rename = "dataUrl", default, skip_serializing_if = "Option::is_none")]
    pub data_url: Option<String>,
    #[serde(rename = "isImage", default)]
    pub is_image: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
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
    #[serde(rename = "stepMode", default)]
    pub step_mode: bool,
    #[serde(rename = "customSkillsDir", default, skip_serializing_if = "Option::is_none")]
    pub custom_skills_dir: Option<String>,
    #[serde(rename = "includeDefaultSkills", default = "default_true")]
    pub include_default_skills: bool,
    #[serde(rename = "tokenBudgetCap", default, skip_serializing_if = "Option::is_none")]
    pub token_budget_cap: Option<u32>,
    #[serde(rename = "selectedEngines", default, skip_serializing_if = "Vec::is_empty")]
    pub selected_engines: Vec<String>,
    #[serde(rename = "repeaterMode", default, skip_serializing_if = "Option::is_none")]
    pub repeater_mode: Option<String>,
    #[serde(rename = "roundSchedule", default, skip_serializing_if = "Vec::is_empty")]
    pub round_schedule: Vec<DiscussionRoundPlan>,
    #[serde(rename = "pauseAtRoundBoundary", default)]
    pub pause_at_round_boundary: bool,
    #[serde(rename = "attachedFiles", default, skip_serializing_if = "Vec::is_empty")]
    pub attached_files: Vec<DiscussionAttachedFile>,
}

pub type ResolvedRoundSlot = (DiscussionParticipant, Option<String>);
pub type ResolvedRoundPlan = (String, Option<String>, Vec<ResolvedRoundSlot>);

impl DiscussionConfig {
    /// Resolves the effective title, objective, and ordered `(participant, round_directive)` slots for `round`.
    /// Supports explicit per-round plans, repeating cycle templates (`repeaterMode == "cycle"`),
    /// and 100% backward-compatible fallback to `self.participants`.
    pub fn resolve_round_plan(&self, round: u32) -> ResolvedRoundPlan {
        let default_title = match round {
            1 => "Round 1: Discovery & Position Synthesis".to_string(),
            2 => "Round 2: Adversarial Critique & Cross-Examination".to_string(),
            3 => "Round 3: Rebuttal, Trade-off Resolution & Synthesis".to_string(),
            r => format!("Round {}: Deep Specialist Deliberation", r),
        };

        let mode = self.repeater_mode.as_deref().unwrap_or("auto");
        if mode != "off" && !self.round_schedule.is_empty() {
            let matched_plan = self
                .round_schedule
                .iter()
                .find(|p| p.round_number == round && !p.slots.is_empty())
                .or_else(|| {
                    let non_empty: Vec<&DiscussionRoundPlan> = self
                        .round_schedule
                        .iter()
                        .filter(|p| !p.slots.is_empty())
                        .collect();
                    if non_empty.is_empty() {
                        None
                    } else {
                        let idx = ((round.saturating_sub(1)) as usize) % non_empty.len();
                        Some(non_empty[idx])
                    }
                });

            if let Some(plan) = matched_plan {
                let title = if plan.title.trim().is_empty() {
                    default_title
                } else {
                    plan.title.clone()
                };
                let mut seen_slot_ids = std::collections::HashSet::new();
                let slots: Vec<(DiscussionParticipant, Option<String>)> = plan
                    .slots
                    .iter()
                    .enumerate()
                    .map(|(idx, slot)| {
                        let mut p = slot.participant.clone();
                        if p.agent_id.trim().is_empty() {
                            p.agent_id = format!("slot-r{}-{}", round, idx + 1);
                        } else if !seen_slot_ids.insert(p.agent_id.clone()) {
                            p.agent_id = format!("{}-slot{}", p.agent_id, idx + 1);
                            seen_slot_ids.insert(p.agent_id.clone());
                        }
                        let directive = slot
                            .round_directive
                            .clone()
                            .filter(|d| !d.trim().is_empty())
                            .or_else(|| plan.objective.clone().filter(|o| !o.trim().is_empty()));
                        (p, directive)
                    })
                    .collect();
                return (title, plan.objective.clone(), slots);
            }
        } else if mode == "per_agent" && !self.participants.is_empty() {
            let idx = (round.saturating_sub(1) as usize) % self.participants.len();
            let p = self.participants[idx].clone();
            let directive = p.custom_query.clone().or_else(|| {
                Some(format!("Apply specialized domain experience as {}.", p.display_name))
            });
            let agent_title = format!("Round {}: {} Deliberation", round, p.display_name);
            return (agent_title, None, vec![(p, directive)]);
        }

        let fallback_slots = self
            .participants
            .iter()
            .cloned()
            .map(|p| (p, None))
            .collect();
        (default_title, None, fallback_slots)
    }

    /// Collects all unique participants across both `participants` and every round in `round_schedule`
    /// so provider registries and contribution summaries cover every scheduled engine/role.
    pub fn all_scheduled_participants(&self) -> Vec<DiscussionParticipant> {
        let mut out: Vec<DiscussionParticipant> = Vec::new();
        let mut seen_keys = std::collections::HashSet::new();

        for p in &self.participants {
            let key = format!("{}::{}::{}", p.agent_id, p.provider_id, p.model_id);
            if seen_keys.insert(key) {
                out.push(p.clone());
            }
        }

        for plan in &self.round_schedule {
            for slot in &plan.slots {
                let p = &slot.participant;
                let key = format!("{}::{}::{}", p.agent_id, p.provider_id, p.model_id);
                if seen_keys.insert(key) {
                    out.push(p.clone());
                }
            }
        }

        out
    }
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

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct DiscussionMetadata {
    #[serde(rename = "schemaVersion", default = "default_schema_version")]
    pub schema_version: u32,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub topic: Option<String>,
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
    #[serde(rename = "convergedAtRound", default, skip_serializing_if = "Option::is_none")]
    pub converged_at_round: Option<u32>,
    #[serde(rename = "convergenceReason", default, skip_serializing_if = "Option::is_none")]
    pub convergence_reason: Option<String>,
    #[serde(rename = "roundLedger", default, skip_serializing_if = "Vec::is_empty")]
    pub round_ledger: Vec<RoundExecutionRecord>,
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
            topic: None,
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
            ..Default::default()
        };
        assert_eq!(meta.schema_version, 1);
        assert_eq!(meta.status, DiscussionStatus::Created);
    }

    #[test]
    fn test_round_schedule_repeater_resolution() {
        let p1 = DiscussionParticipant {
            agent_id: "a1".to_string(),
            provider_id: "claude-code".to_string(),
            model_id: "claude-3-7-sonnet".to_string(),
            display_name: "Architect".to_string(),
            role: AgentRole::Architect,
            role_description: "System design".to_string(),
            avatar_color: "#38bdf8".to_string(),
            assigned_skill_uris: vec![],
            context_budget_tokens: 16000,
            custom_action: None,
            custom_query: None,
            thinking_enabled: true,
            effort_level: Some("high".to_string()),
        };
        let p2 = DiscussionParticipant {
            agent_id: "a2".to_string(),
            provider_id: "antigravity".to_string(),
            model_id: "gemini-2.5-pro".to_string(),
            display_name: "Security Critic".to_string(),
            role: AgentRole::Custom("Security Critic".to_string()),
            role_description: "Zero-trust threat modeling".to_string(),
            avatar_color: "#ef4444".to_string(),
            assigned_skill_uris: vec![],
            context_budget_tokens: 16000,
            custom_action: None,
            custom_query: None,
            thinking_enabled: true,
            effort_level: Some("high".to_string()),
        };

        let cfg = DiscussionConfig {
            schema_version: 1,
            session_id: "s-rep".to_string(),
            topic: "Microkernel Auth".to_string(),
            user_idea: "Design auth layer".to_string(),
            workspace_path: ".".to_string(),
            max_rounds: 4,
            turn_timeout_secs: 60,
            participants: vec![p1.clone()],
            repeater_mode: Some("cycle".to_string()),
            round_schedule: vec![
                DiscussionRoundPlan {
                    round_number: 1,
                    title: "Phase A: Blueprint".to_string(),
                    objective: Some("Propose core contracts".to_string()),
                    slots: vec![DiscussionRoundSlot {
                        slot_id: "s1".to_string(),
                        participant: p1,
                        round_directive: Some("Draft contracts".to_string()),
                    }],
                },
                DiscussionRoundPlan {
                    round_number: 2,
                    title: "Phase B: Threat Audit".to_string(),
                    objective: Some("Audit vulnerabilities".to_string()),
                    slots: vec![DiscussionRoundSlot {
                        slot_id: "s2".to_string(),
                        participant: p2,
                        round_directive: Some("Probe attack surface".to_string()),
                    }],
                },
            ],
            ..Default::default()
        };

        // Round 3 should repeat Phase A (index 0) and Round 4 should repeat Phase B (index 1)
        let (r3_title, _, r3_slots) = cfg.resolve_round_plan(3);
        assert_eq!(r3_title, "Phase A: Blueprint");
        assert_eq!(r3_slots[0].0.provider_id, "claude-code");
        assert_eq!(r3_slots[0].1.as_deref(), Some("Draft contracts"));

        let (r4_title, _, r4_slots) = cfg.resolve_round_plan(4);
        assert_eq!(r4_title, "Phase B: Threat Audit");
        assert_eq!(r4_slots[0].0.provider_id, "antigravity");
        assert_eq!(cfg.all_scheduled_participants().len(), 2);
    }

    #[test]
    fn test_per_agent_round_schedule_resolution() {
        let p1 = DiscussionParticipant {
            agent_id: "lead-architect".to_string(),
            provider_id: "claude-code".to_string(),
            model_id: "claude-opus-5-5".to_string(),
            display_name: "Lead Architect".to_string(),
            role: AgentRole::Architect,
            role_description: "Decomposition and invariants".to_string(),
            avatar_color: "#38bdf8".to_string(),
            assigned_skill_uris: vec![],
            context_budget_tokens: 24000,
            custom_action: None,
            custom_query: Some("Propose architecture invariants".to_string()),
            thinking_enabled: true,
            effort_level: Some("high".to_string()),
        };
        let p2 = DiscussionParticipant {
            agent_id: "security-auditor".to_string(),
            provider_id: "antigravity".to_string(),
            model_id: "gemini-4-argon".to_string(),
            display_name: "Security Auditor".to_string(),
            role: AgentRole::Critic,
            role_description: "Threat models and attack vectors".to_string(),
            avatar_color: "#ef4444".to_string(),
            assigned_skill_uris: vec![],
            context_budget_tokens: 24000,
            custom_action: None,
            custom_query: Some("Probe exploit surfaces".to_string()),
            thinking_enabled: true,
            effort_level: Some("high".to_string()),
        };

        let cfg = DiscussionConfig {
            schema_version: 1,
            session_id: "s-per-agent".to_string(),
            topic: "Zero-Trust Architecture".to_string(),
            user_idea: "Design access control".to_string(),
            workspace_path: ".".to_string(),
            max_rounds: 2,
            turn_timeout_secs: 60,
            participants: vec![p1, p2],
            repeater_mode: Some("per_agent".to_string()),
            ..Default::default()
        };

        // Round 1 must map to p1
        let (r1_title, _, r1_slots) = cfg.resolve_round_plan(1);
        assert_eq!(r1_slots.len(), 1);
        assert_eq!(r1_slots[0].0.agent_id, "lead-architect");
        assert_eq!(r1_slots[0].1.as_deref(), Some("Propose architecture invariants"));
        assert!(r1_title.contains("Lead Architect"));

        // Round 2 must map to p2
        let (r2_title, _, r2_slots) = cfg.resolve_round_plan(2);
        assert_eq!(r2_slots.len(), 1);
        assert_eq!(r2_slots[0].0.agent_id, "security-auditor");
        assert_eq!(r2_slots[0].1.as_deref(), Some("Probe exploit surfaces"));
        assert!(r2_title.contains("Security Auditor"));
    }

    #[test]
    fn test_shared_round_plan_cases_parity() {
        #[derive(serde::Deserialize)]
        struct Expectation {
            round: u32,
            #[serde(rename = "expectedTitle")]
            expected_title: String,
            #[serde(rename = "expectedObjective")]
            expected_objective: Option<String>,
            #[serde(rename = "expectedSlotAgentIds")]
            expected_slot_agent_ids: Vec<String>,
            #[serde(rename = "expectedDirectives")]
            expected_directives: Vec<Option<String>>,
        }

        #[derive(serde::Deserialize)]
        struct TestCase {
            scenario: String,
            config: serde_json::Value,
            expectations: Vec<Expectation>,
        }

        let cases_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("src")
            .join("discussion")
            .join("fixtures")
            .join("round_plan_cases.json");
        let raw = std::fs::read_to_string(&cases_path)
            .expect("round_plan_cases.json must exist");
        let test_cases: Vec<TestCase> = serde_json::from_str(&raw).unwrap();

        for tc in test_cases {
            let config: DiscussionConfig = serde_json::from_value(tc.config)
                .unwrap_or_else(|e| panic!("Failed to parse config for scenario {}: {}", tc.scenario, e));
            for exp in tc.expectations {
                let (title, objective, slots) = config.resolve_round_plan(exp.round);
                assert_eq!(
                    title, exp.expected_title,
                    "Scenario {} round {} title mismatch",
                    tc.scenario, exp.round
                );
                assert_eq!(
                    objective, exp.expected_objective,
                    "Scenario {} round {} objective mismatch",
                    tc.scenario, exp.round
                );
                let agent_ids: Vec<String> = slots.iter().map(|(p, _)| p.agent_id.clone()).collect();
                assert_eq!(
                    agent_ids, exp.expected_slot_agent_ids,
                    "Scenario {} round {} slots agent_id mismatch",
                    tc.scenario, exp.round
                );
                let directives: Vec<Option<String>> = slots.iter().map(|(_, d)| d.clone()).collect();
                assert_eq!(
                    directives, exp.expected_directives,
                    "Scenario {} round {} directives mismatch",
                    tc.scenario, exp.round
                );
            }
        }
    }
}

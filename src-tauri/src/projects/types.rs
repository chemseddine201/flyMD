//! Core domain types and data contracts for Hierarchical Projects & Dual-Layer Memory.

use serde::{Deserialize, Serialize};

/// Operational status of a project or sub-project node in the hierarchy.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProjectStatus {
    /// Idle project, awaiting initial definition or debate.
    Idle,
    /// Multi-agent deliberation and architecture debate in progress.
    Debating,
    /// Synthesis report finalized; waiting for human review / intervention.
    ReportReady,
    /// Dedicated DAG pipeline executing task steps.
    PipelineRunning,
    /// Work delivered, verified by evidence, and rolled up to Master Memory.
    Completed,
}

impl Default for ProjectStatus {
    fn default() -> Self {
        ProjectStatus::Idle
    }
}

/// Represents a single project or sub-project node in the arbitrary depth hierarchy.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProjectNode {
    /// Unique identifier (e.g. `proj-1793250100`).
    pub id: String,
    /// Parent project identifier. `None` indicates a root-level workspace project.
    pub parent_id: Option<String>,
    /// Human-readable title of the project or module.
    pub name: String,
    /// Optional description or scope summary.
    pub description: String,
    /// Workspace-relative file or folder patterns bounded to this project.
    pub scope_paths: Vec<String>,
    /// Current operational status.
    pub status: ProjectStatus,
    /// Active deliberation session identifier, if in debate.
    pub active_debate_id: Option<String>,
    /// Active dedicated pipeline identifier, if running.
    pub active_pipeline_id: Option<String>,
    /// Epoch millisecond when created.
    pub created_at: i64,
    /// Epoch millisecond when last updated.
    pub updated_at: i64,
}

/// Request payload to create a new project or sub-project.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CreateProjectRequest {
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub scope_paths: Option<Vec<String>>,
}

/// Request payload to update an existing project node.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub scope_paths: Option<Vec<String>>,
    pub status: Option<ProjectStatus>,
    pub active_debate_id: Option<String>,
    pub active_pipeline_id: Option<String>,
}

/// Kind of memory entry recorded in project scoped memory.
/// Follows the OMH evidence taxonomy: decisions, invariants, deliverables, and audit notes.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryEntryKind {
    /// Architectural decisions made during debate or review.
    Decision,
    /// Hard system invariant or contract (e.g. API spec, security policy).
    Invariant,
    /// Observed deliverables (files created, code components added).
    Deliverable,
    /// Reviewer critiques, audit observations, and verification receipts.
    AuditNote,
}

/// A structured record stored in `.flymd/projects/{id}/memory.jsonl`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProjectMemoryRecord {
    pub id: String,
    pub project_id: String,
    pub timestamp: i64,
    pub author_role: String,
    pub kind: MemoryEntryKind,
    pub summary: String,
    pub details: Option<String>,
    pub tags: Vec<String>,
}

/// Token-budgeted recall pack delivered to an agent during task preparation.
/// Combines Master Memory invariants with project-scoped decisions.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RecallPack {
    pub project_id: String,
    pub master_invariants: String,
    pub scoped_context: String,
    pub estimated_tokens: usize,
    pub rendered_markdown: String,
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}


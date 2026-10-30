//! Dual-Layer Memory Engine: Scoped Local Memory, Master Consolidation, and Recall Pack Generator.

use super::storage;
use super::tree::ProjectTree;
use super::types::{now_ms, MemoryEntryKind, ProjectMemoryRecord, ProjectNode, RecallPack};
use std::path::Path;

/// Appends a new memory entry into the project's scoped `.flymd/projects/{id}/memory.jsonl`.
pub fn record_scoped_memory(
    workspace_path: &Path,
    project_id: &str,
    author_role: &str,
    kind: MemoryEntryKind,
    summary: &str,
    details: Option<&str>,
    tags: Vec<String>,
) -> Result<ProjectMemoryRecord, String> {
    let record = ProjectMemoryRecord {
        id: format!("mem-{}", now_ms()),
        project_id: project_id.to_string(),
        timestamp: now_ms(),
        author_role: author_role.to_string(),
        kind,
        summary: summary.to_string(),
        details: details.map(|s| s.to_string()),
        tags,
    };

    storage::append_project_memory_record(workspace_path, project_id, &record)?;
    Ok(record)
}

/// Rolls up a completed sub-project's decisions and contracts into the global `MASTER_MEMORY.md`.
pub fn rollup_project_to_master(
    workspace_path: &Path,
    project: &ProjectNode,
    summary_markdown: &str,
) -> Result<(), String> {
    let mut current_master = storage::read_master_memory(workspace_path);

    let rollup_entry = format!(
        "\n### [{}] Project `{}` (`{}`) — Rollup Verified\n\
        - **Status**: Completed & Verified\n\
        - **Scope Paths**: {}\n\
        - **Timestamp**: {}\n\n\
        {}\n\n---\n",
        project.id,
        project.name,
        project.id,
        if project.scope_paths.is_empty() {
            "Entire Project".to_string()
        } else {
            project.scope_paths.join(", ")
        },
        now_ms(),
        summary_markdown.trim()
    );

    current_master.push_str(&rollup_entry);
    storage::write_master_memory(workspace_path, &current_master)
}

/// Builds a token-budgeted `RecallPack` combining Master Memory invariants with Scoped project context.
/// Ensures the agent's context window is not polluted with irrelevant details from sibling projects.
pub fn build_recall_pack(
    workspace_path: &Path,
    tree: &ProjectTree,
    project_id: &str,
    max_tokens: usize,
) -> RecallPack {
    let master_raw = storage::read_master_memory(workspace_path);

    // Extract core invariants from Master Memory (first 1,200 chars or section 1)
    let master_invariants = extract_master_invariants(&master_raw);

    // Gather scoped memory from this project and its immediate ancestors
    let mut scoped_sections = Vec::new();

    // 1. Current project scoped records
    let current_records = storage::read_project_memory_records(workspace_path, project_id);
    if !current_records.is_empty() {
        let mut s = format!("#### Local Decisions & Invariants for `{}`:\n", project_id);
        for rec in current_records.iter().rev().take(10) {
            s.push_str(&format!(
                "- **[{:?}]** ({}) {}\n",
                rec.kind, rec.author_role, rec.summary
            ));
            if let Some(ref d) = rec.details {
                s.push_str(&format!("  > {}\n", d.lines().next().unwrap_or("")));
            }
        }
        scoped_sections.push(s);
    }

    // 2. Ancestor projects contracts
    let ancestors = tree.get_ancestors(project_id);
    for anc in ancestors.iter().take(2) {
        let anc_records = storage::read_project_memory_records(workspace_path, &anc.id);
        let invariants: Vec<&ProjectMemoryRecord> = anc_records
            .iter()
            .filter(|r| r.kind == MemoryEntryKind::Invariant || r.kind == MemoryEntryKind::Decision)
            .take(5)
            .collect();

        if !invariants.is_empty() {
            let mut s = format!("#### Parent Context from `{}`:\n", anc.name);
            for inv in invariants {
                s.push_str(&format!("- [{}] {}\n", inv.author_role, inv.summary));
            }
            scoped_sections.push(s);
        }
    }

    let scoped_context = if scoped_sections.is_empty() {
        "_No prior scoped decisions recorded for this project node._".to_string()
    } else {
        scoped_sections.join("\n")
    };

    // Render unified Markdown pack
    let mut rendered = format!(
        "### Dual-Layer Project Memory Context (OMH Protocol)\n\n\
        #### 1. Global Master Invariants:\n{}\n\n\
        #### 2. Project Scoped Memory & Upstream Contracts:\n{}\n",
        master_invariants.trim(),
        scoped_context.trim()
    );

    // Budget enforcement (~4 characters per token heuristic) — strictly UTF-8 char-boundary safe
    let estimated_tokens = rendered.len() / 4;
    if estimated_tokens > max_tokens && max_tokens > 100 {
        let mut byte_limit = (max_tokens * 4).min(rendered.len());
        while byte_limit > 0 && !rendered.is_char_boundary(byte_limit) {
            byte_limit -= 1;
        }
        if rendered.len() > byte_limit {
            rendered.truncate(byte_limit);
            rendered.push_str("\n\n_[Recall Pack truncated to preserve token budget]_");
        }
    }

    RecallPack {
        project_id: project_id.to_string(),
        master_invariants,
        scoped_context,
        estimated_tokens,
        rendered_markdown: rendered,
    }
}

/// Helper to parse section 1 of Master Memory.
fn extract_master_invariants(master_md: &str) -> String {
    let mut lines = Vec::new();
    let mut capturing = false;

    for line in master_md.lines() {
        if line.starts_with("## 1.") {
            capturing = true;
            continue;
        } else if line.starts_with("## 2.") {
            break;
        }
        if capturing && !line.trim().is_empty() {
            lines.push(line);
        }
    }

    if lines.is_empty() {
        "- Isolated execution and observed evidence required before completion.".to_string()
    } else {
        lines.join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_master_invariants() {
        let sample = "# Master\n\n## 1. System Invariants\n- Must use UTF-8\n- Strict PID kill\n\n## 2. Completed Projects\n- Project A\n";
        let extracted = extract_master_invariants(sample);
        assert!(extracted.contains("Must use UTF-8"));
        assert!(extracted.contains("Strict PID kill"));
        assert!(!extracted.contains("Project A"));
    }

    #[test]
    fn test_arabic_recall_pack_truncation_never_panics() {
        let temp_dir = std::env::temp_dir().join("flymd_arabic_recall_test");
        let _ = std::fs::create_dir_all(&temp_dir);
        let arabic_heavy = format!(
            "# Master\n\n## 1. System Invariants\n- {}\n\n## 2. Completed\n",
            "شرح تطور فيزياء الضوء حتى الوصول إلى نظرية الكم بطريقة مسلية للطلاب ".repeat(60)
        );
        storage::write_master_memory(&temp_dir, &arabic_heavy).unwrap();
        let tree = ProjectTree::new();

        // Sweep across multiple odd/even token budgets so `max_tokens * 4` hits every byte offset
        for budget in 101..125 {
            let pack = build_recall_pack(&temp_dir, &tree, "root", budget);
            assert!(!pack.rendered_markdown.is_empty());
        }

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}

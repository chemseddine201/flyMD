//! Workspace path resolution, parallel worktree creation, and epistemic handoff package assembly.

use super::types::{
    count_markdown_checklists, now_ms, AgentTaskRecord, AgentTaskRequest,
};
use super::{checkpoint, runner, verify};
use std::fs;
use std::path::Path;
use std::process::Command;

/// Assembled handoff package artifacts ready to write to `.flymd/handoffs/` and dispatch to `runner`.
pub struct PreparedHandoffPackage {
    pub instructions: String,
    pub body_to_process: String,
    pub handoff_content: String,
    pub resolved_resume_session_id: Option<String>,
    pub total_checklists: usize,
    pub completed_checklists: usize,
    pub epistemic_log_line: String,
}

/// Resolves the effective workspace directory from an `AgentTaskRequest`, falling back to the
/// target file's parent directory or process current working directory.
pub fn resolve_effective_workspace(req: &AgentTaskRequest) -> String {
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
    }
}

/// Creates an isolated git worktree under `.flymd/worktrees/<task_id>` when `safe_parallel_mode` is enabled.
pub fn prepare_parallel_worktree(
    flymd_dir: &Path,
    ws_path: &Path,
    target_agent_id: &str,
    task_id: &str,
) -> Option<String> {
    let wt_dir = flymd_dir.join("worktrees").join(task_id);
    fs::create_dir_all(&wt_dir).ok();
    let branch_name = format!("flymd/{}-{}", target_agent_id, task_id);
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
}

/// Strips Section 4 (the raw discussion rounds) from a Discussion Report when token_saver is active.
pub fn strip_discussion_report_section_4(doc: &str, report_path: &str) -> String {
    if let Some(start_idx) = doc.find("## 4. ") {
        if let Some(end_rel) = doc[start_idx..].find("\n## 5. ") {
            let end_idx = start_idx + end_rel + 1;
            let before = &doc[..start_idx];
            let after = &doc[end_idx..];
            let display_path = if report_path.trim().is_empty() {
                "deliberation report"
            } else {
                report_path
            };
            return format!(
                "{}## 4. Main Arguments, Critiques, Replies, and Revisions\n\n*(Raw deliberation round transcript omitted to conserve tokens. Full unabridged discussion rounds available at `{}`)*\n\n{}",
                before, display_path, after
            );
        }
    }
    doc.to_string()
}

/// Synthesizes the Token-0 prioritized Markdown handoff document, evaluating cross-model cognitive
/// cache digests, epistemic policy, breakpoint recovery state, peer directives, and shared memory.
pub fn assemble_task_handoff_package(
    req: &AgentTaskRequest,
    effective_ws: &str,
    existing_tasks: &[AgentTaskRecord],
) -> PreparedHandoffPackage {
    let ws_path = Path::new(effective_ws);
    let instructions = runner::intent_instructions(&req.intent, req.custom_prompt.as_deref());
    let shared_memory = if req.attach_shared_memory {
        checkpoint::read_project_memory(effective_ws)
    } else {
        String::new()
    };

    let is_token_saver_on = matches!(
        req.token_saver.as_deref(),
        Some("standard") | Some("strict")
    );

    let raw_body = if let Some(ref items) = req.selected_checklist_items {
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
                .unwrap_or_else(|| req.markdown_content.clone())
        }
    } else {
        req.selected_excerpt
            .clone()
            .unwrap_or_else(|| req.markdown_content.clone())
    };

    let body_to_process = if is_token_saver_on {
        strip_discussion_report_section_4(&raw_body, &req.file_path)
    } else {
        raw_body
    };

    let prior_failed = existing_tasks
        .iter()
        .find(|t| {
            t.workspace_path == effective_ws
                && (req.pipeline_id.is_none() || t.pipeline_id == req.pipeline_id)
        })
        .map(|t| t.status == "failed")
        .unwrap_or(false);

    let cognitive_pkt = crate::projects::cache::load_cognitive_packet(ws_path).or_else(|| {
        let live_digest = crate::projects::cache::scan_workspace_digest(ws_path, 48);
        if live_digest.is_empty() {
            None
        } else {
            Some(crate::projects::cache::CognitiveHandoffPacket {
                producer_agent: "workspace-indexer".to_string(),
                producer_role: "Baseline".to_string(),
                workspace_digest: live_digest,
                ..Default::default()
            })
        }
    });

    let is_first_step = req.source_agent_id.is_none();
    let epistemic_decision =
        crate::discussion::epistemic::evaluate_pipeline_epistemic_policy_with_override(
            &req.intent,
            is_first_step,
            ws_path,
            cognitive_pkt.as_ref(),
            prior_failed,
            req.epistemic_policy.as_deref(),
        );
    let warm_cli_continue = crate::discussion::epistemic::can_reuse_cli_session_continuously(
        &epistemic_decision,
        &req.target_agent_id,
        req.pipeline_id.as_deref(),
        cognitive_pkt.as_ref(),
        now_ms(),
    );

    let agent_has_read_tool = matches!(
        req.target_agent_id.as_str(),
        "claude-code" | "antigravity" | "opencode" | "codex"
    );

    let epistemic_section = crate::discussion::epistemic::build_epistemic_prompt_section_with_mode(
        &epistemic_decision,
        ws_path,
        cognitive_pkt.as_ref(),
        agent_has_read_tool,
        is_token_saver_on,
    );
    let handoff_footer = crate::discussion::epistemic::format_handoff_state_emission_protocol(
        epistemic_decision.requires_blind_self_conclusion(),
    );

    let is_targeted_directive = req.intent == "fix-bugs"
        || req.resume_from_breakpoint
        || req
            .step_note
            .as_ref()
            .map(|p| !p.trim().is_empty())
            .unwrap_or(false);

    let is_warm_spec_reuse = if is_token_saver_on && warm_cli_continue && req.pipeline_id.is_some() {
        existing_tasks.iter().any(|t| {
            t.pipeline_id == req.pipeline_id
                && t.target_agent_id == req.target_agent_id
                && t.file_path == req.file_path
                && t.status == "completed"
        })
    } else {
        false
    };

    let body_for_prompt = if is_warm_spec_reuse {
        format!(
            "*(Project specification body already loaded in active warm session context. Inspect `{}` if needed)*",
            req.file_path
        )
    } else {
        body_to_process.trim().to_string()
    };

    let resolved_resume_session_id = if req.resume_from_breakpoint {
        req.resume_session_id.clone().or_else(|| {
            req.previous_failed_task_id.as_ref().and_then(|prev_id| {
                existing_tasks
                    .iter()
                    .find(|t| &t.id == prev_id && t.target_agent_id == req.target_agent_id)
                    .and_then(|t| t.cli_session_id.clone())
            })
        })
    } else {
        None
    };

    let breakpoint_audit_section = if req.resume_from_breakpoint {
        let live_digest = crate::projects::cache::scan_workspace_digest(ws_path, 64);
        let existing_list: Vec<String> = live_digest
            .values()
            .map(|d| {
                format!(
                    "- `{}` ({} lines, {} bytes, SHA-256: `{}`)",
                    d.rel_path,
                    d.lines,
                    d.bytes,
                    &d.sha256[..12.min(d.sha256.len())]
                )
            })
            .collect();
        let existing_keys: Vec<String> = live_digest.keys().cloned().collect();
        let v_check = verify::verify_deliverables(
            ws_path,
            &existing_keys,
            &req.intent,
            &body_to_process,
        );
        let gaps_md = if v_check.gaps.is_empty() {
            "- Complete any remaining unbuilt files or unfinished modules specified in the contract."
                .to_string()
        } else {
            v_check
                .gaps
                .iter()
                .map(|g| format!("- {}", g))
                .collect::<Vec<_>>()
                .join("\n")
        };
        format!(
            "## BREAKPOINT RESUME DIRECTIVE (CONTINUING FROM LAST BREAKPOINT)\n\n\
             - **Recovery Mode**: `CONTINUE_FROM_BREAKPOINT` (User elected to preserve existing workspace files and continue from the interruption point)\n\
             - **CRITICAL INSTRUCTION**: Do NOT delete or rewrite from scratch files that are already complete and valid on disk. Inspect any partially written files, keep completed work intact, and immediately finish the remaining/missing deliverables listed below.\n\n\
             ### Existing Workspace Files Currently on Disk:\n{}\n\n\
             ### Remaining Deliverables & Verification Gaps to Complete Now:\n{}\n\n---\n\n",
            if existing_list.is_empty() {
                "- *(No deliverable files flushed to disk before interruption — start writing the required files immediately)*".to_string()
            } else {
                existing_list.join("\n")
            },
            gaps_md
        )
    } else {
        String::new()
    };

    let role_header_title = match req.intent.as_str() {
        "refine-plan" => "ACTIVE PIPELINE ROLE: PLANNING & ARCHITECTURE SPECIFICATION ONLY (DO NOT WRITE CODE FILES)",
        "build" => "ACTIVE PIPELINE ROLE: CODE IMPLEMENTATION & DELIVERABLE BUILDER",
        "review" => "ACTIVE PIPELINE ROLE: READ-ONLY QA AUDIT & ARCHITECTURAL REVIEW",
        "fix-bugs" => "PRIORITY MISSION DIRECTIVES & TARGET BUG REPORT",
        "write-tests" => "ACTIVE PIPELINE ROLE: AUTOMATED TEST ENGINEERING & VERIFICATION",
        "explain" => "ACTIVE PIPELINE ROLE: READ-ONLY EXPLANATION & DOCUMENTATION",
        _ => "ACTIVE AGENT MISSION DIRECTIVES",
    };

    let mut handoff_content = String::new();

    if is_targeted_directive {
        handoff_content.push_str(&format!(
            "# {}\n\n\
             - **Target Agent**: `{}`\n\
             - **Source Agent**: `{}`\n\
             - **Intent Mode**: `{}`\n\
             - **Epistemic Mode**: `{}`\n\
             - **Workspace Path**: `{}`\n\n\
             ### Mission Directives & Instructions to Execute:\n{}\n\n\
             ---\n\n",
            role_header_title,
            req.target_agent_id,
            req.source_agent_id.as_deref().unwrap_or("User"),
            req.intent,
            epistemic_decision.mode.as_label(),
            effective_ws,
            instructions
        ));
        if !breakpoint_audit_section.is_empty() {
            handoff_content.push_str(&breakpoint_audit_section);
        }
        handoff_content.push_str(&epistemic_section);
        handoff_content.push_str("\n---\n\n");
        handoff_content.push_str(&format!(
            "# Project Specification & Reference Contract (`{}`)\n\n{}\n\n---\n\n",
            req.file_name,
            body_for_prompt
        ));
    } else {
        handoff_content.push_str(&format!(
            "# {}\n\n\
             - **Target Agent**: `{}`\n\
             - **Source Agent**: `{}`\n\
             - **Intent Mode**: `{}`\n\
             - **Epistemic Mode**: `{}`\n\
             - **Workspace Path**: `{}`\n\n\
             ### Strict Role Boundary & Instructions:\n{}\n\n\
             ---\n\n",
            role_header_title,
            req.target_agent_id,
            req.source_agent_id.as_deref().unwrap_or("User"),
            req.intent,
            epistemic_decision.mode.as_label(),
            effective_ws,
            instructions
        ));
        if !breakpoint_audit_section.is_empty() {
            handoff_content.push_str(&breakpoint_audit_section);
        }
        handoff_content.push_str(&format!(
            "# FlyMD Immutable Project Specification & Contract (`{}`)\n\n{}\n\n---\n\n",
            req.file_name,
            body_for_prompt
        ));
        handoff_content.push_str(&epistemic_section);
        handoff_content.push_str("\n---\n\n");
    }

    if let Some(ref pkt) = cognitive_pkt {
        let inbox = crate::projects::cache::filter_peer_messages_for_agent(
            &pkt.peer_messages,
            &req.target_agent_id,
            &req.intent,
        );
        if !inbox.is_empty() {
            handoff_content.push_str("## Direct Peer Directives Addressed to You\n\n");
            for pm in inbox.iter().rev().take(6).rev() {
                handoff_content.push_str(&format!(
                    "- From **{} ({})** [{}]: {}\n",
                    pm.from_agent, pm.from_role, pm.kind, pm.message
                ));
            }
            handoff_content.push_str("\n---\n\n");
        }
    }

    if !shared_memory.is_empty() && !epistemic_decision.requires_blind_self_conclusion() {
        handoff_content.push_str("## Shared Project Memory Context\n\n");
        handoff_content.push_str(&shared_memory);
        handoff_content.push_str("\n\n---\n\n");
    }

    if !is_targeted_directive && !is_token_saver_on {
        handoff_content.push_str(&format!(
            "## Active Agent Mission Metadata & Instructions\n\n\
             - **Target Agent**: `{}`\n\
             - **Source Agent**: `{}`\n\
             - **Intent Mode**: `{}`\n\
             - **Epistemic Mode**: `{}`\n\
             - **Workspace Path**: `{}`\n\n\
             {}\n",
            req.target_agent_id,
            req.source_agent_id.as_deref().unwrap_or("User"),
            req.intent,
            epistemic_decision.mode.as_label(),
            effective_ws,
            instructions
        ));
    }
    handoff_content.push_str(&format!("{}\n", handoff_footer));

    let (total_checklists, completed_checklists) = count_markdown_checklists(&body_to_process);

    let epistemic_log_line = format!(
        "[Epistemic Router] Mode: {} | Cache-Verified Files: {} | Targeted Re-Read Files: {}{}",
        epistemic_decision.mode.as_label(),
        epistemic_decision.unchanged_verified_files.len(),
        epistemic_decision.files_to_reread.len(),
        if warm_cli_continue {
            " | Warm CLI Session Reuse: ENABLED"
        } else {
            ""
        }
    );

    PreparedHandoffPackage {
        instructions,
        body_to_process,
        handoff_content,
        resolved_resume_session_id,
        total_checklists,
        completed_checklists,
        epistemic_log_line,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_discussion_report_section_4() {
        let sample_report = "\
# Multi-Agent Architectural Deliberation Report (v1)

## 1. Original Idea and User Goals
Build caching layer.

## 2. Key Requirements and Constraints
- High throughput

## 3. Summary of Each Agent's Contribution
- Architect: turn 1

## 4. Main Arguments, Critiques, Replies, and Revisions

<!-- flymd-round:1:executed -->
<details>
<summary>Round 1 Deliberation Summary</summary>
#### Step 1. Architect Agent
This is a huge 10,000 token transcript of every turn.
</details>

## 5. Points of Agreement [Agent Consensus]

| Decision Topic | Agreed Approach |
| :--- | :--- |
| Caching | In-memory LRU |

## 6. Unresolved Disagreements
None.
";

        let stripped = strip_discussion_report_section_4(sample_report, "reports/ConsensusReport-v1.md");
        assert!(!stripped.contains("This is a huge 10,000 token transcript"));
        assert!(stripped.contains("## 4. Main Arguments, Critiques, Replies, and Revisions"));
        assert!(stripped.contains("*(Raw deliberation round transcript omitted to conserve tokens. Full unabridged discussion rounds available at `reports/ConsensusReport-v1.md`)*"));
        assert!(stripped.contains("## 5. Points of Agreement [Agent Consensus]"));
        assert!(stripped.contains("Build caching layer."));
    }
}

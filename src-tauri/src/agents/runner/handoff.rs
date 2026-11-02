//! Cognitive handoff state persistence, fallback report formatting, and task finalization.

use crate::agents::checkpoint;
use crate::agents::types::now_ms;
use crate::store::SharedStore;
use std::path::Path;
use tauri::{AppHandle, Emitter};

/// Synthesizes a structured Markdown summary report when an agent CLI produces file edits without stdout prose.
pub fn format_fallback_execution_summary(
    agent_name: &str,
    file_name: &str,
    final_status: &str,
    exec_dir: &str,
    effective_files_to_report: &[String],
    verification_summary: &str,
) -> String {
    format!(
        "## {} — Execution Summary (`{}`)\n\nAgent execution finished with status: **{}** in `{}`.\n\n### Workspace Files Touched:\n{}\n\n### Verification Summary:\n{}\n",
        agent_name,
        file_name,
        final_status,
        exec_dir,
        effective_files_to_report
            .iter()
            .map(|f| format!("- `{}`", f))
            .collect::<Vec<_>>()
            .join("\n"),
        verification_summary
    )
}

/// Persists SHA-256 workspace digests, `<independent_resume>`, invariants, and `@Role` peer directives
/// into `.flymd/cache/cognitive_state.json` and appends a compact verified entry to `.flymd/MEMORY.md`.
#[allow(clippy::too_many_arguments)]
pub fn persist_task_cognitive_handoff(
    exec_dir: &str,
    agent_id: &str,
    intent: &str,
    pipeline_id: Option<&str>,
    original_contract: &str,
    raw_output_md: &str,
    used_cli_agent_id: Option<&str>,
    touched_files: &[String],
) -> String {
    let ws_path = Path::new(exec_dir);
    let parsed = crate::projects::cache::parse_handoff_blocks_from_markdown(
        raw_output_md,
        agent_id,
        intent,
    );
    let step_num = if original_contract.contains("## Upstream Compact Delta") {
        2
    } else {
        1
    };
    let pkt = crate::projects::cache::update_workspace_cognitive_cache_with_parsed(
        ws_path,
        agent_id,
        intent,
        pipeline_id,
        step_num,
        Some(original_contract),
        parsed.clone(),
        true,
        used_cli_agent_id,
    );

    let mut mem_entry = format!(
        "### [{}] Completed `{}` via `{}` (Verified Files: {})\n",
        now_ms(),
        intent,
        agent_id,
        pkt.workspace_digest.len()
    );
    if !touched_files.is_empty() {
        mem_entry.push_str(&format!(
            "- **Touched Files**: {}\n",
            touched_files
                .iter()
                .take(8)
                .map(|f| format!("`{}`", f))
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }
    if let Some(ref resume) = parsed.independent_resume {
        let short_res: String = resume.lines().take(3).collect::<Vec<_>>().join(" ");
        mem_entry.push_str(&format!("- **Independent Audit Conclusion**: {}\n", short_res));
    }
    checkpoint::append_project_memory(exec_dir, &mem_entry);

    parsed.clean_markdown
}

/// Transitions a task to its terminal status (`completed`, `incomplete`, `failed`, or `cancelled`),
/// persists immediately to disk, and broadcasts `agent:tasks-updated`.
pub fn finalize_task(
    store: &SharedStore,
    app: &AppHandle,
    task_id: &str,
    status: &str,
    error: Option<String>,
) {
    let status_str = status.to_string();
    if let Some(Some(all_tasks)) = store.mutate_agent_task(task_id, true, true, |t| {
        t.status = status_str;
        t.completed_at = Some(now_ms());
        if status == "completed" {
            t.progress_stage = Some("completed".to_string());
            t.progress_percent = 100;
            if t.checklist_total > 0 {
                t.checklist_completed = t.checklist_total;
            }
        }
        if let Some(err) = error {
            t.error = Some(err);
        }

        // Compute and persist fine-grained token usage telemetry if not already set
        if t.token_usage.is_none() {
            let prompt_chars = t.custom_prompt.as_deref().map(|p| p.chars().count()).unwrap_or(300)
                + t.file_path.chars().count();
            let prompt_tokens = ((prompt_chars as f64) / 3.8).ceil() as u32;

            let resp_chars = t.response_markdown.as_deref().map(|r| r.chars().count()).unwrap_or(0);
            let completion_tokens = ((resp_chars as f64) / 3.8).ceil() as u32;

            let reasoning_chars: usize = t.thinking_trace.iter().map(|s| s.chars().count()).sum();
            let reasoning_tokens = ((reasoning_chars as f64) / 3.8).ceil() as u32;

            t.token_usage = Some(crate::discussion::types::TokenUsage {
                prompt_tokens,
                completion_tokens,
                reasoning_tokens,
                total_tokens: prompt_tokens + completion_tokens + reasoning_tokens,
            });
        }
    }) {
        app.emit("agent:tasks-updated", &all_tasks).ok();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agents::runner::build_cli_prompt_for_intent;
    use std::fs;

    #[test]
    fn test_persist_task_cognitive_handoff_updates_cache_and_strips_envelope() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_test_handoff_cache_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();
        fs::write(
            temp_dir.join("index.html"),
            "<!DOCTYPE html><html><body><canvas id=\"mainCanvas\"></canvas></body></html>",
        )
        .unwrap();

        let raw_md = "## Review Report\n<independent_resume>Verified `#mainCanvas` exists on disk.</independent_resume>\n- @Implementer: Keep 60fps loop pure.\n<handoff_state>{\"confidence\":\"high\",\"lockedInvariants\":[\"60fps canvas loop\"],\"peerMessages\":[{\"toRole\":\"Implementer\",\"kind\":\"directive\",\"message\":\"Bind to #mainCanvas\"}]}</handoff_state>";

        let cleaned = persist_task_cognitive_handoff(
            temp_dir.to_str().unwrap(),
            "claude-code",
            "review",
            Some("pipe-42"),
            "# Original Spec",
            raw_md,
            Some("claude-code"),
            &["index.html".to_string()],
        );

        assert!(!cleaned.contains("<handoff_state>"));
        let pkt = crate::projects::cache::load_cognitive_packet(&temp_dir).unwrap();
        assert!(pkt.workspace_digest.contains_key("index.html"));
        assert_eq!(pkt.last_cli_agent_id.as_deref(), Some("claude-code"));
        assert!(!pkt.independent_resumes.is_empty());
        assert!(!pkt.peer_messages.is_empty());

        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn test_verify_deliverables_detects_missing_companions_and_stubs() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_test_verify_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let html = r#"<!DOCTYPE html><html><head></head><body><button id="runBtn">Run</button><script src="app.js"></script></body></html>"#;
        fs::write(temp_dir.join("index.html"), html.as_bytes()).unwrap();

        let report = crate::agents::verify::verify_deliverables(
            &temp_dir,
            &["index.html".to_string()],
            "build",
            "",
        );
        assert!(!report.passed);
        assert!(report.gaps.iter().any(|g| g.contains("app.js")));

        let stub_js = r#"/** FlyMD Automated Companion Logic Engine */ (function() { console.log('Action triggered: runBtn'); })();"#;
        fs::write(temp_dir.join("app.js"), stub_js.as_bytes()).unwrap();

        let report2 = crate::agents::verify::verify_deliverables(
            &temp_dir,
            &["index.html".to_string(), "app.js".to_string()],
            "build",
            "",
        );
        assert!(!report2.passed);
        assert!(report2
            .gaps
            .iter()
            .any(|g| g.contains("placeholder") || g.contains("stub")));

        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn test_role_isolation_between_refine_plan_and_build() {
        let plan_prompt = build_cli_prompt_for_intent(
            "refine-plan",
            "Project_Dedicated_Pipeline_Contract.md",
            "Pipeline [Project Dedicated Pipeline] — Step 1/2 (Plan)",
            "C:\\ws\\.flymd\\handoffs\\task-1.md",
            "C:\\ws",
            "",
        );
        assert!(plan_prompt.contains("PLANNING & ARCHITECTURE SPECIFICATION MODE ONLY"));
        assert!(plan_prompt.contains(
            "STRICT ROLE BOUNDARY PROHIBITION: DO NOT create, write, or modify any application source code files"
        ));
        assert!(!plan_prompt.contains("CRITICAL BUG FIX"));

        let build_prompt = build_cli_prompt_for_intent(
            "build",
            "Project_Dedicated_Pipeline_Contract.md",
            "Pipeline [Project Dedicated Pipeline] — Step 2/2 (Build)",
            "C:\\ws\\.flymd\\handoffs\\task-2.md",
            "C:\\ws",
            "",
        );
        assert!(build_prompt.contains("CODE IMPLEMENTATION & BUILD MODE"));
        assert!(build_prompt.contains("write the FULL, WORKING, UNTRUNCATED CODE files"));

        let temp_dir = std::env::temp_dir().join(format!("flymd_test_plan_verify_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let rep_empty =
            crate::agents::verify::verify_deliverables(&temp_dir, &[], "refine-plan", "");
        assert!(!rep_empty.passed);

        let plan_content = "# Implementation Plan\n\n## Architecture\n- Module A\n- Module B\n\n## Checklist\n- [ ] Build index.html\n- [ ] Build styles.css\n- [ ] Build app.js with full simulation logic and state reducer.\n";
        fs::write(
            temp_dir.join("Project_Dedicated_Pipeline_Contract.md"),
            plan_content.as_bytes(),
        )
        .unwrap();
        let rep_ok = crate::agents::verify::verify_deliverables(
            &temp_dir,
            &["Project_Dedicated_Pipeline_Contract.md".to_string()],
            "refine-plan",
            "",
        );
        assert!(rep_ok.passed);

        fs::remove_dir_all(&temp_dir).ok();
    }
}

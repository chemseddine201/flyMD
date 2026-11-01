//! Hard role-boundary guard, premature file pruning, and plan normalization.

use super::code_blocks::extract_and_write_code_blocks;
use super::prompts::resolve_plan_markdown_filename;
use crate::projects::cache::WorkspaceFileDigest;
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

/// Enforces role boundary invariants:
/// - In `refine-plan`, prunes any newly created source code files, normalizes checklists to `- [ ]`,
///   and ensures the plan deliverable is synchronized to disk.
/// - In `build` / `fix-bugs` / `write-tests`, extracts fenced code blocks and writes them to disk.
pub fn enforce_role_boundary_and_plan_sync(
    intent: &str,
    file_name: &str,
    exec_dir: &str,
    agent_id: &str,
    created_files: &mut Vec<String>,
    pre_digests: &BTreeMap<String, WorkspaceFileDigest>,
    collected_md: &mut String,
    emit_log: &dyn Fn(String),
) {
    if intent == "refine-plan" {
        // Hard Role Boundary Guard for `refine-plan`:
        // Remove any newly created source code files (.html, .css, .js, .ts, etc.) that did not exist before this planning step.
        for cf in created_files.iter() {
            let lower = cf.to_lowercase();
            let is_code_file = lower.ends_with(".html")
                || lower.ends_with(".htm")
                || lower.ends_with(".css")
                || lower.ends_with(".js")
                || lower.ends_with(".mjs")
                || lower.ends_with(".cjs")
                || lower.ends_with(".ts")
                || lower.ends_with(".jsx")
                || lower.ends_with(".tsx")
                || lower.ends_with(".py")
                || lower.ends_with(".rs")
                || lower.ends_with(".php");
            if is_code_file && !pre_digests.contains_key(cf) {
                let premature_path = Path::new(exec_dir).join(cf);
                if fs::remove_file(&premature_path).is_ok() {
                    emit_log(format!(
                        "[Role Boundary Guard] Removed premature code file `{}` created during `refine-plan` step; code creation is strictly reserved for the `build` step.",
                        cf
                    ));
                }
            }
        }
        created_files.retain(|f| f.to_lowercase().ends_with(".md"));

        // Guarantee that the detailed `.md` implementation plan is saved to the workspace root
        let target_plan_file = resolve_plan_markdown_filename(file_name);
        let target_plan_path = Path::new(exec_dir).join(&target_plan_file);

        // Check if any .md file was actually modified on disk during this step
        let mut md_plan_on_disk: Option<(String, String)> = None;
        for cf in created_files.iter() {
            let p = Path::new(exec_dir).join(cf);
            if let Ok(disk_md) = fs::read_to_string(&p) {
                if disk_md.trim().len() >= 150 {
                    // Ensure checklist items in the plan are unchecked `- [ ]` ready for the Build step
                    let normalized_md = disk_md
                        .replace("- [x] ", "- [ ] ")
                        .replace("- [X] ", "- [ ] ")
                        .replace("* [x] ", "* [ ] ")
                        .replace("* [X] ", "* [ ] ");
                    if normalized_md != disk_md {
                        let _ = fs::write(&p, normalized_md.as_bytes());
                    }
                    md_plan_on_disk = Some((cf.clone(), normalized_md));
                    break;
                }
            }
        }

        if let Some((_md_name, disk_md_content)) = md_plan_on_disk {
            if collected_md.trim().len() < disk_md_content.trim().len() {
                *collected_md = disk_md_content;
            }
        } else if collected_md.trim().len() >= 100 {
            let parsed_clean =
                crate::projects::cache::parse_handoff_blocks_from_markdown(collected_md, agent_id, intent)
                    .clean_markdown;
            let normalized_plan = parsed_clean
                .replace("- [x] ", "- [ ] ")
                .replace("- [X] ", "- [ ] ")
                .replace("* [x] ", "* [ ] ")
                .replace("* [X] ", "* [ ] ");
            if fs::write(&target_plan_path, normalized_plan.as_bytes()).is_ok() {
                emit_log(format!(
                    "[Plan Deliverable Sync] Saved detailed Markdown implementation plan to `{}` ({} bytes)",
                    target_plan_file,
                    normalized_plan.len()
                ));
                if !created_files.contains(&target_plan_file) {
                    created_files.push(target_plan_file);
                }
            }
        }
    } else if matches!(intent, "build" | "fix-bugs" | "write-tests" | "custom") {
        for cf in extract_and_write_code_blocks(exec_dir, file_name, collected_md) {
            if !created_files.contains(&cf) {
                created_files.push(cf);
            }
        }
    }
}


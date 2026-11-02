//! Intent instructions, role boundaries, and CLI prompt construction.

use crate::common::{compose_smart_deliverable_name, DeliverableNamingContext};
use std::path::Path;

pub fn intent_instructions(intent: &str, custom_prompt: Option<&str>) -> String {
    if let Some(cp) = custom_prompt {
        if !cp.trim().is_empty() && intent == "custom" {
            return cp.trim().to_string();
        }
    }
    let base = match intent {
        "build" => "ROLE: CODE IMPLEMENTER (`build`). Read the attached Markdown implementation plan carefully. Create and implement all required application code files (HTML, CSS, JS, TS, etc.) step-by-step on disk in the workspace. When finished, output a concise completion summary report.",
        "review" => "ROLE: QA AUDITOR (`review`). Audit the Markdown specification and the corresponding workspace code implementation in read-only mode. Identify any bugs, architectural issues, broken DOM bindings, or missing edge cases, and write a comprehensive Markdown audit report. Do NOT overwrite application source code files.",
        "fix-bugs" => "ROLE: BUG REMEDIATION ENGINEER (`fix-bugs`). Diagnose the issue or bug described in this directive and Markdown specification. Locate the exact root cause in the workspace code files, apply a clean fix directly to disk, verify integrity, and write a concise fix report.",
        "refine-plan" => "ROLE: LEAD ARCHITECT & PLANNER (`refine-plan`). Refine and expand this specification into a comprehensive, detailed Markdown implementation plan (`.md` file) saved directly in the workspace. Include system architecture flowcharts, exact file/module breakdown, DOM IDs & component contracts, mathematical/domain formulas, unchecked `- [ ]` implementation checklist steps, and clear acceptance criteria. STRICT PROHIBITION: Do NOT create, write, or modify any application code files (`.html`, `.css`, `.js`, `.ts`, `.py`, `.rs`) during this planning step—code implementation is strictly reserved for the subsequent `build` step.",
        "write-tests" => "ROLE: TEST ENGINEER (`write-tests`). Write automated tests for the features described in this Markdown specification, execute the test suite, and document the test results.",
        "explain" => "ROLE: TECHNICAL COMMUNICATOR (`explain`). Explain the contents, architecture, and impact of this Markdown document and workspace in clear, structured language with visual bullet points. Do NOT modify application code files.",
        _ => "Execute the instructions in this Markdown document according to your assigned role.",
    };
    if let Some(cp) = custom_prompt {
        if !cp.trim().is_empty() {
            return format!("{}\n\nPipeline Step Context: {}", base, cp.trim());
        }
    }
    base.to_string()
}

/// Resolves the canonical target `.md` filename in the workspace for a `refine-plan` step.
pub fn resolve_plan_markdown_filename(file_name: &str) -> String {
    resolve_plan_markdown_filename_with_context(file_name, None, None)
}

/// Resolves a context-aware target `.md` filename in the workspace for a `refine-plan` step.
pub fn resolve_plan_markdown_filename_with_context(
    file_name: &str,
    topic_or_prompt: Option<&str>,
    project_name: Option<&str>,
) -> String {
    let trimmed = file_name.trim();
    if trimmed.to_lowercase().ends_with(".md")
        && !trimmed.eq_ignore_ascii_case("plan.md")
        && !trimmed.eq_ignore_ascii_case("implementation_plan.md")
        && !trimmed.starts_with("Entire Project")
        && !trimmed.starts_with("Untitled")
        && !trimmed.contains('/')
        && !trimmed.contains('\\')
    {
        trimmed.to_string()
    } else {
        let ctx = DeliverableNamingContext {
            project_name,
            subproject_name: None,
            topic_or_prompt,
            intent_or_kind: "plan",
            fallback_name: Some("IMPLEMENTATION_PLAN.md"),
        };
        compose_smart_deliverable_name(&ctx)
    }
}

/// Builds a strictly role-isolated CLI `-p` prompt based on `intent`.
pub fn build_cli_prompt_for_intent(
    intent: &str,
    file_name: &str,
    custom_directive: &str,
    handoff_file_path: &str,
    exec_dir: &str,
    epistemic_cli_clause: &str,
) -> String {
    match intent {
        "refine-plan" => {
            let target_plan_file = resolve_plan_markdown_filename_with_context(
                file_name,
                if custom_directive.trim().is_empty() {
                    None
                } else {
                    Some(custom_directive)
                },
                None,
            );
            let target_plan_path = Path::new(exec_dir).join(&target_plan_file);
            format!(
                "PLANNING & ARCHITECTURE SPECIFICATION MODE ONLY (Intent: `refine-plan`).\n\
                 Step Context: \"{}\"\n\
                 Read the project specification written in UTF-8 at \"{}\" in workspace \"{}\".\n\
                 Your SOLE deliverable in this step is to author and write a comprehensive, detailed Markdown implementation plan in UTF-8 directly to \"{}\".\n\
                 The Markdown implementation plan MUST contain:\n\
                 1. Executive Summary & Domain/Pedagogical Objectives\n\
                 2. Architectural Blueprint & Mermaid Diagrams (`flowchart TD`, `stateDiagram-v2`)\n\
                 3. Exact File Structure & Module Contracts (exact filenames to be built in the next step, DOM element IDs, CSS architecture, state machine reducers, formulas, and error-boundary guards)\n\
                 4. Actionable Step-by-Step Implementation Checklist using UNCHECKED `- [ ]` items (leave all items unchecked `- [ ]` so the subsequent Build step implements them)\n\
                 5. Explicit Acceptance Criteria & Verification Gates.\n\
                 STRICT ROLE BOUNDARY PROHIBITION: DO NOT create, write, or modify any application source code files (.html, .css, .js, .ts, .jsx, .tsx, .py, .rs, .php) during this Planning step! Creating code files is strictly reserved for the subsequent Build step. Write ONLY the `.md` implementation plan file (`{}`). Do NOT ask for confirmation.",
                custom_directive,
                handoff_file_path,
                exec_dir,
                target_plan_path.to_string_lossy(),
                target_plan_file
            )
        }
        "review" => format!(
            "READ-ONLY QA AUDIT & ARCHITECTURAL REVIEW MODE (Intent: `review`).\n\
             Step Context: \"{}\"\n\
             Inspect the workspace files in \"{}\" against the specification written in UTF-8 at \"{}\". {}\n\
             Identify any bugs, missing requirements, incomplete files, broken DOM bindings, or edge-case vulnerabilities, and output a comprehensive Markdown audit report.\n\
             STRICT ROLE BOUNDARY: Do NOT overwrite or delete working application code files during this Review step. Do NOT ask for confirmation.",
            custom_directive,
            exec_dir,
            handoff_file_path,
            epistemic_cli_clause
        ),
        "explain" => format!(
            "READ-ONLY EXPLANATION & DOCUMENTATION MODE (Intent: `explain`).\n\
             Step Context: \"{}\"\n\
             Read the specification at \"{}\" and inspect workspace \"{}\".\n\
             Output a clear, well-structured Markdown explanation. Do NOT modify application code files.",
            custom_directive,
            handoff_file_path,
            exec_dir
        ),
        "fix-bugs" => format!(
            "CRITICAL BUG FIX & REMEDIATION MODE (Intent: `fix-bugs`).\n\
             Target Bug / Directive: \"{}\"\n\
             Execute the fix specification written in UTF-8 at \"{}\" directly in workspace \"{}\". {}\n\
             Inspect the suspect files on disk (app.js, index.html, styles.css, etc.), diagnose the exact root cause, and write the corrected code directly to the files in \"{}\". Do NOT ask for confirmation. Apply the fix immediately.",
            custom_directive,
            handoff_file_path,
            exec_dir,
            epistemic_cli_clause,
            exec_dir
        ),
        "write-tests" => format!(
            "AUTOMATED TEST ENGINEERING MODE (Intent: `write-tests`).\n\
             Step Context: \"{}\"\n\
             Execute the test specification written in UTF-8 at \"{}\" in workspace \"{}\". {}\n\
             Create and run the required test files in \"{}\" and output a comprehensive Markdown test verification report. Do NOT ask for confirmation.",
            custom_directive,
            handoff_file_path,
            exec_dir,
            epistemic_cli_clause,
            exec_dir
        ),
        _ => {
            let directive_prefix = if !custom_directive.is_empty() {
                format!("Step Directive: \"{}\"\n", custom_directive)
            } else {
                String::new()
            };
            format!(
                "CODE IMPLEMENTATION & BUILD MODE (Intent: `{}`).\n\
                 {}Execute the implementation plan and task specification written in UTF-8 at \"{}\" directly in workspace \"{}\". {}\n\
                 Create, write, or modify all required application code files inside \"{}\" strictly following the implementation plan in the workspace.\n\
                 INCREMENTAL FILE-BY-FILE EXECUTION: Write each deliverable file in a separate, sequential tool call (1. write index.html first, 2. write styles.css second, 3. write app.js third) so each file is immediately flushed to disk as a verified checkpoint. Do NOT buffer all files into a single monolithic turn.\n\
                 SPEED & TOKEN GUARD: Do NOT waste time or tokens running Bash backup scripts, Python scripts, headless browsers (Playwright/Chrome/Edge/CDP), or benchmark harnesses in %TEMP% during `build`, and do NOT read unrelated legacy files if overwriting with a fresh application. Write the target files directly using Write/Edit tools and exit immediately once all files are written.\n\
                 CRITICAL REQUIREMENT: For any interactive web application, UI, simulation, or tool, you MUST write the FULL, WORKING, UNTRUNCATED CODE files directly to disk in the workspace: index.html, styles.css, AND app.js (plus any modules specified in the plan). If index.html references app.js via <script src=\"app.js\">, you MUST create and write app.js completely to disk with all interactivity, calculations, and event handlers. Do NOT leave app.js missing or empty, and do NOT stop after writing only HTML or CSS. Execute all file writes immediately without asking for user confirmation.",
                intent,
                directive_prefix,
                handoff_file_path,
                exec_dir,
                epistemic_cli_clause,
                exec_dir
            )
        }
    }
}

pub fn extract_markdown_headings_and_tasks(content: &str) -> (Vec<String>, Vec<String>) {
    let mut headings = Vec::new();
    let mut tasks = Vec::new();
    for line in content.lines() {
        let t = line.trim();
        if t.starts_with('#') {
            let clean = t.trim_start_matches('#').trim().to_string();
            if !clean.is_empty() && headings.len() < 12 {
                headings.push(clean);
            }
        } else if t.starts_with("- [ ] ") || t.starts_with("* [ ] ") {
            let item = t[6..].trim().to_string();
            if !item.is_empty() && tasks.len() < 15 {
                tasks.push(item);
            }
        } else if (t.starts_with("- ") || t.starts_with("* ")) && tasks.len() < 10 {
            let item = t[2..].trim().to_string();
            if item.len() > 6 && !item.starts_with('[') {
                tasks.push(item);
            }
        }
    }
    (headings, tasks)
}


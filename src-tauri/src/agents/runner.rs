//! Agent execution runner: handles CLI subprocess streaming, markdown synthesis, and workspace sync.

use super::process_manager::ProcessTreeManager;
use super::types::{
    now_ms, AgentErrorDiagnostic, AgentStreamEvent, AgentTaskRecord, AgentToolAction,
};
use crate::store::SharedStore;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Parses language and optional filename attribute from markdown fence tags (e.g. ```javascript:app.js, ```js filename="app.js").
fn parse_fence_tag(tag_line: &str) -> (String, Option<String>) {
    let clean = tag_line.trim_start_matches('`').trim();
    if clean.is_empty() {
        return (String::new(), None);
    }

    if let Some((lang, name)) = clean.split_once(':') {
        let lang = lang.trim().to_lowercase();
        let name = name.trim().trim_matches(|c| c == '"' || c == '\'' || c == '`').to_string();
        if !name.is_empty() {
            return (lang, Some(name));
        }
    }

    let tokens: Vec<&str> = clean.split_whitespace().collect();
    let lang = tokens.first().map(|s| s.to_lowercase()).unwrap_or_default();

    for token in tokens.iter().skip(1) {
        if let Some((k, v)) = token.split_once('=') {
            let k_low = k.to_lowercase();
            if k_low == "filename" || k_low == "title" || k_low == "file" || k_low == "path" {
                let v_clean = v.trim_matches(|c| c == '"' || c == '\'' || c == '`').to_string();
                if !v_clean.is_empty() {
                    return (lang, Some(v_clean));
                }
            }
        } else if token.ends_with(".js")
            || token.ends_with(".css")
            || token.ends_with(".html")
            || token.ends_with(".ts")
            || token.ends_with(".json")
            || token.ends_with(".py")
        {
            let v_clean = token.trim_matches(|c| c == '"' || c == '\'' || c == '`' || c == '(' || c == ')').to_string();
            if !v_clean.is_empty() {
                return (lang, Some(v_clean));
            }
        }
    }

    (lang, None)
}

/// Checks up to 4 non-empty preceding lines for explicit filename cues (e.g. `### File: app.js`, `**app.js**`).
fn find_filename_in_preceding_lines(lines: &[&str], fence_idx: usize) -> Option<String> {
    let mut check_idx = fence_idx;
    let mut scanned = 0;
    while check_idx > 0 && scanned < 4 {
        check_idx -= 1;
        let line = lines[check_idx].trim();
        if line.is_empty() {
            continue;
        }
        scanned += 1;
        let stripped = line
            .trim_start_matches('#')
            .trim_start_matches(|c| c == '*' || c == '_' || c == '`' || c == '-')
            .trim_end_matches(|c| c == '*' || c == '_' || c == '`')
            .trim();

        for word in stripped.split_whitespace() {
            let clean_word = word.trim_matches(|c| c == '`' || c == '"' || c == '\'' || c == ':' || c == '(' || c == ')');
            if clean_word.ends_with(".js")
                || clean_word.ends_with(".css")
                || clean_word.ends_with(".html")
                || clean_word.ends_with(".ts")
                || clean_word.ends_with(".json")
                || clean_word.ends_with(".py")
            {
                let clean_name = clean_word.split('/').last().unwrap_or(clean_word).split('\\').last().unwrap_or(clean_word);
                return Some(clean_name.to_string());
            }
        }
    }
    None
}

/// Checks the first line inside a code block for inline comments specifying the filename (e.g. `// app.js`, `/* styles.css */`).
fn extract_filename_from_comment(first_line: &str) -> Option<String> {
    let trimmed = first_line.trim();
    let comment_body = if let Some(rest) = trimmed.strip_prefix("//") {
        rest.trim()
    } else if let Some(rest) = trimmed.strip_prefix("/*") {
        rest.trim_end_matches("*/").trim()
    } else if let Some(rest) = trimmed.strip_prefix('#') {
        rest.trim()
    } else if let Some(rest) = trimmed.strip_prefix("<!--") {
        rest.trim_end_matches("-->").trim()
    } else {
        return None;
    };

    for word in comment_body.split_whitespace() {
        let clean = word.trim_matches(|c| c == '`' || c == '"' || c == '\'' || c == ':' || c == '(' || c == ')');
        if clean.ends_with(".js")
            || clean.ends_with(".css")
            || clean.ends_with(".html")
            || clean.ends_with(".ts")
            || clean.ends_with(".json")
            || clean.ends_with(".py")
        {
            let name = clean.split('/').last().unwrap_or(clean).split('\\').last().unwrap_or(clean);
            return Some(name.to_string());
        }
    }
    None
}

/// Automatically detects and writes code blocks (html, css, js, ts, etc.) from markdown output into the workspace directory.
pub fn extract_and_write_code_blocks(
    workspace_dir: &str,
    file_name: &str,
    markdown: &str,
) -> Vec<String> {
    let mut created_files = Vec::new();
    let ws_path = Path::new(workspace_dir);
    if !ws_path.exists() {
        return created_files;
    }

    let lines: Vec<&str> = markdown.lines().collect();
    let mut i = 0;
    while i < lines.len() {
        let line = lines[i].trim();
        if line.starts_with("```") {
            let (lang, fence_filename) = parse_fence_tag(line);
            let ext = match lang.to_lowercase().as_str() {
                "html" | "htm" => Some("html"),
                "css" => Some("css"),
                "javascript" | "js" | "mjs" | "cjs" => Some("js"),
                "typescript" | "ts" => Some("ts"),
                "json" => Some("json"),
                "python" | "py" => Some("py"),
                _ => None,
            };

            if let Some(target_ext) = ext {
                let pre_filename = find_filename_in_preceding_lines(&lines, i);

                let mut block_content = String::new();
                let mut inner_first_line_filename: Option<String> = None;
                i += 1;
                let mut first_content_line = true;
                while i < lines.len() && !lines[i].trim().starts_with("```") {
                    let cur_line = lines[i];
                    if first_content_line && !cur_line.trim().is_empty() {
                        inner_first_line_filename = extract_filename_from_comment(cur_line.trim());
                        first_content_line = false;
                    }
                    block_content.push_str(cur_line);
                    block_content.push('\n');
                    i += 1;
                }

                if !block_content.trim().is_empty() {
                    let mut chosen_name = fence_filename
                        .or(pre_filename)
                        .or(inner_first_line_filename)
                        .unwrap_or_else(|| {
                            if target_ext == "html" {
                                if !created_files.contains(&"index.html".to_string()) && !ws_path.join("index.html").exists() {
                                    "index.html".to_string()
                                } else {
                                    format!("page_{}.html", created_files.len() + 1)
                                }
                            } else if target_ext == "css" {
                                if !created_files.contains(&"styles.css".to_string()) && !ws_path.join("styles.css").exists() {
                                    "styles.css".to_string()
                                } else {
                                    format!("styles_{}.css", created_files.len() + 1)
                                }
                            } else if target_ext == "js" {
                                if !created_files.contains(&"app.js".to_string()) && !ws_path.join("app.js").exists() {
                                    "app.js".to_string()
                                } else {
                                    format!("module_{}.js", created_files.len() + 1)
                                }
                            } else {
                                format!("output.{}", target_ext)
                            }
                        });

                    if file_name.ends_with(&format!(".{}", target_ext))
                        && !file_name.starts_with("Untitled")
                        && !file_name.starts_with("Entire Project")
                    {
                        chosen_name = file_name.to_string();
                    }

                    let dest = ws_path.join(&chosen_name);
                    let should_write = if dest.exists() {
                        match fs::read_to_string(&dest) {
                            Ok(existing) => existing != block_content,
                            Err(_) => true,
                        }
                    } else {
                        true
                    };

                    if should_write {
                        if fs::write(&dest, block_content.as_bytes()).is_ok() {
                            if !created_files.contains(&chosen_name) {
                                created_files.push(chosen_name);
                            }
                        }
                    } else {
                        if !created_files.contains(&chosen_name) {
                            created_files.push(chosen_name);
                        }
                    }
                }
            }
        }
        i += 1;
    }

    created_files
}

/// Scans workspace directory for files modified/created since task start (skipping hidden/.git/deps).
pub fn scan_workspace_modified_files(workspace_dir: &str, since_epoch_ms: i64) -> Vec<String> {
    let mut files = Vec::new();
    let ws_path = Path::new(workspace_dir);
    if !ws_path.exists() {
        return files;
    }

    fn walk(dir: &Path, base: &Path, since: i64, out: &mut Vec<String>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let fname = path.file_name().unwrap_or_default().to_string_lossy();
                if fname.starts_with('.') || fname == "node_modules" || fname == "target" || fname == "vendor" {
                    continue;
                }
                if path.is_dir() {
                    walk(&path, base, since, out);
                } else if path.is_file() {
                    if let Ok(meta) = path.metadata() {
                        if let Ok(mtime) = meta.modified() {
                            let mtime_ms = mtime
                                .duration_since(std::time::UNIX_EPOCH)
                                .map(|d| d.as_millis() as u64)
                                .unwrap_or(0);
                            if (mtime_ms as i64) + 5000 >= since {
                                if let Ok(rel) = path.strip_prefix(base) {
                                    out.push(rel.to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    walk(ws_path, ws_path, since_epoch_ms, &mut files);
    files
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
    let trimmed = file_name.trim();
    if trimmed.to_lowercase().ends_with(".md")
        && !trimmed.starts_with("Entire Project")
        && !trimmed.starts_with("Untitled")
        && !trimmed.contains('/')
        && !trimmed.contains('\\')
    {
        trimmed.to_string()
    } else {
        "IMPLEMENTATION_PLAN.md".to_string()
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
            let target_plan_file = resolve_plan_markdown_filename(file_name);
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
            // "build" and "custom"
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

pub fn spawn_agent_execution(
    store: SharedStore,
    app: AppHandle,
    record: AgentTaskRecord,
    handoff_file: std::path::PathBuf,
    report_file: std::path::PathBuf,
    instructions: String,
    source_markdown: String,
    cancel_flag: Arc<AtomicBool>,
    process_manager: ProcessTreeManager,
) {
    let profiles = super::discovery::discover_agent_profiles(&store.get_agent_credentials());
    let profile = profiles
        .into_iter()
        .find(|p| p.id == record.target_agent_id);
    let creds = store.get_agent_credentials();
    let user_cred = creds.get(&record.target_agent_id).cloned();

    std::thread::spawn(move || {
        let panic_task_id = record.id.clone();
        let panic_store = Arc::clone(&store);
        let panic_app = app.clone();

        let run_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(move || {
        let task_id = record.id.clone();
        let agent_id = record.target_agent_id.clone();
        let agent_name = profile
            .as_ref()
            .map(|p| p.name.clone())
            .unwrap_or_else(|| agent_id.clone());
        let exec_dir = record
            .worktree_path
            .clone()
            .unwrap_or_else(|| record.workspace_path.clone());

        let update_task = |mutator: &dyn Fn(&mut AgentTaskRecord)| {
            let mut tasks = store.get_agent_tasks();
            if let Some(t) = tasks.iter_mut().find(|t| t.id == task_id) {
                mutator(t);
            }
            store.save_agent_tasks(tasks.clone());
            app.emit("agent:tasks-updated", &tasks).ok();
        };

        let emit_log = |line: String| {
            let evt = AgentStreamEvent {
                task_id: task_id.clone(),
                agent_id: agent_id.clone(),
                line: line.clone(),
                timestamp: now_ms(),
            };
            app.emit("agent:stream", &evt).ok();
            update_task(&|t| {
                t.logs.push(line.clone());
            });
        };

        // Stage 2: Context & Workspace Sync
        std::thread::sleep(Duration::from_millis(220));
        if cancel_flag.load(Ordering::Relaxed) {
            finalize_task(&store, &app, &task_id, "cancelled", None);
            return;
        }
        update_task(&|t| {
            t.progress_stage = Some("context".to_string());
            t.progress_percent = 35;
        });

        let bin_path = profile
            .as_ref()
            .and_then(|p| p.detected_binary_path.clone())
            .filter(|b| {
                let lower = b.to_lowercase();
                matches!(
                    agent_id.as_str(),
                    "antigravity" | "claude-code" | "opencode" | "codex"
                ) && !lower.ends_with("antigravity.cmd")
                    && !lower.ends_with("cursor.exe")
                    && !lower.ends_with("zed.exe")
            });

        // Check if CLI runner is available for headless streaming
        if let Some(bin) = bin_path {
            emit_log(format!(
                "[CLI Engine] Streaming from {} ({})",
                agent_name, bin
            ));
            update_task(&|t| {
                t.progress_stage = Some("reasoning".to_string());
                t.progress_percent = 55;
                t.thinking_trace.push(format!(
                    "Connected to local {} CLI binary (`{}`). Streaming live response & writing workspace files...",
                    agent_name, bin
                ));
                let prompt_summary = instructions.lines().next().unwrap_or("Execute mission").to_string();
                t.tool_actions.push(AgentToolAction::with_details(
                    format!("tool-cli-{}", now_ms()),
                    "cli".to_string(),
                    format!("Running {} CLI in `{}`", agent_name, exec_dir),
                    Some(bin.clone()),
                    "running".to_string(),
                    now_ms(),
                    Some(format!("{} -p \"{}\"", bin, prompt_summary)),
                    None,
                    None,
                ));
            });

            let exec_path_ref = Path::new(&exec_dir);
            let pre_digests = crate::projects::cache::scan_workspace_digest(exec_path_ref, 64);
            let cached_pkt = crate::projects::cache::load_cognitive_packet(exec_path_ref);
            let epistemic_dec = crate::discussion::epistemic::evaluate_pipeline_epistemic_policy(
                &record.intent,
                record.source_agent_id.is_none(),
                exec_path_ref,
                cached_pkt.as_ref(),
                false,
            );
            let warm_cli_continue =
                crate::discussion::epistemic::can_reuse_cli_session_continuously(
                    &epistemic_dec,
                    &agent_id,
                    record.pipeline_id.as_deref(),
                    cached_pkt.as_ref(),
                    now_ms(),
                );

            let epistemic_cli_clause = match epistemic_dec.mode {
                crate::discussion::epistemic::EpistemicMode::DirectInherit => {
                    "FAST-PATH COGNITIVE CACHE ACTIVE: The handoff package contains cryptographically verified SHA-256 file hashes, DOM IDs, and exported symbols. Do NOT waste turns running directory scans or re-reading untouched verified files; proceed directly to writing/updating target deliverables."
                }
                crate::discussion::epistemic::EpistemicMode::BlindIndependentAudit
                | crate::discussion::epistemic::EpistemicMode::GroundTruthRebuild => {
                    "BLIND INDEPENDENT AUDIT ACTIVE: Inspect raw workspace files on disk first, output an <independent_resume>...</independent_resume> summarizing actual on-disk code behavior before evaluating claims, and report or fix any missing logic."
                }
                _ => {
                    "Use the verified SHA-256 Workspace Digest in the handoff package to avoid redundant scans of unchanged files."
                }
            };

            let custom_err_directive = record
                .step_note
                .as_deref()
                .filter(|s| !s.trim().is_empty())
                .or(record.custom_prompt.as_deref())
                .unwrap_or("")
                .trim();

            let prompt_arg = build_cli_prompt_for_intent(
                &record.intent,
                &record.file_name,
                custom_err_directive,
                &handoff_file.to_string_lossy(),
                &exec_dir,
                epistemic_cli_clause,
            );

            let resume_sid = record.cli_session_id.clone().filter(|s| !s.trim().is_empty());
            let bin_lower = bin.to_lowercase();
            let raw_effort = record.effort_level.as_deref().unwrap_or("medium").to_lowercase();
            let effort_val = match raw_effort.as_str() {
                "low" | "medium" | "high" | "xhigh" | "max" => raw_effort.as_str(),
                _ => "medium",
            };
            let thinking_on = record.thinking_enabled.unwrap_or(true);

            emit_log(format!(
                "[Reasoning Config] Agent: {} | Effort: {} | Thinking: {}",
                agent_name,
                effort_val,
                if thinking_on { "ON" } else { "OFF" }
            ));

            let mut cmd = if bin_lower.ends_with(".cmd") || bin_lower.ends_with(".bat") {
                let mut c = Command::new("cmd.exe");
                if agent_id == "opencode" {
                    c.args(["/C", &bin, "run", &prompt_arg]);
                } else if agent_id == "antigravity" {
                    c.args([
                        "/C",
                        &bin,
                        "-p",
                        &prompt_arg,
                        "--dangerously-skip-permissions",
                        "--add-dir",
                        &exec_dir,
                        "--mode",
                        "accept-edits",
                        "--output-format",
                        "stream-json",
                    ]);
                    if thinking_on {
                        c.args(["--effort", effort_val]);
                    } else {
                        c.args(["--effort", "low"]);
                    }
                } else if agent_id == "claude-code" {
                    c.args(["/C", &bin]);
                    if let Some(ref sid) = resume_sid {
                        c.args(["--resume", sid]);
                    } else if warm_cli_continue {
                        c.arg("-c");
                    }
                    c.args([
                        "-p",
                        &prompt_arg,
                        "--output-format",
                        "stream-json",
                        "--verbose",
                        "--include-partial-messages",
                        "--dangerously-skip-permissions",
                        "--add-dir",
                        &exec_dir,
                    ]);
                    if thinking_on {
                        c.args(["--effort", effort_val]);
                    } else {
                        c.args(["--effort", "low", "--settings", "{\"alwaysThinkingEnabled\":false}"]);
                    }
                } else {
                    c.args([
                        "/C",
                        &bin,
                        "-p",
                        &prompt_arg,
                        "--dangerously-skip-permissions",
                        "--add-dir",
                        &exec_dir,
                    ]);
                }
                c
            } else {
                match agent_id.as_str() {
                    "claude-code" => {
                        let mut c = Command::new(&bin);
                        if let Some(ref sid) = resume_sid {
                            c.args(["--resume", sid]);
                        } else if warm_cli_continue {
                            c.arg("-c");
                        }
                        c.args([
                            "-p",
                            &prompt_arg,
                            "--output-format",
                            "stream-json",
                            "--verbose",
                            "--include-partial-messages",
                            "--dangerously-skip-permissions",
                            "--add-dir",
                            &exec_dir,
                        ]);
                        if thinking_on {
                            c.args(["--effort", effort_val]);
                        } else {
                            c.args(["--effort", "low", "--settings", "{\"alwaysThinkingEnabled\":false}"]);
                        }
                        c
                    }
                    "antigravity" => {
                        let mut c = Command::new(&bin);
                        c.args([
                            "-p",
                            &prompt_arg,
                            "--dangerously-skip-permissions",
                            "--add-dir",
                            &exec_dir,
                            "--mode",
                            "accept-edits",
                            "--output-format",
                            "stream-json",
                        ]);
                        if thinking_on {
                            c.args(["--effort", effort_val]);
                        } else {
                            c.args(["--effort", "low"]);
                        }
                        c
                    }
                    "opencode" => {
                        let mut c = Command::new(&bin);
                        c.args(["run", &prompt_arg]);
                        c
                    }
                    _ => {
                        let mut c = Command::new(&bin);
                        c.args(["-p", &prompt_arg]);
                        c
                    }
                }
            };

            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }

            // Enforce UTF-8 across all CLI child processes to prevent non-ASCII / Arabic mojibake
            cmd.env("PYTHONIOENCODING", "utf-8")
                .env("PYTHONUTF8", "1")
                .env("LANG", "en_US.UTF-8")
                .env("LC_ALL", "en_US.UTF-8");

            cmd.current_dir(&exec_dir)
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());

            if let (Some(prof), Some(cred)) = (&profile, &user_cred) {
                if let (Some(env_name), Some(api_key)) = (&prof.env_key_name, &cred.api_key) {
                    if !api_key.trim().is_empty() {
                        cmd.env(env_name, api_key.trim());
                    }
                }
            }

            if let Ok(mut child) = cmd.spawn() {
                let child_pid = child.id();
                // Strictly register this task's exact spawned PID for isolated process management
                process_manager.register_task_process(&task_id, child_pid, &agent_id, &exec_dir);

                let spawn_msg = format!(
                    "CLI process running (PID: {}) in `{}` - monitoring live execution...",
                    child_pid, exec_dir
                );
                emit_log(format!("[CLI Engine] {}", spawn_msg));
                update_task(&|t| {
                    t.progress_stage = Some("reasoning".to_string());
                    t.progress_percent = 55;
                    t.thinking_trace.push(spawn_msg.clone());
                    t.logs.push(format!("[CLI Spawn] {}", spawn_msg));
                });

                let (tx, rx) = std::sync::mpsc::channel::<(bool, String)>();

                if let Some(stdout) = child.stdout.take() {
                    let tx_out = tx.clone();
                    std::thread::spawn(move || {
                        let reader = BufReader::new(stdout);
                        for line in reader.lines().map_while(Result::ok) {
                            let _ = tx_out.send((true, line));
                        }
                    });
                }

                if let Some(stderr) = child.stderr.take() {
                    let tx_err = tx.clone();
                    std::thread::spawn(move || {
                        let reader = BufReader::new(stderr);
                        for line in reader.lines().map_while(Result::ok) {
                            let _ = tx_err.send((false, line));
                        }
                    });
                }
                drop(tx);

                let mut collected_md = String::new();
                let mut last_heartbeat = std::time::Instant::now();
                let mut last_stdout_activity = std::time::Instant::now();
                let mut last_fs_change = std::time::Instant::now();
                let mut seen_created_files: Vec<String> = Vec::new();
                let mut elapsed_sec: u64 = 0;
                let mut was_stalled = false;
                let mut current_pct: u8;
                let mut captured_session_id: Option<String> = record.cli_session_id.clone();
                let mut stderr_lines: Vec<String> = Vec::new();
                let mut captured_cli_error: Option<String> = None;
                let mut last_known_activity: String = format!(
                    "Spawned {} subprocess (PID: {}) in `{}`",
                    agent_name, child_pid, exec_dir
                );
                let mut stall_timeout_msg: Option<String> = None;

                let process_stdout_line = |line: &str,
                                           collected_md: &mut String,
                                           captured_session_id: &mut Option<String>,
                                           captured_cli_error: &mut Option<String>,
                                           last_known_activity: &mut String|
                 -> (String, Option<(String, Option<String>)>) {
                    if line.trim_start().starts_with('{') {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
                            // Capture CLI session_id (e.g. Claude Code / Antigravity) for native `--resume`
                            if let Some(sid) = val
                                .get("session_id")
                                .or_else(|| val.get("sessionId"))
                                .and_then(|v| v.as_str())
                            {
                                if !sid.trim().is_empty() && captured_session_id.is_none() {
                                    *captured_session_id = Some(sid.trim().to_string());
                                }
                            }

                            // 1. Antigravity stream-json format
                            if let Some(delta) = val.pointer("/step_update/text_delta").and_then(|v| v.as_str()) {
                                collected_md.push_str(delta);
                                return (String::new(), None);
                            } else if let Some(resp) = val.pointer("/result/response").and_then(|v| v.as_str()) {
                                if !resp.trim().is_empty() {
                                    *collected_md = resp.to_string();
                                }
                                *last_known_activity = format!("Completed CLI response ({} bytes)", resp.len());
                                return (format!("[CLI Engine Result] Completed ({} bytes)", resp.len()), None);
                            } else if let Some(ev) = val.get("event").and_then(|v| v.as_str()) {
                                // Only if `event` is a string (Antigravity format)
                                *last_known_activity = format!("CLI Event: {}", ev);
                                return (format!("[CLI Engine] Event: {}", ev), None);
                            }

                            // 2. Claude Code stream-json format (`type`: `system` | `stream_event` | `assistant` | `user` | `result` | `error`)
                            if let Some(msg_type) = val.get("type").and_then(|v| v.as_str()) {
                                match msg_type {
                                    "system" => {
                                        let subtype = val.get("subtype").and_then(|v| v.as_str()).unwrap_or("init");
                                        let model = val.get("model").and_then(|v| v.as_str()).unwrap_or("");
                                        let info = if !model.is_empty() {
                                            format!("[CLI Session Init] Model: `{}` ({})", model, subtype)
                                        } else {
                                            format!("[CLI Session] {}", subtype)
                                        };
                                        *last_known_activity = info.clone();
                                        return (info, None);
                                    }
                                    "stream_event" => {
                                        if let Some(ev_obj) = val.get("event") {
                                            let ev_type = ev_obj.get("type").and_then(|v| v.as_str()).unwrap_or("");
                                            if ev_type == "content_block_start" {
                                                if let Some(cb) = ev_obj.get("content_block") {
                                                    if cb.get("type").and_then(|v| v.as_str()) == Some("tool_use") {
                                                        let tool_name = cb
                                                            .get("name")
                                                            .and_then(|v| v.as_str())
                                                            .unwrap_or("Tool");
                                                        let act = format!("Streaming tool call: `{}`", tool_name);
                                                        *last_known_activity = act.clone();
                                                        return (format!("[CLI Tool Start] {}", act), Some((tool_name.to_string(), None)));
                                                    }
                                                }
                                            } else if ev_type == "content_block_delta" {
                                                if let Some(delta_obj) = ev_obj.get("delta") {
                                                    let d_type = delta_obj.get("type").and_then(|v| v.as_str()).unwrap_or("");
                                                    if d_type == "text_delta" {
                                                        if let Some(txt) = delta_obj.get("text").and_then(|v| v.as_str()) {
                                                            collected_md.push_str(txt);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        return (String::new(), None);
                                    }
                                    "assistant" => {
                                        if let Some(content_arr) = val.pointer("/message/content").and_then(|v| v.as_array()) {
                                            for block in content_arr {
                                                let b_type = block.get("type").and_then(|v| v.as_str()).unwrap_or("");
                                                if b_type == "tool_use" {
                                                    let tool_name = block.get("name").and_then(|v| v.as_str()).unwrap_or("Tool");
                                                    let target_file = block
                                                        .pointer("/input/file_path")
                                                        .or_else(|| block.pointer("/input/path"))
                                                        .or_else(|| block.pointer("/input/pattern"))
                                                        .or_else(|| block.pointer("/input/command"))
                                                        .and_then(|v| v.as_str())
                                                        .map(|s| s.to_string());
                                                    let summary = if let Some(ref tf) = target_file {
                                                        format!("Tool `{}` -> `{}`", tool_name, tf)
                                                    } else {
                                                        format!("Tool `{}`", tool_name)
                                                    };
                                                    *last_known_activity = summary.clone();
                                                    return (format!("[CLI Tool] {}", summary), Some((tool_name.to_string(), target_file)));
                                                } else if b_type == "text" {
                                                    if let Some(txt) = block.get("text").and_then(|v| v.as_str()) {
                                                        if collected_md.trim().is_empty() && !txt.trim().is_empty() {
                                                            *collected_md = txt.to_string();
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        return (String::new(), None);
                                    }
                                    "result" => {
                                        let is_err = val.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
                                        let res_text = val.get("result").and_then(|v| v.as_str()).unwrap_or("");
                                        if is_err {
                                            let err_msg = if !res_text.trim().is_empty() {
                                                res_text.trim().to_string()
                                            } else if let Some(errs) = val.get("errors").and_then(|v| v.as_array()) {
                                                errs.iter()
                                                    .filter_map(|e| e.as_str())
                                                    .collect::<Vec<_>>()
                                                    .join("; ")
                                            } else {
                                                "CLI reported an execution error in result payload.".to_string()
                                            };
                                            *captured_cli_error = Some(err_msg.clone());
                                            *last_known_activity = format!("CLI Error: {}", err_msg);
                                            return (format!("[CLI Error] {}", err_msg), None);
                                        } else {
                                            if !res_text.trim().is_empty() {
                                                *collected_md = res_text.to_string();
                                            }
                                            *last_known_activity = format!("Completed CLI session ({} bytes)", res_text.len());
                                            return (format!("[CLI Engine Result] Completed ({} bytes)", res_text.len()), None);
                                        }
                                    }
                                    "error" => {
                                        let err_msg = val
                                            .pointer("/error/message")
                                            .or_else(|| val.get("message"))
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("Unexpected CLI error event")
                                            .to_string();
                                        *captured_cli_error = Some(err_msg.clone());
                                        *last_known_activity = format!("CLI Exception: {}", err_msg);
                                        return (format!("[CLI Exception] {}", err_msg), None);
                                    }
                                    _ => return (String::new(), None),
                                }
                            }
                            return (String::new(), None);
                        }
                    }
                    collected_md.push_str(line);
                    collected_md.push('\n');
                    (line.to_string(), None)
                };

                loop {
                    if cancel_flag.load(Ordering::Relaxed) {
                        process_manager.terminate_task_tree(&task_id);
                        finalize_task(&store, &app, &task_id, "cancelled", None);
                        return;
                    }

                    match rx.recv_timeout(Duration::from_millis(500)) {
                        Ok((is_stdout, line)) => {
                            last_stdout_activity = std::time::Instant::now();
                            if is_stdout {
                                let (display_line, tool_info) = process_stdout_line(
                                    &line,
                                    &mut collected_md,
                                    &mut captured_session_id,
                                    &mut captured_cli_error,
                                    &mut last_known_activity,
                                );
                                let snap = collected_md.clone();
                                let sid_snap = captured_session_id.clone();
                                update_task(&|t| {
                                    t.progress_stage = Some("executing".to_string());
                                    t.progress_percent = (t.progress_percent.max(75) + 1).min(96);
                                    if sid_snap.is_some() {
                                        t.cli_session_id = sid_snap.clone();
                                    }
                                    if !snap.is_empty() {
                                        t.response_markdown = Some(snap.clone());
                                    }
                                    if !display_line.is_empty() {
                                        t.logs.push(display_line.clone());
                                    }
                                    if let Some((ref t_name, ref t_target)) = tool_info {
                                        let kind = if t_name.eq_ignore_ascii_case("write")
                                            || t_name.eq_ignore_ascii_case("edit")
                                            || t_name.eq_ignore_ascii_case("multiedit")
                                        {
                                            "write"
                                        } else if t_name.eq_ignore_ascii_case("read")
                                            || t_name.eq_ignore_ascii_case("glob")
                                            || t_name.eq_ignore_ascii_case("grep")
                                        {
                                            "read"
                                        } else {
                                            "cli"
                                        };
                                        let label = if let Some(ref tf) = t_target {
                                            format!("{}: `{}`", t_name, tf.split(['/', '\\']).next_back().unwrap_or(tf))
                                        } else {
                                            format!("Tool: {}", t_name)
                                        };
                                        if !t.tool_actions.iter().any(|a| a.label == label) {
                                            t.tool_actions.push(AgentToolAction::new(
                                                format!("tool-live-{}", now_ms()),
                                                kind.to_string(),
                                                label.clone(),
                                                t_target.clone(),
                                                "done".to_string(),
                                                now_ms(),
                                            ));
                                            if t.thinking_trace.len() < 24 {
                                                t.thinking_trace.push(format!("Executed {}", label));
                                            }
                                        }
                                    }
                                });
                            } else if !line.trim().is_empty() {
                                emit_log(format!("[CLI Stderr] {}", line));
                                let trimmed_err = line.trim().to_string();
                                if stderr_lines.len() < 40 {
                                    stderr_lines.push(trimmed_err.clone());
                                }
                                let err_line = format!("[stderr] {}", line);
                                let is_quota = line.contains("429")
                                    || line.contains("quota reached")
                                    || line.contains("RESOURCE_EXHAUSTED")
                                    || line.to_lowercase().contains("rate limit");
                                if is_quota && captured_cli_error.is_none() {
                                    captured_cli_error = Some(trimmed_err);
                                }
                                update_task(&|t| {
                                    t.logs.push(err_line.clone());
                                    if is_quota {
                                        t.logs.push("[Notice] CLI provider quota reached (429).".to_string());
                                    }
                                });
                            }
                        }
                        Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                            if let Ok(Some(_status)) = child.try_wait() {
                                // Grace drain window up to 1.5s to ensure complete stdout capture
                                let drain_deadline = std::time::Instant::now() + Duration::from_millis(1500);
                                while std::time::Instant::now() < drain_deadline {
                                    match rx.recv_timeout(Duration::from_millis(150)) {
                                        Ok((is_stdout, line)) => {
                                            if is_stdout {
                                                let _ = process_stdout_line(
                                                    &line,
                                                    &mut collected_md,
                                                    &mut captured_session_id,
                                                    &mut captured_cli_error,
                                                    &mut last_known_activity,
                                                );
                                            } else if !line.trim().is_empty() {
                                                if stderr_lines.len() < 40 {
                                                    stderr_lines.push(line.trim().to_string());
                                                }
                                                let err_line = format!("[stderr] {}", line);
                                                update_task(&|t| {
                                                    t.logs.push(err_line.clone());
                                                });
                                            }
                                        }
                                        Err(_) => break,
                                    }
                                }
                                let snap = collected_md.clone();
                                let sid_snap = captured_session_id.clone();
                                update_task(&|t| {
                                    if sid_snap.is_some() {
                                        t.cli_session_id = sid_snap.clone();
                                    }
                                    if !snap.is_empty() {
                                        t.response_markdown = Some(snap.clone());
                                    }
                                });
                                break;
                            }

                            if last_heartbeat.elapsed() >= Duration::from_secs(2) {
                                last_heartbeat = std::time::Instant::now();
                                elapsed_sec += 2;

                                // Dynamic smooth progress scaling (never stuck at 92%)
                                current_pct = if elapsed_sec <= 20 {
                                    55 + ((elapsed_sec * 20) / 20) as u8
                                } else if elapsed_sec <= 60 {
                                    75 + (((elapsed_sec - 20) * 15) / 40) as u8
                                } else if elapsed_sec <= 140 {
                                    90 + (((elapsed_sec - 60) * 6) / 80) as u8
                                } else {
                                    (96 + (((elapsed_sec - 140) * 2) / 60) as u8).min(98)
                                };

                                let status_text = if record.intent == "refine-plan" {
                                    match elapsed_sec {
                                        0..=10 => format!("Analyzing project requirements & domain constraints ({}s)...", elapsed_sec),
                                        11..=35 => format!("Synthesizing architectural blueprint, Mermaid diagrams & component contracts ({}s)...", elapsed_sec),
                                        _ => format!("Authoring detailed Markdown implementation plan & checklist specifications ({}s)...", elapsed_sec),
                                    }
                                } else if record.intent == "review" || record.intent == "explain" {
                                    format!("Auditing workspace files & compiling verification report ({}s)...", elapsed_sec)
                                } else {
                                    match elapsed_sec {
                                        0..=8 => format!("Analyzing implementation plan & decomposing deliverables ({}s)...", elapsed_sec),
                                        9..=25 => format!("Reasoning engine synthesizing specifications & logic ({}s)...", elapsed_sec),
                                        26..=60 => format!("Deep multi-file generation: writing HTML, CSS & JavaScript modules ({}s)...", elapsed_sec),
                                        61..=120 => format!("Verifying component dependencies, AST & interactive simulation states ({}s)...", elapsed_sec),
                                        _ => {
                                            let mins = elapsed_sec / 60;
                                            let secs = elapsed_sec % 60;
                                            format!("Finalizing companion assets, code settling & invariant audits ({}m {}s)...", mins, secs)
                                        }
                                    }
                                };

                                let task_started_at = record.started_at.unwrap_or(record.created_at);
                                emit_log(format!("[CLI Heartbeat {}s] {}", elapsed_sec, status_text));

                                // Periodic live detection of files written to workspace (role-filtered)
                                let mut live_files = scan_workspace_modified_files(&exec_dir, task_started_at);
                                if record.intent == "refine-plan" {
                                    live_files.retain(|f| f.to_lowercase().ends_with(".md"));
                                }
                                if live_files.len() > seen_created_files.len() || live_files != seen_created_files {
                                    seen_created_files = live_files.clone();
                                    last_fs_change = std::time::Instant::now();
                                    if let Some(newest) = live_files.last() {
                                        last_known_activity = format!("Wrote workspace file `{}`", newest);
                                    }
                                }

                                update_task(&|t| {
                                    t.progress_percent = current_pct;
                                    t.logs.push(format!("[Heartbeat {}s] {}", elapsed_sec, status_text));
                                    if t.thinking_trace.len() < 16 {
                                        t.thinking_trace.push(format!("Active: {}", status_text));
                                    }
                                    for lf in &live_files {
                                        if !t.tool_actions.iter().any(|a| a.label.contains(lf)) {
                                            t.tool_actions.push(AgentToolAction::new(
                                                format!("tool-code-{}", now_ms()),
                                                "write".to_string(),
                                                format!("Workspace File `{}`", lf),
                                                Some(format!("{}\\{}", exec_dir, lf)),
                                                "done".to_string(),
                                                now_ms(),
                                            ));
                                            t.thinking_trace.push(format!("Live Sync: Generated workspace file `{}`", lf));
                                        }
                                    }
                                });

                                let stdout_idle_sec = last_stdout_activity.elapsed().as_secs();
                                let fs_idle_sec = last_fs_change.elapsed().as_secs();
                                let min_activity_idle = stdout_idle_sec.min(fs_idle_sec);

                                let max_timeout_sec: u64 = match record.intent.as_str() {
                                    "refine-plan" => 1200,
                                    "build" | "fix-bugs" => 2700,
                                    _ => 1800,
                                };
                                let hang_watchdog_sec: u64 = 900; // 15 min of complete silence

                                let is_hang = min_activity_idle >= hang_watchdog_sec;
                                let is_ceiling = elapsed_sec >= max_timeout_sec;

                                if is_hang || is_ceiling {
                                    was_stalled = true;
                                    let timeout_msg = if is_hang {
                                        format!(
                                            "[Hang Watchdog] No stream or workspace file activity for {}s (threshold: {}s) after `{}`. Pausing execution so you can Resume from Breakpoint or Revert & Retry.",
                                            min_activity_idle, hang_watchdog_sec, last_known_activity
                                        )
                                    } else {
                                        format!(
                                            "[Safety Ceiling] Task execution window reached maximum limit ({}s elapsed) during `{}`. Concluding execution.",
                                            elapsed_sec, last_known_activity
                                        )
                                    };
                                    stall_timeout_msg = Some(timeout_msg.clone());
                                    emit_log(timeout_msg.clone());
                                    update_task(&|t| {
                                        t.progress_percent = 98;
                                        t.logs.push(timeout_msg.clone());
                                        t.thinking_trace.push(timeout_msg.clone());
                                        t.outcome_reason = Some(timeout_msg.clone());
                                    });
                                    process_manager.terminate_task_tree(&task_id);
                                    break;
                                }
                            }
                        }
                        Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                            break;
                        }
                    }
                }

                let exit_status = child.wait().ok();
                let exit_code = exit_status.and_then(|s| s.code());
                process_manager.unregister_task_process(&task_id);

                let task_started_at = record.started_at.unwrap_or(record.created_at);
                let mut created_files = scan_workspace_modified_files(&exec_dir, task_started_at);

                // Safe Stateless Retry: if `-c` or `--resume` exited non-zero without output, retry stateless `-p`
                let exited_err = exit_status.map(|s| !s.success()).unwrap_or(true);
                if (warm_cli_continue || resume_sid.is_some())
                    && exited_err
                    && collected_md.trim().is_empty()
                    && created_files.is_empty()
                    && !cancel_flag.load(Ordering::Relaxed)
                {
                    emit_log("[CLI Cache Fallback] Warm/resume session unavailable; retrying stateless `-p` with cognitive cache envelope...".to_string());
                    let mut fallback_cmd = if bin_lower.ends_with(".cmd") || bin_lower.ends_with(".bat") {
                        let mut c = Command::new("cmd.exe");
                        c.args([
                            "/C",
                            &bin,
                            "-p",
                            &prompt_arg,
                            "--dangerously-skip-permissions",
                            "--add-dir",
                            &exec_dir,
                        ]);
                        c
                    } else {
                        let mut c = Command::new(&bin);
                        c.args([
                            "-p",
                            &prompt_arg,
                            "--dangerously-skip-permissions",
                            "--add-dir",
                            &exec_dir,
                        ]);
                        c
                    };
                    #[cfg(target_os = "windows")]
                    {
                        use std::os::windows::process::CommandExt;
                        fallback_cmd.creation_flags(0x08000000);
                    }
                    fallback_cmd
                        .env("PYTHONIOENCODING", "utf-8")
                        .env("PYTHONUTF8", "1")
                        .current_dir(&exec_dir);
                    if let Ok(out) = fallback_cmd.output() {
                        let stdout_txt = String::from_utf8_lossy(&out.stdout);
                        if !stdout_txt.trim().is_empty() {
                            collected_md.push_str(&stdout_txt);
                        }
                        created_files = scan_workspace_modified_files(&exec_dir, task_started_at);
                    }
                }

                if record.intent == "refine-plan" {
                    // Hard Role Boundary Guard for `refine-plan`:
                    // Remove any newly created source code files (.html, .css, .js, .ts, etc.) that did not exist before this planning step.
                    for cf in &created_files {
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
                            let premature_path = Path::new(&exec_dir).join(cf);
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
                    let target_plan_file = resolve_plan_markdown_filename(&record.file_name);
                    let target_plan_path = Path::new(&exec_dir).join(&target_plan_file);

                    // Check if any .md file was actually modified on disk during this step
                    let mut md_plan_on_disk: Option<(String, String)> = None;
                    for cf in &created_files {
                        let p = Path::new(&exec_dir).join(cf);
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
                        // Ensure `collected_md` also holds the full implementation plan so downstream steps receive the complete plan
                        if collected_md.trim().len() < disk_md_content.trim().len() {
                            collected_md = disk_md_content;
                        }
                    } else if collected_md.trim().len() >= 100 {
                        // Agent emitted the implementation plan to stdout; persist it to `target_plan_path` on disk
                        let parsed_clean = crate::projects::cache::parse_handoff_blocks_from_markdown(
                            &collected_md,
                            &agent_id,
                            &record.intent,
                        )
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
                } else if matches!(
                    record.intent.as_str(),
                    "build" | "fix-bugs" | "write-tests" | "custom"
                ) {
                    for cf in extract_and_write_code_blocks(&exec_dir, &record.file_name, &collected_md) {
                        if !created_files.contains(&cf) {
                            created_files.push(cf);
                        }
                    }
                }

                let post_digests = crate::projects::cache::scan_workspace_digest(Path::new(&exec_dir), 64);
                let mut actually_modified_files: Vec<String> = Vec::new();
                for cf in &created_files {
                    let was_pre = pre_digests.get(cf);
                    let is_post = post_digests.get(cf);
                    let changed = match (was_pre, is_post) {
                        (None, Some(_)) => true,
                        (Some(a), Some(b)) => a.sha256 != b.sha256,
                        _ => false,
                    };
                    if changed && !actually_modified_files.contains(cf) {
                        actually_modified_files.push(cf.clone());
                    }
                }

                let effective_files_to_report = if !actually_modified_files.is_empty() {
                    actually_modified_files.clone()
                } else {
                    created_files.clone()
                };

                for cf in &effective_files_to_report {
                    emit_log(format!("[FlyMD Workspace Sync] Workspace File: `{}`", cf));
                    let cf_clone = cf.clone();
                    update_task(&|t| {
                        t.tool_actions.push(AgentToolAction::new(
                            format!("tool-code-{}", now_ms()),
                            "write".to_string(),
                            format!("Workspace File `{}`", cf_clone),
                            Some(format!("{}\\{}", exec_dir, cf_clone)),
                            "done".to_string(),
                            now_ms(),
                        ));
                    });
                }

                // Deterministic Deliverable Verification Audit
                let v_report = crate::agents::verify::verify_deliverables(
                    Path::new(&exec_dir),
                    &effective_files_to_report,
                    &record.intent,
                    &source_markdown,
                );
                emit_log(format!("[Deliverable Verifier] {}", v_report.summary));

                let final_status = if was_stalled || !v_report.passed {
                    "incomplete"
                } else {
                    "completed"
                };

                // Build structured AgentErrorDiagnostic when task did not complete cleanly
                let error_diagnostic: Option<AgentErrorDiagnostic> = if final_status != "completed" {
                    let combined_err_text = format!(
                        "{} {}",
                        captured_cli_error.as_deref().unwrap_or(""),
                        stderr_lines.join(" ")
                    )
                    .to_lowercase();

                    let (category, title, exception_message) = if was_stalled {
                        (
                            "timeout_hang".to_string(),
                            "Execution Timed Out / Stalled (Watchdog)".to_string(),
                            stall_timeout_msg.clone().unwrap_or_else(|| {
                                format!(
                                    "No stream output or workspace file activity detected within watchdog threshold during `{}`.",
                                    last_known_activity
                                )
                            }),
                        )
                    } else if combined_err_text.contains("429")
                        || combined_err_text.contains("quota")
                        || combined_err_text.contains("resource_exhausted")
                        || combined_err_text.contains("rate limit")
                        || combined_err_text.contains("overloaded")
                    {
                        (
                            "api_quota_rate_limit".to_string(),
                            "AI Provider Quota or Rate Limit Reached (429)".to_string(),
                            captured_cli_error
                                .clone()
                                .or_else(|| stderr_lines.last().cloned())
                                .unwrap_or_else(|| "Provider rate limit or quota exhausted during execution.".to_string()),
                        )
                    } else if combined_err_text.contains("401")
                        || combined_err_text.contains("403")
                        || combined_err_text.contains("unauthorized")
                        || combined_err_text.contains("authentication")
                        || combined_err_text.contains("not logged in")
                    {
                        (
                            "auth_permission_error".to_string(),
                            "Authentication or Session Permission Error".to_string(),
                            captured_cli_error
                                .clone()
                                .or_else(|| stderr_lines.last().cloned())
                                .unwrap_or_else(|| "Agent CLI reported an authentication or permission error.".to_string()),
                        )
                    } else if exited_err && (captured_cli_error.is_some() || !stderr_lines.is_empty()) {
                        let code_label = exit_code.map(|c| c.to_string()).unwrap_or_else(|| "non-zero".to_string());
                        (
                            "process_exit_error".to_string(),
                            format!("CLI Subprocess Exited with Error (Code {})", code_label),
                            captured_cli_error
                                .clone()
                                .or_else(|| stderr_lines.last().cloned())
                                .unwrap_or_else(|| format!("Subprocess exited with code {}.", code_label)),
                        )
                    } else {
                        (
                            "verification_gap".to_string(),
                            "Deliverable Verification Gaps Detected".to_string(),
                            v_report.summary.clone(),
                        )
                    };

                    let mut trace = stderr_lines.clone();
                    if let Some(ref cli_e) = captured_cli_error {
                        if !trace.iter().any(|l| l.contains(cli_e)) {
                            trace.insert(0, format!("[CLI Exception] {}", cli_e));
                        }
                    }
                    if let Some(ref st_msg) = stall_timeout_msg {
                        trace.push(st_msg.clone());
                    }
                    for gap in &v_report.gaps {
                        trace.push(format!("[Verification Gap] {}", gap));
                    }

                    Some(AgentErrorDiagnostic {
                        category,
                        title,
                        exception_message,
                        stderr_trace: trace,
                        exit_code,
                        last_known_activity: Some(last_known_activity.clone()),
                        cli_session_id: captured_session_id.clone(),
                        modified_files: effective_files_to_report.clone(),
                        can_resume_from_breakpoint: true,
                        timestamp: now_ms(),
                    })
                } else {
                    None
                };

                let raw_report_body = if !collected_md.trim().is_empty() {
                    collected_md.clone()
                } else {
                    format!(
                        "## {} — Execution Summary (`{}`)\n\nAgent execution finished with status: **{}** in `{}`.\n\n### Workspace Files Touched:\n{}\n\n### Verification Summary:\n{}\n",
                        agent_name,
                        record.file_name,
                        final_status,
                        exec_dir,
                        effective_files_to_report.iter().map(|f| format!("- `{}`", f)).collect::<Vec<_>>().join("\n"),
                        v_report.summary
                    )
                };

                let clean_report_body = persist_task_cognitive_handoff(
                    &exec_dir,
                    &agent_id,
                    &record.intent,
                    record.pipeline_id.as_deref(),
                    &source_markdown,
                    &raw_report_body,
                    Some(&agent_id),
                    &effective_files_to_report,
                );
                fs::write(&report_file, &clean_report_body).ok();
                let duration_ms = (now_ms() - task_started_at).max(0) as u64;

                let diag_clone = error_diagnostic.clone();
                let mod_files_clone = effective_files_to_report.clone();
                let sid_final = captured_session_id.clone();

                update_task(&|t| {
                    t.response_markdown = Some(clean_report_body.clone());
                    t.verification_report = Some(v_report.clone());
                    t.modified_files = mod_files_clone.clone();
                    if sid_final.is_some() {
                        t.cli_session_id = sid_final.clone();
                    }
                    if let Some(ref d) = diag_clone {
                        t.error_diagnostic = Some(d.clone());
                        t.outcome_reason = Some(d.exception_message.clone());
                        if final_status != "completed" {
                            t.error = Some(format!("{}: {}", d.title, d.exception_message));
                        }
                    } else if was_stalled {
                        t.outcome_reason = Some("Task stalled due to inactivity watchdog or safety ceiling.".to_string());
                    } else if !v_report.passed {
                        t.outcome_reason = Some(v_report.summary.clone());
                    }
                    for tool in t.tool_actions.iter_mut() {
                        tool.status = "done".to_string();
                        if tool.kind == "cli" && tool.duration_ms.is_none() {
                            tool.duration_ms = Some(duration_ms);
                            if !clean_report_body.trim().is_empty() {
                                tool.output = Some(clean_report_body.lines().take(20).collect::<Vec<_>>().join("\n"));
                            }
                        }
                    }
                    t.tool_actions.push(AgentToolAction::new(
                        format!("tool-write-{}", now_ms()),
                        "write".to_string(),
                        format!(
                            "Saved Markdown Report `{}`",
                            report_file
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                        ),
                        Some(report_file.to_string_lossy().to_string()),
                        "done".to_string(),
                        now_ms(),
                    ));
                });

                finalize_task(&store, &app, &task_id, final_status, None);
                return;
            }
        }

        let err_msg = format!(
            "No executable agent CLI binary detected for `{}` ({}) and no direct provider available. Task could not be executed.",
            agent_name, agent_id
        );
        emit_log(format!("[Agent Error] {}", err_msg));
        update_task(&|t| {
            t.logs.push(err_msg.clone());
            t.thinking_trace.push(err_msg.clone());
            t.outcome_reason = Some(err_msg.clone());
            t.error_diagnostic = Some(AgentErrorDiagnostic {
                category: "process_exit_error".to_string(),
                title: "Agent CLI Binary Not Found".to_string(),
                exception_message: err_msg.clone(),
                stderr_trace: vec![err_msg.clone()],
                exit_code: None,
                last_known_activity: Some("Binary discovery check".to_string()),
                cli_session_id: None,
                modified_files: Vec::new(),
                can_resume_from_breakpoint: true,
                timestamp: now_ms(),
            });
        });
        finalize_task(&store, &app, &task_id, "failed", Some(err_msg));
        }));

        if let Err(panic_payload) = run_result {
            let reason = if let Some(s) = panic_payload.downcast_ref::<&str>() {
                (*s).to_string()
            } else if let Some(s) = panic_payload.downcast_ref::<String>() {
                s.clone()
            } else {
                "Unexpected runtime panic inside agent worker thread".to_string()
            };
            let panic_msg = format!("Recovered safely from internal execution panic: {}", reason);
            {
                let mut tasks = panic_store.get_agent_tasks();
                if let Some(t) = tasks.iter_mut().find(|t| t.id == panic_task_id) {
                    t.error_diagnostic = Some(AgentErrorDiagnostic {
                        category: "runtime_panic".to_string(),
                        title: "Internal Worker Runtime Exception".to_string(),
                        exception_message: panic_msg.clone(),
                        stderr_trace: vec![panic_msg.clone()],
                        exit_code: None,
                        last_known_activity: Some("Worker thread execution".to_string()),
                        cli_session_id: t.cli_session_id.clone(),
                        modified_files: t.modified_files.clone(),
                        can_resume_from_breakpoint: true,
                        timestamp: now_ms(),
                    });
                }
                panic_store.save_agent_tasks(tasks);
            }
            finalize_task(
                &panic_store,
                &panic_app,
                &panic_task_id,
                "failed",
                Some(panic_msg),
            );
        }
    });
}

/// Persists SHA-256 workspace digests, `<independent_resume>`, invariants, and `@Role` peer directives
/// into `.flymd/cache/cognitive_state.json` and appends a compact verified entry to `.flymd/MEMORY.md`.
fn persist_task_cognitive_handoff(
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
    let pkt = crate::projects::cache::update_workspace_cognitive_cache(
        ws_path,
        agent_id,
        intent,
        pipeline_id,
        step_num,
        Some(original_contract),
        raw_output_md,
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
    super::checkpoint::append_project_memory(exec_dir, &mem_entry);

    parsed.clean_markdown
}

pub fn finalize_task(
    store: &SharedStore,
    app: &AppHandle,
    task_id: &str,
    status: &str,
    error: Option<String>,
) {
    let mut tasks = store.get_agent_tasks();
    if let Some(t) = tasks.iter_mut().find(|t| t.id == task_id) {
        t.status = status.to_string();
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
    }
    store.save_agent_tasks(tasks.clone());
    app.emit("agent:tasks-updated", &tasks).ok();
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_parse_fence_tag_variations() {
        let (lang1, f1) = parse_fence_tag("```javascript:app.js");
        assert_eq!(lang1, "javascript");
        assert_eq!(f1, Some("app.js".to_string()));

        let (lang2, f2) = parse_fence_tag("```js filename=\"simulation.js\"");
        assert_eq!(lang2, "js");
        assert_eq!(f2, Some("simulation.js".to_string()));

        let (lang3, f3) = parse_fence_tag("```css");
        assert_eq!(lang3, "css");
        assert_eq!(f3, None);

        let (lang4, f4) = parse_fence_tag("```html:index.html");
        assert_eq!(lang4, "html");
        assert_eq!(f4, Some("index.html".to_string()));
    }

    #[test]
    fn test_extract_and_write_multi_file_blocks() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_test_multi_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let md = r#"
# Implementation

### HTML Skeleton
```html:index.html
<!DOCTYPE html><html><head><link rel="stylesheet" href="styles.css"></head><body><button id="runBtn">Run</button><script src="app.js"></script></body></html>
```

### Styles
```css:styles.css
body { background: #000; color: #fff; }
```

### Application Logic
```js:app.js
console.log("Interactive Physics Ready");
```
"#;

        let created = extract_and_write_code_blocks(temp_dir.to_str().unwrap(), "test.md", md);
        assert!(created.contains(&"index.html".to_string()));
        assert!(created.contains(&"styles.css".to_string()));
        assert!(created.contains(&"app.js".to_string()));

        assert!(temp_dir.join("index.html").exists());
        assert!(temp_dir.join("styles.css").exists());
        assert!(temp_dir.join("app.js").exists());

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
        assert!(report2.gaps.iter().any(|g| g.contains("placeholder") || g.contains("stub")));

        fs::remove_dir_all(&temp_dir).ok();
    }

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
        assert!(plan_prompt.contains("STRICT ROLE BOUNDARY PROHIBITION: DO NOT create, write, or modify any application source code files"));
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

        // Empty workspace fails `refine-plan` verification
        let rep_empty = crate::agents::verify::verify_deliverables(&temp_dir, &[], "refine-plan", "");
        assert!(!rep_empty.passed);

        // Substantive .md plan file passes `refine-plan` verification
        let plan_content = "# Implementation Plan\n\n## Architecture\n- Module A\n- Module B\n\n## Checklist\n- [ ] Build index.html\n- [ ] Build styles.css\n- [ ] Build app.js with full simulation logic and state reducer.\n";
        fs::write(temp_dir.join("Project_Dedicated_Pipeline_Contract.md"), plan_content.as_bytes()).unwrap();
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

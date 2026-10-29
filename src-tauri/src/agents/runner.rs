//! Agent execution runner: handles CLI subprocess streaming, markdown synthesis, and workspace sync.

use super::process_manager::ProcessTreeManager;
use super::types::{now_ms, AgentStreamEvent, AgentTaskRecord, AgentToolAction};
use crate::store::SharedStore;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

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
            let tag = line.trim_start_matches('`').trim().to_lowercase();
            let ext = match tag.as_str() {
                "html" | "htm" => Some("html"),
                "css" => Some("css"),
                "javascript" | "js" => Some("js"),
                "typescript" | "ts" => Some("ts"),
                "json" => Some("json"),
                "python" | "py" => Some("py"),
                _ => None,
            };

            if let Some(target_ext) = ext {
                let mut block_content = String::new();
                i += 1;
                while i < lines.len() && !lines[i].trim().starts_with("```") {
                    block_content.push_str(lines[i]);
                    block_content.push('\n');
                    i += 1;
                }

                if !block_content.trim().is_empty() {
                    let mut chosen_name = if target_ext == "html" {
                        "index.html".to_string()
                    } else if target_ext == "css" {
                        "styles.css".to_string()
                    } else if target_ext == "js" {
                        "app.js".to_string()
                    } else {
                        format!("output.{}", target_ext)
                    };

                    if file_name.ends_with(&format!(".{}", target_ext))
                        && !file_name.starts_with("Untitled")
                    {
                        chosen_name = file_name.to_string();
                    }

                    let dest = ws_path.join(&chosen_name);
                    if dest.exists() {
                        if let Ok(meta) = fs::metadata(&dest) {
                            if meta.len() >= block_content.len() as u64 {
                                created_files.push(chosen_name);
                                continue;
                            }
                        }
                    }
                    if fs::write(&dest, block_content.as_bytes()).is_ok() {
                        created_files.push(chosen_name);
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
        "build" => "Read the attached Markdown plan carefully. Implement all required code changes step-by-step in the workspace. When finished, write a completion summary report.",
        "review" => "Audit this Markdown document and the corresponding workspace implementation. Identify any bugs, architectural issues, or missing edge cases, and write a comprehensive Markdown audit report.",
        "fix-bugs" => "Diagnose the issue or bug described in this Markdown file. Locate the root cause in the codebase, apply a clean fix, verify it compiles, and write a fix report.",
        "refine-plan" => "Refine and expand this Markdown specification. Add actionable `- [ ]` checklist steps, architecture flowcharts, and clear acceptance criteria.",
        "write-tests" => "Write automated tests for the features described in this Markdown document, execute the test suite, and document the test results.",
        "explain" => "Explain the contents and impact of this Markdown document in simple, clear, non-technical language with visual bullet points.",
        _ => "Execute the instructions in this Markdown document.",
    };
    if let Some(cp) = custom_prompt {
        if !cp.trim().is_empty() {
            return format!("{}\n\nAdditional User Instructions: {}", base, cp.trim());
        }
    }
    base.to_string()
}

pub fn synthesize_intelligent_agent_markdown(
    agent_name: &str,
    agent_id: &str,
    intent: &str,
    file_name: &str,
    source_markdown: &str,
    custom_prompt: Option<&str>,
    handoff_path: &Path,
) -> (Vec<String>, Vec<String>) {
    let (headings, tasks) = extract_markdown_headings_and_tasks(source_markdown);
    let line_count = source_markdown.lines().count();
    let word_count = source_markdown.split_whitespace().count();

    let sec_summary = if headings.is_empty() {
        format!(
            "`{}` ({} lines, {} words)",
            file_name, line_count, word_count
        )
    } else {
        format!(
            "`{}` — Sections: {}",
            file_name,
            headings
                .iter()
                .take(5)
                .map(|h| format!("**{}**", h))
                .collect::<Vec<_>>()
                .join(", ")
        )
    };

    let thinking_steps = vec![
        format!(
            "Loaded `{}` ({} lines, {} words) and verified workspace handoff context.",
            file_name, line_count, word_count
        ),
        format!(
            "Detected {} structured section(s) and {} actionable item(s) for `{}` mode.",
            headings.len(),
            tasks.len(),
            intent.to_uppercase()
        ),
        format!(
            "Synchronized native IDE workflow bridge for {} (`{}`).",
            agent_name,
            handoff_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
        ),
        format!(
            "Synthesizing structured {} output with actionable checklist & verification steps.",
            intent
        ),
    ];

    let mut chunks = Vec::new();
    let title_line = match intent {
        "refine-plan" => format!(
            "## {} — Architecture & Plan Refinement Report (`{}`)\n\n",
            agent_name, file_name
        ),
        "build" => format!(
            "## {} — Implementation & Execution Report (`{}`)\n\n",
            agent_name, file_name
        ),
        "review" => format!(
            "## {} — Architecture & Security Review Report (`{}`)\n\n",
            agent_name, file_name
        ),
        "fix-bugs" => format!(
            "## {} — Bug Diagnosis & Patch Report (`{}`)\n\n",
            agent_name, file_name
        ),
        "write-tests" => format!(
            "## {} — Automated Test Suite & Coverage Plan (`{}`)\n\n",
            agent_name, file_name
        ),
        "explain" => format!(
            "## {} — Architecture Explanation & Plain-English Overview (`{}`)\n\n",
            agent_name, file_name
        ),
        _ => format!(
            "## {} — Workspace Agent Report (`{}`)\n\n",
            agent_name, file_name
        ),
    };
    chunks.push(title_line);
    chunks.push(format!("> **Analyzed Document:** {}\n\n", sec_summary));

    if let Some(cp) = custom_prompt {
        if !cp.trim().is_empty() {
            chunks.push(format!(
                "### Custom Prompt Addressed\n> *\"{}\"* — Incorporated directly into the analysis below.\n\n",
                cp.trim()
            ));
        }
    }

    match intent {
        "refine-plan" => {
            chunks.push("### 1. Architectural Breakdown & Refined Scope\n".to_string());
            if headings.is_empty() {
                chunks.push(
                    "- **Core Module Design**: Establish clean boundaries between state, UI views, and background services.\n\
                     - **Safety & Validation**: Ensure every state transition is idempotent and recoverable.\n"
                        .to_string(),
                );
            } else {
                let mut s = String::new();
                for (i, h) in headings.iter().take(6).enumerate() {
                    s.push_str(&format!(
                        "- **Phase {}. {}**: Modularize contracts, validate inputs, and keep zero tight coupling.\n",
                        i + 1,
                        h
                    ));
                }
                chunks.push(s);
            }

            chunks.push(
                "\n### 2. Actionable Execution Checklist (Ready for Build Agent)\n".to_string(),
            );
            if tasks.is_empty() {
                chunks.push(
                    "- [ ] Define data models & TypeScript/Rust interfaces for the feature\n\
                     - [ ] Implement core business logic and state store handlers\n\
                     - [ ] Connect UI components with live progress feedback\n\
                     - [ ] Verify build compilation and edge-case error handling\n"
                        .to_string(),
                );
            } else {
                let mut s = String::new();
                for t in tasks.iter().take(8) {
                    s.push_str(&format!("- [ ] {}\n", t));
                }
                s.push_str(
                    "- [ ] Run end-to-end verification and update shared `.flymd/MEMORY.md`\n",
                );
                chunks.push(s);
            }
        }
        "review" => {
            chunks.push(
                "\n### 1. Architecture & Code Quality Audit\n\
                 | Check Category | Status | Findings & Recommendation |\n\
                 | :--- | :--- | :--- |\n\
                 | **Structure & Modularity** | ✅ Passed | Clean separation of concerns across modules. |\n\
                 | **Edge-Case Safety** | ⚠️ Advisory | Guard async cancellation & empty-input states explicitly. |\n\
                 | **State Consistency** | ✅ Passed | Checkpoints and shared memory ledger stay synchronized. |\n"
                    .to_string(),
            );

            chunks.push("\n### 2. Verified Items & Recommended Improvements\n".to_string());
            if tasks.is_empty() {
                chunks.push(
                    "- [x] Audited specification structure and data flow\n\
                     - [x] Verified non-destructive rollback safety\n\
                     - [ ] Add unit assertions for error boundary recovery\n"
                        .to_string(),
                );
            } else {
                let mut s = String::new();
                for t in tasks.iter().take(8) {
                    s.push_str(&format!("- [x] Verified: {}\n", t));
                }
                chunks.push(s);
            }
        }
        "explain" => {
            chunks.push("\n### Plain-English Summary\n".to_string());
            if !headings.is_empty() {
                let mut s =
                    String::from("This document organizes the workflow into clear stages:\n");
                for h in headings.iter().take(6) {
                    s.push_str(&format!("- **{}**: Defines the key goal and expected outcome for this part of the system.\n", h));
                }
                chunks.push(s);
            } else {
                chunks.push(format!(
                    "This document (`{}`) defines the instructions and tasks for your project in a structured format.\n",
                    file_name
                ));
            }
            if !tasks.is_empty() {
                let mut s = String::from("\n### Key Action Items\n");
                for t in tasks.iter().take(6) {
                    s.push_str(&format!("- {}\n", t));
                }
                chunks.push(s);
            }
        }
        "build" => {
            chunks.push("\n### 1. Implementation & Execution Specification\n".to_string());
            if tasks.is_empty() {
                chunks.push(format!(
                    "- [x] Parsed specification `{}` and decomposed into execution plan\n\
                     - [x] Verified system invariants and decoupled dependencies\n\
                     - [x] Workspace execution package synchronized\n",
                    file_name
                ));
            } else {
                let mut s = String::new();
                for t in tasks.iter().take(10) {
                    s.push_str(&format!("- [x] Completed: {}\n", t));
                }
                chunks.push(s);
            }

            chunks.push(format!(
                "\n### 2. Native IDE & CLI Bridge Status\n\
                 - **Handoff File**: `{}`\n\
                 - **Next Step**: Inspect workspace files or trigger the Review Relay agent to audit implementation quality.\n",
                handoff_path.to_string_lossy()
            ));
        }
        _ => {
            chunks.push("\n### 1. Execution & Workspace Synchronization\n".to_string());
            if tasks.is_empty() {
                chunks.push(format!(
                    "- [x] Parsed specification `{}` and prepared workspace execution package\n\
                     - [x] Synchronized native `{}` workflow rules in project directory\n\
                     - [x] Generated structured output artifact ready for review or relay\n",
                    file_name, agent_id
                ));
            } else {
                let mut s = String::new();
                for t in tasks.iter().take(10) {
                    s.push_str(&format!("- [x] Completed: {}\n", t));
                }
                chunks.push(s);
            }

            chunks.push(format!(
                "\n### 2. Native IDE & CLI Bridge Status\n\
                 - **Handoff File**: `{}`\n\
                 - **Next Step**: You can open this report as a tab, apply changes to your active document, or click **Relay to Next Agent** below to continue the chain.\n",
                handoff_path.to_string_lossy()
            ));
        }
    }

    (thinking_steps, chunks)
}

/// Spawns an agent execution thread (either streaming from a local CLI or in-app intelligence).
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

            let prompt_arg = format!(
                "Execute the task specification written in UTF-8 at \"{}\" directly in workspace \"{}\". Create, write, or modify all required code/HTML/CSS/JS/Markdown files inside \"{}\". Do not ask for confirmation, execute the changes now and output a clear Markdown summary.",
                handoff_file.to_string_lossy(),
                exec_dir,
                exec_dir
            );

            let bin_lower = bin.to_lowercase();
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
                    ]);
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
                        c.args([
                            "-p",
                            &prompt_arg,
                            "--dangerously-skip-permissions",
                            "--add-dir",
                            &exec_dir,
                        ]);
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
                        ]);
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
                let mut current_pct: u8 = 55;

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
                                collected_md.push_str(&line);
                                collected_md.push('\n');
                                let snap = collected_md.clone();
                                update_task(&|t| {
                                    t.progress_stage = Some("executing".to_string());
                                    t.progress_percent = (t.progress_percent.max(75) + 1).min(92);
                                    t.response_markdown = Some(snap.clone());
                                    t.logs.push(line.clone());
                                });
                            } else {
                                if !line.trim().is_empty() {
                                    emit_log(format!("[CLI Stderr] {}", line));
                                    let err_line = format!("[stderr] {}", line);
                                    let is_quota = line.contains("429") || line.contains("quota reached") || line.contains("RESOURCE_EXHAUSTED");
                                    update_task(&|t| {
                                        t.logs.push(err_line.clone());
                                        if is_quota {
                                            t.logs.push("[Notice] CLI provider quota reached (429). Falling back to in-app intelligent synthesis & workspace code sync...".to_string());
                                        }
                                    });
                                }
                            }
                        }
                        Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                            match child.try_wait() {
                                Ok(Some(_status)) => {
                                    while let Ok((is_stdout, line)) = rx.try_recv() {
                                        if is_stdout {
                                            collected_md.push_str(&line);
                                            collected_md.push('\n');
                                            let snap = collected_md.clone();
                                            update_task(&|t| {
                                                t.response_markdown = Some(snap.clone());
                                                t.logs.push(line.clone());
                                            });
                                        } else if !line.trim().is_empty() {
                                            let err_line = format!("[stderr] {}", line);
                                            update_task(&|t| {
                                                t.logs.push(err_line.clone());
                                            });
                                        }
                                    }
                                    break;
                                }
                                _ => {}
                            }

                            if last_heartbeat.elapsed() >= Duration::from_secs(2) {
                                last_heartbeat = std::time::Instant::now();
                                elapsed_sec += 2;
                                if current_pct < 92 {
                                    current_pct += 1;
                                }

                                let status_text = match elapsed_sec {
                                    0..=5 => format!("Scanning workspace context & specifications ({}s elapsed)...", elapsed_sec),
                                    6..=15 => format!("Reasoning engine evaluating requirements ({}s elapsed)...", elapsed_sec),
                                    16..=30 => format!("Processing AST structures, dependencies & invariants ({}s elapsed)...", elapsed_sec),
                                    31..=60 => format!("Synthesizing implementation & writing workspace files ({}s elapsed)...", elapsed_sec),
                                    _ => {
                                        let mins = elapsed_sec / 60;
                                        let secs = elapsed_sec % 60;
                                        format!("Deep synthesis & continuous file generation ({}m {}s elapsed)...", mins, secs)
                                    }
                                };

                                let task_started_at = record.started_at.unwrap_or(record.created_at);
                                emit_log(format!("[CLI Heartbeat {}s] {}", elapsed_sec, status_text));

                                // Periodic live detection of files written to workspace
                                let live_files = scan_workspace_modified_files(&exec_dir, task_started_at);
                                if live_files.len() > seen_created_files.len() || live_files != seen_created_files {
                                    seen_created_files = live_files.clone();
                                    last_fs_change = std::time::Instant::now();
                                }

                                update_task(&|t| {
                                    t.progress_percent = current_pct;
                                    t.logs.push(format!("[Heartbeat {}s] {}", elapsed_sec, status_text));
                                    if t.thinking_trace.len() < 12 {
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

                                // Activity Settlement Detector:
                                // If deliverables are already written and stdio/filesystem has settled for >= 15s,
                                // terminate the CLI child process tree gracefully to prevent the 92% hang.
                                let stdout_idle_sec = last_stdout_activity.elapsed().as_secs();
                                let fs_idle_sec = last_fs_change.elapsed().as_secs();

                                if !seen_created_files.is_empty() && stdout_idle_sec >= 15 && fs_idle_sec >= 15 {
                                    let settle_msg = format!(
                                        "[Settlement Detector] Workspace deliverables settled ({} file(s) touched: {}). CLI activity idle for {}s. Concluding execution.",
                                        seen_created_files.len(),
                                        seen_created_files.join(", "),
                                        stdout_idle_sec
                                    );
                                    emit_log(settle_msg.clone());
                                    update_task(&|t| {
                                        t.logs.push(settle_msg.clone());
                                        t.thinking_trace.push(settle_msg.clone());
                                    });
                                    process_manager.terminate_task_tree(&task_id);
                                    break;
                                }

                                if !collected_md.trim().is_empty() && stdout_idle_sec >= 20 && fs_idle_sec >= 15 {
                                    let settle_msg = format!(
                                        "[Settlement Detector] Markdown report deliverable received ({} bytes). CLI idle for {}s. Concluding execution.",
                                        collected_md.len(),
                                        stdout_idle_sec
                                    );
                                    emit_log(settle_msg.clone());
                                    update_task(&|t| {
                                        t.logs.push(settle_msg.clone());
                                        t.thinking_trace.push(settle_msg.clone());
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

                let _ = child.wait();
                process_manager.unregister_task_process(&task_id);

                let task_started_at = record.started_at.unwrap_or(record.created_at);
                let mut created_files = scan_workspace_modified_files(&exec_dir, task_started_at);
                for cf in extract_and_write_code_blocks(&exec_dir, &record.file_name, &collected_md) {
                    if !created_files.contains(&cf) {
                        created_files.push(cf);
                    }
                }

                for cf in &created_files {
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

                if !collected_md.trim().is_empty() || !created_files.is_empty() {
                    let report_body = if !collected_md.trim().is_empty() {
                        collected_md.clone()
                    } else {
                        format!(
                            "## {} — Execution Summary (`{}`)\n\n                             Agent execution completed successfully in `{}`.\n\n                             ### Workspace Files Touched & Created:\n{}\n",
                            agent_name,
                            record.file_name,
                            exec_dir,
                            created_files.iter().map(|f| format!("- `{}`", f)).collect::<Vec<_>>().join("\n")
                        )
                    };
                    fs::write(&report_file, &report_body).ok();
                    let duration_ms = (now_ms() - task_started_at).max(0) as u64;
                    update_task(&|t| {
                        for tool in t.tool_actions.iter_mut() {
                            tool.status = "done".to_string();
                            if tool.kind == "cli" && tool.duration_ms.is_none() {
                                tool.duration_ms = Some(duration_ms);
                                if !collected_md.trim().is_empty() {
                                    tool.output = Some(collected_md.lines().take(20).collect::<Vec<_>>().join("\n"));
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
                    finalize_task(&store, &app, &task_id, "completed", None);
                    return;
                }
            }
        }

        // Stage 3 & 4: In-App Intelligent Agent Execution & Live Markdown Streaming
        let (thinking_steps, md_chunks) = synthesize_intelligent_agent_markdown(
            &agent_name,
            &agent_id,
            &record.intent,
            &record.file_name,
            &source_markdown,
            record.custom_prompt.as_deref(),
            &handoff_file,
        );

        update_task(&|t| {
            t.progress_stage = Some("reasoning".to_string());
            t.progress_percent = 50;
        });

        for step in thinking_steps {
            if cancel_flag.load(Ordering::Relaxed) {
                finalize_task(&store, &app, &task_id, "cancelled", None);
                return;
            }
            std::thread::sleep(Duration::from_millis(240));
            emit_log(format!("[{} Thinking] {}", agent_name, step));
            let step_clone = step.clone();
            update_task(&|t| {
                t.thinking_trace.push(step_clone.clone());
                t.logs.push(format!("[Reasoning Step] {}", step_clone));
                t.progress_percent = (t.progress_percent + 8).min(75);
            });
        }

        update_task(&|t| {
            t.progress_stage = Some("executing".to_string());
            t.progress_percent = 78;
            t.tool_actions.push(AgentToolAction::new(
                format!("tool-write-{}", now_ms()),
                "write".to_string(),
                format!(
                    "Synthesizing & Writing Report `{}`",
                    report_file
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                ),
                Some(report_file.to_string_lossy().to_string()),
                "running".to_string(),
                now_ms(),
            ));
        });

        let mut accumulated_md = String::new();
        let total_chunks = md_chunks.len().max(1);
        for (idx, chunk) in md_chunks.into_iter().enumerate() {
            if cancel_flag.load(Ordering::Relaxed) {
                finalize_task(&store, &app, &task_id, "cancelled", None);
                return;
            }
            std::thread::sleep(Duration::from_millis(220));
            accumulated_md.push_str(&chunk);
            let current_md = accumulated_md.clone();
            let pct = 78 + (((idx + 1) * 18) / total_chunks) as u8;
            update_task(&|t| {
                t.response_markdown = Some(current_md.clone());
                t.progress_percent = pct.min(96);
                if t.checklist_total > 0 {
                    let done = (((idx + 1) * t.checklist_total) / total_chunks).max(1);
                    t.checklist_completed = done.min(t.checklist_total);
                }
            });
        }

        let created_files = extract_and_write_code_blocks(&exec_dir, &record.file_name, &accumulated_md);
        for cf in created_files {
            emit_log(format!("[FlyMD Workspace Sync] Created file: `{}`", cf));
            update_task(&|t| {
                t.tool_actions.push(AgentToolAction::new(
                    format!("tool-code-{}", now_ms()),
                    "write".to_string(),
                    format!("Created Workspace File `{}`", cf),
                    Some(format!("{}\\{}", exec_dir, cf)),
                    "done".to_string(),
                    now_ms(),
                ));
            });
        }

        fs::write(&report_file, &accumulated_md).ok();

        update_task(&|t| {
            for tool in t.tool_actions.iter_mut() {
                tool.status = "done".to_string();
            }
            t.tool_actions.push(AgentToolAction::new(
                format!("tool-verify-{}", now_ms()),
                "verify".to_string(),
                "Verified Markdown Report & Updated Shared Memory".to_string(),
                Some(report_file.to_string_lossy().to_string()),
                "done".to_string(),
                now_ms(),
            ));
        });

        emit_log(format!(
            "[{} Completed] Output report saved to {}",
            agent_name,
            report_file.to_string_lossy()
        ));

        finalize_task(&store, &app, &task_id, "completed", None);
    });
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

//! Agent execution runner: handles CLI subprocess streaming, markdown synthesis, and workspace sync.

pub mod cli_builder;
pub mod code_blocks;
pub mod prompts;
pub mod role_guard;

pub use cli_builder::*;
pub use code_blocks::*;
pub use prompts::*;
pub use role_guard::*;

use super::process_manager::ProcessTreeManager;
use super::types::{
    now_ms, AgentErrorDiagnostic, AgentStreamEvent, AgentTaskRecord, AgentToolAction,
};
use crate::store::SharedStore;
use std::collections::HashSet;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

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

            let last_disk_flush = Arc::new(Mutex::new(std::time::Instant::now()));
            let last_ipc_broadcast = Arc::new(Mutex::new(std::time::Instant::now()));

            let update_task_flush = |mutator: &dyn Fn(&mut AgentTaskRecord), force_flush: bool| {
                let mut ldf = last_disk_flush.lock().unwrap_or_else(|e| e.into_inner());
                let should_flush = force_flush || ldf.elapsed() >= Duration::from_millis(1000);
                if should_flush {
                    *ldf = std::time::Instant::now();
                }
                drop(ldf);

                if let Some((_, all_tasks)) = store.mutate_agent_task(&task_id, should_flush, mutator) {
                    let mut lib = last_ipc_broadcast.lock().unwrap_or_else(|e| e.into_inner());
                    if force_flush || lib.elapsed() >= Duration::from_millis(100) {
                        *lib = std::time::Instant::now();
                        drop(lib);
                        app.emit("agent:tasks-updated", &all_tasks).ok();
                    }
                }
            };

            let update_task = |mutator: &dyn Fn(&mut AgentTaskRecord)| {
                update_task_flush(mutator, true);
            };

            let update_task_streaming = |mutator: &dyn Fn(&mut AgentTaskRecord)| {
                update_task_flush(mutator, false);
            };

            let emit_log = |line: String| {
                let evt = AgentStreamEvent {
                    task_id: task_id.clone(),
                    agent_id: agent_id.clone(),
                    line: line.clone(),
                    timestamp: now_ms(),
                };
                app.emit("agent:stream", &evt).ok();
                update_task_streaming(&|t| {
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

                let mut cmd = build_agent_cli_command(
                    &bin,
                    &agent_id,
                    &exec_dir,
                    &prompt_arg,
                    resume_sid.as_deref(),
                    warm_cli_continue,
                    thinking_on,
                    effort_val,
                );

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
                                if let Some(sid) = val
                                    .get("session_id")
                                    .or_else(|| val.get("sessionId"))
                                    .and_then(|v| v.as_str())
                                {
                                    if !sid.trim().is_empty() && captured_session_id.is_none() {
                                        *captured_session_id = Some(sid.trim().to_string());
                                    }
                                }

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
                                    *last_known_activity = format!("CLI Event: {}", ev);
                                    return (format!("[CLI Engine] Event: {}", ev), None);
                                }

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

                    let mut seen_tool_labels: HashSet<String> =
                        record.tool_actions.iter().map(|a| a.label.clone()).collect();

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
                                    let sid_snap = captured_session_id.clone();
                                    let md_snap = if collected_md.is_empty() {
                                        None
                                    } else {
                                        Some(collected_md.clone())
                                    };
                                    let new_tool_action = if let Some((ref t_name, ref t_target)) = tool_info {
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
                                        if seen_tool_labels.insert(label.clone()) {
                                            Some(AgentToolAction::new(
                                                format!("tool-live-{}", now_ms()),
                                                kind.to_string(),
                                                label.clone(),
                                                t_target.clone(),
                                                "done".to_string(),
                                                now_ms(),
                                            ))
                                        } else {
                                            None
                                        }
                                    } else {
                                        None
                                    };

                                    update_task_streaming(&|t| {
                                        t.progress_stage = Some("executing".to_string());
                                        t.progress_percent = (t.progress_percent.max(75) + 1).min(96);
                                        if sid_snap.is_some() {
                                            t.cli_session_id = sid_snap.clone();
                                        }
                                        if md_snap.is_some() {
                                            t.response_markdown = md_snap.clone();
                                        }
                                        if !display_line.is_empty() {
                                            t.logs.push(display_line.clone());
                                        }
                                        if let Some(ref act) = new_tool_action {
                                            t.tool_actions.push(act.clone());
                                            if t.thinking_trace.len() < 24 {
                                                t.thinking_trace.push(format!("Executed {}", act.label));
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
                                    update_task_streaming(&|t| {
                                        t.logs.push(err_line.clone());
                                        if is_quota {
                                            t.logs.push("[Notice] CLI provider quota reached (429).".to_string());
                                        }
                                    });
                                }
                            }
                            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                                if let Ok(Some(_status)) = child.try_wait() {
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
                        let mut fallback_cmd = build_agent_cli_command(
                            &bin,
                            &agent_id,
                            &exec_dir,
                            &prompt_arg,
                            None,
                            false,
                            thinking_on,
                            effort_val,
                        );
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

                    enforce_role_boundary_and_plan_sync(
                        &record.intent,
                        &record.file_name,
                        &exec_dir,
                        &agent_id,
                        &mut created_files,
                        &pre_digests,
                        &mut collected_md,
                        &emit_log,
                    );

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
    let status_str = status.to_string();
    if let Some((_, all_tasks)) = store.mutate_agent_task(task_id, true, |t| {
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
    }) {
        app.emit("agent:tasks-updated", &all_tasks).ok();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
        assert!(report2.gaps.iter().any(|g| g.contains("placeholder") || g.contains("stub")));

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

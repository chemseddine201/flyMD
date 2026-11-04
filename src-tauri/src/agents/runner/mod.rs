//! Agent execution runner coordinator: orchestrates CLI subprocess lifecycle,
//! delegating stream decoding, watchdog liveness, role boundaries, diagnostics, and handoff persistence.

pub mod cli_builder;
pub mod code_blocks;
pub mod diagnostics;
pub mod handoff;
pub mod prompts;
pub mod role_guard;
pub mod stream_decoder;
pub mod watchdog;

pub use cli_builder::*;
pub use code_blocks::*;
pub use diagnostics::*;
pub use handoff::*;
pub use prompts::*;
pub use role_guard::*;
pub use stream_decoder::*;
pub use watchdog::*;

use super::process_manager::ProcessTreeManager;
use super::types::{now_ms, AgentStreamEvent, AgentTaskRecord, AgentToolAction};
use crate::store::SharedStore;
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

#[derive(Debug)]
pub struct CliProcessRunResult {
    pub exit_status: Option<std::process::ExitStatus>,
    pub exit_code: Option<i32>,
    pub decode_state: StreamDecodeState,
    pub created_files: Vec<String>,
    pub exited_err: bool,
    pub retried: bool,
    pub was_stalled: bool,
    pub stall_timeout_msg: Option<String>,
}

#[allow(clippy::too_many_arguments)]
pub fn run_agent_cli_subprocess_loop<FLog, FStreaming, FUpdate, FUpdateStreaming>(
    bin: &str,
    agent_id: &str,
    agent_name: &str,
    exec_dir: &str,
    prompt_arg: &str,
    resume_sid: Option<&str>,
    warm_cli_continue: bool,
    thinking_on: bool,
    effort_val: &str,
    model_val: Option<&str>,
    token_saver: Option<&str>,
    env_credentials: Option<(&str, &str)>,
    task_started_at: i64,
    intent: &str,
    task_id: &str,
    existing_tool_actions: &[AgentToolAction],
    cancel_flag: &AtomicBool,
    process_manager: Option<&ProcessTreeManager>,
    mut emit_log: FLog,
    mut on_streaming_update: FStreaming,
    mut update_task: FUpdate,
    mut update_task_streaming: FUpdateStreaming,
) -> Option<CliProcessRunResult>
where
    FLog: FnMut(String),
    FStreaming: FnMut(&StdoutLineOutcome, &StreamDecodeState),
    FUpdate: FnMut(&dyn Fn(&mut AgentTaskRecord)),
    FUpdateStreaming: FnMut(&dyn Fn(&mut AgentTaskRecord)),
{
    let mut fuse_effort = false;
    let mut attempts = 0;
    let mut retried = false;

    while attempts < 2 {
        attempts += 1;

        let mut cmd = crate::agents::runner::cli_builder::build_agent_cli_command_with_mode(
            bin,
            agent_id,
            exec_dir,
            prompt_arg,
            resume_sid,
            warm_cli_continue,
            thinking_on,
            effort_val,
            model_val,
            fuse_effort,
            Some(intent),
            token_saver,
        );

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        cmd.env("PYTHONIOENCODING", "utf-8")
            .env("PYTHONUTF8", "1")
            .env("LANG", "en_US.UTF-8")
            .env("LC_ALL", "en_US.UTF-8")
            .current_dir(exec_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if let Some((env_name, api_key)) = env_credentials {
            if !api_key.trim().is_empty() {
                cmd.env(env_name, api_key.trim());
            }
        }

        if let Ok(mut child) = cmd.spawn() {
            let child_pid = child.id();
            if let Some(pm) = process_manager {
                pm.register_task_process(task_id, child_pid, agent_id, exec_dir);
            }

            let spawn_msg = if attempts == 1 {
                format!(
                    "CLI process running (PID: {}) in `{}` - monitoring live execution...",
                    child_pid, exec_dir
                )
            } else {
                format!(
                    "Retried CLI process running (PID: {}) in `{}` with fused model/effort...",
                    child_pid, exec_dir
                )
            };
            emit_log(format!("[CLI Engine] {}", spawn_msg));
            update_task(&|t| {
                t.progress_stage = Some("reasoning".to_string());
                t.progress_percent = 55;
                t.thinking_trace.push(spawn_msg.clone());
                t.logs.push(format!("[CLI Spawn] {}", spawn_msg));
            });

            let rx = spawn_stdio_reader_threads(child.stdout.take(), child.stderr.take());
            let mut decode_state = StreamDecodeState::new(
                resume_sid.map(|s| s.to_string()),
                format!(
                    "Spawned {} subprocess (PID: {}) in `{}`",
                    agent_name, child_pid, exec_dir
                ),
                existing_tool_actions,
            );
            let mut watchdog = WatchdogTracker::new();

            loop {
                if cancel_flag.load(Ordering::Relaxed) {
                    if let Some(pm) = process_manager {
                        pm.terminate_task_tree(task_id);
                    }
                    return None;
                }

                match rx.recv_timeout(Duration::from_millis(500)) {
                    Ok((is_stdout, line)) => {
                        watchdog.note_stream_activity();
                        if is_stdout {
                            let outcome = decode_stdout_line(&line, &mut decode_state);
                            on_streaming_update(&outcome, &decode_state);
                        } else if !line.trim().is_empty() {
                            emit_log(format!("[CLI Stderr] {}", line));
                            let (err_line, is_quota) =
                                record_stderr_line(&line, &mut decode_state);
                            update_task_streaming(&|t| {
                                t.logs.push(err_line.clone());
                                if is_quota {
                                    t.logs.push(
                                        "[Notice] CLI provider quota reached (429)."
                                            .to_string(),
                                    );
                                }
                            });
                        }
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                        if let Ok(Some(_status)) = child.try_wait() {
                            let drain_deadline =
                                Instant::now() + Duration::from_millis(1500);
                            while Instant::now() < drain_deadline {
                                match rx.recv_timeout(Duration::from_millis(150)) {
                                    Ok((is_stdout, line)) => {
                                        if is_stdout {
                                            let _ = decode_stdout_line(
                                                &line,
                                                &mut decode_state,
                                            );
                                        } else if !line.trim().is_empty() {
                                            let (err_line, _) = record_stderr_line(
                                                &line,
                                                &mut decode_state,
                                            );
                                            update_task_streaming(&|t| {
                                                t.logs.push(err_line.clone());
                                            });
                                        }
                                    }
                                    Err(_) => break,
                                }
                            }
                            let snap = decode_state.collected_md.clone();
                            let sid_snap = decode_state.captured_session_id.clone();
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

                        if let Some(tick) = watchdog.poll_heartbeat(
                            intent,
                            exec_dir,
                            task_started_at,
                            &mut decode_state.last_known_activity,
                        ) {
                            emit_log(format!(
                                "[CLI Heartbeat {}s] {}",
                                tick.elapsed_sec, tick.status_text
                            ));

                            update_task(&|t| {
                                t.progress_percent = tick.current_pct;
                                t.logs.push(format!(
                                    "[Heartbeat {}s] {}",
                                    tick.elapsed_sec, tick.status_text
                                ));
                                if t.thinking_trace.len() < 16 {
                                    t.thinking_trace
                                        .push(format!("Active: {}", tick.status_text));
                                }
                                for lf in &tick.live_files {
                                    if !t.tool_actions.iter().any(|a| a.label.contains(lf))
                                    {
                                        t.tool_actions.push(AgentToolAction::new(
                                            format!("tool-code-{}", now_ms()),
                                            "write".to_string(),
                                            format!("Workspace File `{}`", lf),
                                            Some(format!("{}\\{}", exec_dir, lf)),
                                            "done".to_string(),
                                            now_ms(),
                                        ));
                                        t.thinking_trace.push(format!(
                                            "Live Sync: Generated workspace file `{}`",
                                            lf
                                        ));
                                    }
                                }
                            });

                            if let Some(timeout_msg) = tick.stall_timeout_msg {
                                emit_log(timeout_msg.clone());
                                update_task(&|t| {
                                    t.progress_percent = 98;
                                    t.logs.push(timeout_msg.clone());
                                    t.thinking_trace.push(timeout_msg.clone());
                                    t.outcome_reason = Some(timeout_msg.clone());
                                });
                                if let Some(pm) = process_manager {
                                    pm.terminate_task_tree(task_id);
                                }
                                break;
                            }
                        }
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }

            let exit_status = child.wait().ok();
            let exit_code = exit_status.and_then(|s| s.code());
            if let Some(pm) = process_manager {
                pm.unregister_task_process(task_id);
            }

            let mut created_files =
                scan_workspace_modified_files(exec_dir, task_started_at);
            let exited_err = exit_status.map(|s| !s.success()).unwrap_or(true);

            if (warm_cli_continue || resume_sid.is_some())
                && exited_err
                && decode_state.collected_md.trim().is_empty()
                && created_files.is_empty()
                && !cancel_flag.load(Ordering::Relaxed)
            {
                emit_log("[CLI Cache Fallback] Warm/resume session unavailable; retrying stateless `-p` with cognitive cache envelope...".to_string());
                let mut fallback_cmd = build_agent_cli_command(
                    bin,
                    agent_id,
                    exec_dir,
                    prompt_arg,
                    None,
                    false,
                    thinking_on,
                    effort_val,
                    model_val,
                );
                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    fallback_cmd.creation_flags(0x08000000);
                }
                fallback_cmd
                    .env("PYTHONIOENCODING", "utf-8")
                    .env("PYTHONUTF8", "1")
                    .env("LANG", "en_US.UTF-8")
                    .env("LC_ALL", "en_US.UTF-8")
                    .current_dir(exec_dir);
                if let Ok(out) = fallback_cmd.output() {
                    let stdout_txt = String::from_utf8_lossy(&out.stdout);
                    if !stdout_txt.trim().is_empty() {
                        decode_state.collected_md.push_str(&stdout_txt);
                    }
                    created_files = scan_workspace_modified_files(exec_dir, task_started_at);
                }
            }

            // Antigravity retry for "invalid model selection" (B2)
            let is_invalid_model = decode_state
                .captured_cli_error
                .as_deref()
                .unwrap_or("")
                .contains("invalid model selection")
                || decode_state
                    .stderr_lines
                    .iter()
                    .any(|l| l.contains("invalid model selection"));
            let has_model = model_val.map(|m| !m.trim().is_empty()).unwrap_or(false);

            if agent_id == "antigravity"
                && attempts == 1
                && has_model
                && exited_err
                && is_invalid_model
                && decode_state.collected_md.trim().is_empty()
                && created_files.is_empty()
                && !cancel_flag.load(Ordering::Relaxed)
            {
                emit_log("[Antigravity Model Retry] CLI rejected model/effort combination ('invalid model selection'); retrying with `--model <base>-<effort>` without `--effort`...".to_string());
                fuse_effort = true;
                retried = true;
                continue;
            }

            return Some(CliProcessRunResult {
                exit_status,
                exit_code,
                decode_state,
                created_files,
                exited_err,
                retried,
                was_stalled: watchdog.was_stalled,
                stall_timeout_msg: watchdog.stall_timeout_msg,
            });
        }
        break;
    }

    None
}

#[allow(clippy::too_many_arguments)]
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

            let last_disk_flush = Arc::new(Mutex::new(Instant::now()));
            let last_ipc_broadcast = Arc::new(Mutex::new(Instant::now()));

            let update_task_flush = |mutator: &dyn Fn(&mut AgentTaskRecord), force_flush: bool| {
                let mut ldf = last_disk_flush.lock().unwrap_or_else(|e| e.into_inner());
                let should_flush = force_flush || ldf.elapsed() >= Duration::from_millis(1000);
                if should_flush {
                    *ldf = Instant::now();
                }
                drop(ldf);

                let mut lib = last_ipc_broadcast.lock().unwrap_or_else(|e| e.into_inner());
                let should_emit_ipc = force_flush || lib.elapsed() >= Duration::from_millis(100);
                if should_emit_ipc {
                    *lib = Instant::now();
                }
                drop(lib);

                if let Some(Some(changed_task)) =
                    store.mutate_agent_task(&task_id, should_flush, should_emit_ipc, mutator)
                {
                    app.emit("agent:tasks-updated", &changed_task).ok();
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
                    let prompt_summary = instructions
                        .lines()
                        .next()
                        .unwrap_or("Execute mission")
                        .to_string();
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
                let epistemic_dec =
                    crate::discussion::epistemic::evaluate_pipeline_epistemic_policy(
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

                let resume_sid = record
                    .cli_session_id
                    .clone()
                    .filter(|s| !s.trim().is_empty());
                let raw_effort = record
                    .effort_level
                    .as_deref()
                    .unwrap_or("medium")
                    .to_lowercase();
                let effort_val = match raw_effort.as_str() {
                    "low" | "medium" | "high" | "xhigh" | "max" => raw_effort.as_str(),
                    _ => "medium",
                };
                let thinking_on = record.thinking_enabled.unwrap_or(true);
                let model_val = record.model_id.as_deref();

                emit_log(format!(
                    "[Reasoning Config] Agent: {} | Model: {} | Effort: {} | Thinking: {}",
                    agent_name,
                    model_val.unwrap_or("default"),
                    effort_val,
                    if thinking_on { "ON" } else { "OFF" }
                ));

                let env_credentials = match (&profile, &user_cred) {
                    (Some(prof), Some(cred)) => match (&prof.env_key_name, &cred.api_key) {
                        (Some(k), Some(v)) if !v.trim().is_empty() => Some((k.as_str(), v.as_str())),
                        _ => None,
                    },
                    _ => None,
                };
                let task_started_at = record.started_at.unwrap_or(record.created_at);
                let last_md_snap = std::sync::Mutex::new(std::time::Instant::now());

                let run_res = run_agent_cli_subprocess_loop(
                    &bin,
                    &agent_id,
                    &agent_name,
                    &exec_dir,
                    &prompt_arg,
                    resume_sid.as_deref(),
                    warm_cli_continue,
                    thinking_on,
                    effort_val,
                    model_val,
                    record.token_saver.as_deref(),
                    env_credentials,
                    task_started_at,
                    &record.intent,
                    &task_id,
                    &record.tool_actions,
                    &cancel_flag,
                    Some(&process_manager),
                    &emit_log,
                    |outcome, ds| {
                        let sid_snap = ds.captured_session_id.clone();
                        let mut lms = last_md_snap.lock().unwrap_or_else(|e| e.into_inner());
                        let should_copy_md = lms.elapsed() >= Duration::from_millis(500);
                        let md_snap = if should_copy_md && !ds.collected_md.is_empty() {
                            *lms = Instant::now();
                            Some(ds.collected_md.clone())
                        } else {
                            None
                        };
                        drop(lms);
                        update_task_streaming(&|t| {
                            t.progress_stage = Some("executing".to_string());
                            t.progress_percent = (t.progress_percent.max(75) + 1).min(96);
                            if sid_snap.is_some() {
                                t.cli_session_id = sid_snap.clone();
                            }
                            if md_snap.is_some() {
                                t.response_markdown = md_snap.clone();
                            }
                            if !outcome.display_line.is_empty() {
                                t.logs.push(outcome.display_line.clone());
                            }
                            if let Some(ref act) = outcome.new_tool_action {
                                t.tool_actions.push(act.clone());
                                if t.thinking_trace.len() < 24 {
                                    t.thinking_trace.push(format!("Executed {}", act.label));
                                }
                            }
                        });
                    },
                    &update_task,
                    &update_task_streaming,
                );

                if cancel_flag.load(Ordering::Relaxed) {
                    process_manager.terminate_task_tree(&task_id);
                    finalize_task(&store, &app, &task_id, "cancelled", None);
                    return;
                }

                if let Some(CliProcessRunResult {
                    exit_status: _,
                    exit_code,
                    mut decode_state,
                    mut created_files,
                    exited_err,
                    retried: _,
                    was_stalled,
                    stall_timeout_msg,
                }) = run_res
                {



                    enforce_role_boundary_and_plan_sync(
                        &record.intent,
                        &record.file_name,
                        &exec_dir,
                        &agent_id,
                        &mut created_files,
                        &pre_digests,
                        &mut decode_state.collected_md,
                        &emit_log,
                    );

                    let post_digests =
                        crate::projects::cache::scan_workspace_digest(Path::new(&exec_dir), 64);
                    let mut actually_modified_files: Vec<String> = Vec::new();
                    let mut seen_modified_set: HashSet<String> = HashSet::new();
                    for cf in &created_files {
                        let changed = match (pre_digests.get(cf), post_digests.get(cf)) {
                            (None, Some(_)) => true,
                            (Some(a), Some(b)) => a.sha256 != b.sha256,
                            _ => false,
                        };
                        if changed && seen_modified_set.insert(cf.clone()) {
                            actually_modified_files.push(cf.clone());
                        }
                    }

                    let effective_files_to_report = if !actually_modified_files.is_empty() {
                        actually_modified_files
                    } else {
                        created_files
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

                    let error_diagnostic = build_execution_error_diagnostic(DiagnosticInput {
                        final_status,
                        was_stalled,
                        stall_timeout_msg: stall_timeout_msg.as_deref(),
                        last_known_activity: &decode_state.last_known_activity,
                        captured_cli_error: decode_state.captured_cli_error.as_deref(),
                        stderr_lines: &decode_state.stderr_lines,
                        exited_err,
                        exit_code,
                        captured_session_id: decode_state.captured_session_id.clone(),
                        effective_files_to_report: &effective_files_to_report,
                        v_report: &v_report,
                    });

                    let raw_report_body = if !decode_state.collected_md.trim().is_empty() {
                        decode_state.collected_md.clone()
                    } else {
                        format_fallback_execution_summary(
                            &agent_name,
                            &record.file_name,
                            final_status,
                            &exec_dir,
                            &effective_files_to_report,
                            &v_report.summary,
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

                    let sid_final = decode_state.captured_session_id.clone();
                    let usage_final = decode_state.captured_usage.clone();

                    update_task(&|t| {
                        t.response_markdown = Some(clean_report_body.clone());
                        t.verification_report = Some(v_report.clone());
                        t.modified_files = effective_files_to_report.clone();
                        if let Some(u) = usage_final.clone() {
                            t.token_usage = Some(u);
                        }
                        if sid_final.is_some() {
                            t.cli_session_id = sid_final.clone();
                        }
                        if let Some(ref d) = error_diagnostic {
                            t.error_diagnostic = Some(d.clone());
                            t.outcome_reason = Some(d.exception_message.clone());
                            if final_status != "completed" {
                                t.error = Some(format!("{}: {}", d.title, d.exception_message));
                            }
                        } else if was_stalled {
                            t.outcome_reason = Some(
                                "Task stalled due to inactivity watchdog or safety ceiling."
                                    .to_string(),
                            );
                        } else if !v_report.passed {
                            t.outcome_reason = Some(v_report.summary.clone());
                        }
                        for tool in t.tool_actions.iter_mut() {
                            tool.status = "done".to_string();
                            if tool.kind == "cli" && tool.duration_ms.is_none() {
                                tool.duration_ms = Some(duration_ms);
                                if !clean_report_body.trim().is_empty() {
                                    tool.output = Some(
                                        clean_report_body
                                            .lines()
                                            .take(20)
                                            .collect::<Vec<_>>()
                                            .join("\n"),
                                    );
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
                t.error_diagnostic = Some(build_missing_binary_diagnostic(&err_msg));
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
            let _ = panic_store.mutate_agent_task(&panic_task_id, true, false, |t| {
                t.error_diagnostic = Some(build_panic_diagnostic(
                    &panic_msg,
                    t.cli_session_id.clone(),
                    t.modified_files.clone(),
                ));
            });
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicBool;

    #[test]
    fn test_pipeline_antigravity_retry_works() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_pipe_retry_{}", now_ms()));
        let bin_dir = temp_dir.join("bin");
        let ws_dir = temp_dir.join("workspace");
        let _ = std::fs::create_dir_all(&bin_dir);
        let _ = std::fs::create_dir_all(&ws_dir);

        #[cfg(target_os = "windows")]
        let script = bin_dir.join("fake_agy_retry.cmd");
        #[cfg(not(target_os = "windows"))]
        let script = bin_dir.join("fake_agy_retry.sh");

        #[cfg(target_os = "windows")]
        std::fs::write(
            &script,
            "@echo off\r\n\
             echo %* | findstr /C:\"--effort\" >nul\r\n\
             if not errorlevel 1 (\r\n\
                 echo error: invalid model selection: --effort is not supported 1>&2\r\n\
                 exit /b 1\r\n\
             )\r\n\
             echo Pipeline Recovered via Retry\r\n\
             exit /b 0\r\n",
        ).unwrap();
        #[cfg(not(target_os = "windows"))]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::write(
                &script,
                "#!/bin/sh\n\
                 case \"$*\" in\n\
                   *--effort*)\n\
                     echo 'error: invalid model selection: --effort not supported' >&2\n\
                     exit 1;;\n\
                   *)\n\
                     echo 'Pipeline Recovered via Retry'\n\
                     exit 0;;\n\
                 esac\n",
            ).unwrap();
            let mut perms = std::fs::metadata(&script).unwrap().permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&script, perms).unwrap();
        }

        let cancel_flag = AtomicBool::new(false);
        let run_res = run_agent_cli_subprocess_loop(
            script.to_str().unwrap(),
            "antigravity",
            "Antigravity",
            ws_dir.to_str().unwrap(),
            "test prompt",
            None,
            false,
            true,
            "medium",
            Some("gemini-4-argon"),
            None,
            None,
            now_ms(),
            "test_intent",
            "task-test-1",
            &[],
            &cancel_flag,
            None,
            |_| {},
            |_, _| {},
            |_| {},
            |_| {},
        );

        assert!(run_res.is_some(), "Execution must return run result");
        let res = run_res.unwrap();
        assert!(res.retried, "Must retry when CLI rejects model/effort combination");
        assert!(!res.exited_err, "Second attempt must succeed");
        assert_eq!(res.exit_code, Some(0));
        assert!(res.decode_state.collected_md.contains("Pipeline Recovered via Retry"));

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_pipeline_antigravity_both_fail() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_pipe_both_fail_{}", now_ms()));
        let bin_dir = temp_dir.join("bin");
        let ws_dir = temp_dir.join("workspace");
        let _ = std::fs::create_dir_all(&bin_dir);
        let _ = std::fs::create_dir_all(&ws_dir);

        #[cfg(target_os = "windows")]
        let script = bin_dir.join("fake_agy_both_fail.cmd");
        #[cfg(not(target_os = "windows"))]
        let script = bin_dir.join("fake_agy_both_fail.sh");

        #[cfg(target_os = "windows")]
        std::fs::write(
            &script,
            "@echo off\r\n\
             echo error: invalid model selection: model not found 1>&2\r\n\
             exit /b 1\r\n",
        ).unwrap();
        #[cfg(not(target_os = "windows"))]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::write(
                &script,
                "#!/bin/sh\n\
                 echo 'error: invalid model selection: model not found' >&2\n\
                 exit 1\n",
            ).unwrap();
            let mut perms = std::fs::metadata(&script).unwrap().permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&script, perms).unwrap();
        }

        let cancel_flag = AtomicBool::new(false);
        let run_res = run_agent_cli_subprocess_loop(
            script.to_str().unwrap(),
            "antigravity",
            "Antigravity",
            ws_dir.to_str().unwrap(),
            "test prompt",
            None,
            false,
            true,
            "medium",
            Some("gemini-4-argon"),
            None,
            None,
            now_ms(),
            "test_intent",
            "task-test-2",
            &[],
            &cancel_flag,
            None,
            |_| {},
            |_, _| {},
            |_| {},
            |_| {},
        );

        assert!(run_res.is_some(), "Execution must return run result");
        let res = run_res.unwrap();
        assert!(res.retried, "Must attempt retry");
        assert!(res.exited_err, "Must report error when both attempts fail");
        assert_eq!(res.exit_code, Some(1));
        assert!(res.decode_state.stderr_lines.iter().any(|l| l.contains("invalid model selection")));

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_pipeline_antigravity_skip_retry_when_no_model() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_pipe_no_model_{}", now_ms()));
        let bin_dir = temp_dir.join("bin");
        let ws_dir = temp_dir.join("workspace");
        let _ = std::fs::create_dir_all(&bin_dir);
        let _ = std::fs::create_dir_all(&ws_dir);

        #[cfg(target_os = "windows")]
        let script = bin_dir.join("fake_agy_no_model.cmd");
        #[cfg(not(target_os = "windows"))]
        let script = bin_dir.join("fake_agy_no_model.sh");

        #[cfg(target_os = "windows")]
        std::fs::write(
            &script,
            "@echo off\r\n\
             echo error: invalid model selection: model not found 1>&2\r\n\
             exit /b 1\r\n",
        ).unwrap();
        #[cfg(not(target_os = "windows"))]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::write(
                &script,
                "#!/bin/sh\n\
                 echo 'error: invalid model selection: model not found' >&2\n\
                 exit 1\n",
            ).unwrap();
            let mut perms = std::fs::metadata(&script).unwrap().permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&script, perms).unwrap();
        }

        let cancel_flag = AtomicBool::new(false);
        let run_res = run_agent_cli_subprocess_loop(
            script.to_str().unwrap(),
            "antigravity",
            "Antigravity",
            ws_dir.to_str().unwrap(),
            "test prompt",
            None,
            false,
            true,
            "medium",
            None, // model_val is None -> skip retry!
            None,
            None,
            now_ms(),
            "test_intent",
            "task-test-3",
            &[],
            &cancel_flag,
            None,
            |_| {},
            |_, _| {},
            |_| {},
            |_| {},
        );

        assert!(run_res.is_some(), "Execution must return run result");
        let res = run_res.unwrap();
        assert!(!res.retried, "Must skip retry when no model is set");
        assert!(res.exited_err, "Must preserve original failed exit code");
        assert_eq!(res.exit_code, Some(1));
        assert!(res.decode_state.stderr_lines.iter().any(|l| l.contains("invalid model selection")));

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}

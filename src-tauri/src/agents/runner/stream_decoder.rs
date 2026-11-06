//! Subprocess stdout/stderr stream decoder and live tool action builder for agent CLI runs.

use crate::agents::types::{now_ms, AgentToolAction};
use crate::discussion::types::TokenUsage;
use std::collections::HashSet;
use std::io::{BufRead, BufReader};
use std::process::{ChildStderr, ChildStdout};
use std::sync::mpsc::{self, Receiver};

/// Mutable streaming decode state accumulated across CLI subprocess output lines.
#[derive(Debug)]
pub struct StreamDecodeState {
    pub collected_md: String,
    pub captured_session_id: Option<String>,
    pub captured_cli_error: Option<String>,
    pub last_known_activity: String,
    pub stderr_lines: Vec<String>,
    pub seen_tool_labels: HashSet<String>,
    pub captured_usage: Option<TokenUsage>,
}

impl StreamDecodeState {
    pub fn new(
        initial_session_id: Option<String>,
        initial_activity: String,
        existing_tool_actions: &[AgentToolAction],
    ) -> Self {
        let seen_tool_labels = existing_tool_actions
            .iter()
            .map(|a| a.label.clone())
            .collect();
        Self {
            collected_md: String::new(),
            captured_session_id: initial_session_id,
            captured_cli_error: None,
            last_known_activity: initial_activity,
            stderr_lines: Vec::new(),
            seen_tool_labels,
            captured_usage: None,
        }
    }
}

/// Decoded result of a single stdout line emitted by an agent CLI subprocess.
pub struct StdoutLineOutcome {
    pub display_line: String,
    pub new_tool_action: Option<AgentToolAction>,
}

/// Spawns non-blocking background reader threads for child stdout and stderr pipes,
/// multiplexing lines onto an `(is_stdout, line)` MPSC channel.
pub fn spawn_stdio_reader_threads(
    stdout: Option<ChildStdout>,
    stderr: Option<ChildStderr>,
) -> Receiver<(bool, String)> {
    let (tx, rx) = mpsc::channel::<(bool, String)>();

    if let Some(out) = stdout {
        let tx_out = tx.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(out);
            for line in reader.lines().map_while(Result::ok) {
                let _ = tx_out.send((true, line));
            }
        });
    }

    if let Some(err) = stderr {
        let tx_err = tx.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(err);
            for line in reader.lines().map_while(Result::ok) {
                let _ = tx_err.send((false, line));
            }
        });
    }

    drop(tx);
    rx
}

/// Decodes a single stdout line (JSON-Lines stream event or plain Markdown text)
/// and updates `state` in place, synthesizing deduplicated live `AgentToolAction` entries.
pub fn decode_stdout_line(line: &str, state: &mut StreamDecodeState) -> StdoutLineOutcome {
    let (display_line, tool_info) = parse_raw_stdout_line(
        line,
        &mut state.collected_md,
        &mut state.captured_session_id,
        &mut state.captured_cli_error,
        &mut state.last_known_activity,
        &mut state.captured_usage,
    );

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
            format!(
                "{}: `{}`",
                t_name,
                tf.split(['/', '\\']).next_back().unwrap_or(tf)
            )
        } else {
            format!("Tool: {}", t_name)
        };
        if state.seen_tool_labels.insert(label.clone()) {
            Some(AgentToolAction::new(
                format!("tool-live-{}", now_ms()),
                kind.to_string(),
                label,
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

    StdoutLineOutcome {
        display_line,
        new_tool_action,
    }
}

/// Records a non-empty stderr line into bounded trace history and checks for provider quota (429) signals.
pub fn record_stderr_line(line: &str, state: &mut StreamDecodeState) -> (String, bool) {
    let trimmed_err = line.trim().to_string();
    if state.stderr_lines.len() < 40 {
        state.stderr_lines.push(trimmed_err.clone());
    }
    let err_line = format!("[stderr] {}", line);
    let is_quota = line.contains("429")
        || line.contains("quota reached")
        || line.contains("RESOURCE_EXHAUSTED")
        || line.to_lowercase().contains("rate limit");
    if is_quota && state.captured_cli_error.is_none() {
        state.captured_cli_error = Some(trimmed_err);
    }
    (err_line, is_quota)
}

fn parse_raw_stdout_line(
    line: &str,
    collected_md: &mut String,
    captured_session_id: &mut Option<String>,
    captured_cli_error: &mut Option<String>,
    last_known_activity: &mut String,
    captured_usage: &mut Option<TokenUsage>,
) -> (String, Option<(String, Option<String>)>) {
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

            if let Some(delta) = val
                .pointer("/step_update/text_delta")
                .and_then(|v| v.as_str())
            {
                collected_md.push_str(delta);
                return (String::new(), None);
            } else if let Some(resp) = val.pointer("/result/response").and_then(|v| v.as_str()) {
                if !resp.trim().is_empty() {
                    *collected_md = resp.to_string();
                }
                *last_known_activity = format!("Completed CLI response ({} bytes)", resp.len());
                return (
                    format!("[CLI Engine Result] Completed ({} bytes)", resp.len()),
                    None,
                );
            } else if let Some(ev) = val.get("event").and_then(|v| v.as_str()) {
                *last_known_activity = format!("CLI Event: {}", ev);
                return (format!("[CLI Engine] Event: {}", ev), None);
            }

            if let Some(msg_type) = val.get("type").and_then(|v| v.as_str()) {
                match msg_type {
                    "system" => {
                        let subtype = val
                            .get("subtype")
                            .and_then(|v| v.as_str())
                            .unwrap_or("init");
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
                            let ev_type =
                                ev_obj.get("type").and_then(|v| v.as_str()).unwrap_or("");
                            if ev_type == "content_block_start" {
                                if let Some(cb) = ev_obj.get("content_block") {
                                    if cb.get("type").and_then(|v| v.as_str()) == Some("tool_use")
                                    {
                                        let tool_name = cb
                                            .get("name")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("Tool");
                                        let act = format!("Streaming tool call: `{}`", tool_name);
                                        *last_known_activity = act.clone();
                                        return (
                                            format!("[CLI Tool Start] {}", act),
                                            Some((tool_name.to_string(), None)),
                                        );
                                    }
                                }
                            } else if ev_type == "content_block_delta" {
                                if let Some(delta_obj) = ev_obj.get("delta") {
                                    let d_type = delta_obj
                                        .get("type")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("");
                                    if d_type == "text_delta" {
                                        if let Some(txt) =
                                            delta_obj.get("text").and_then(|v| v.as_str())
                                        {
                                            collected_md.push_str(txt);
                                        }
                                    }
                                }
                            }
                        }
                        return (String::new(), None);
                    }
                    "assistant" => {
                        if let Some(content_arr) =
                            val.pointer("/message/content").and_then(|v| v.as_array())
                        {
                            for block in content_arr {
                                let b_type =
                                    block.get("type").and_then(|v| v.as_str()).unwrap_or("");
                                if b_type == "tool_use" {
                                    let tool_name =
                                        block.get("name").and_then(|v| v.as_str()).unwrap_or("Tool");
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
                                    return (
                                        format!("[CLI Tool] {}", summary),
                                        Some((tool_name.to_string(), target_file)),
                                    );
                                } else if b_type == "text" {
                                    if let Some(txt) = block.get("text").and_then(|v| v.as_str()) {
                                        if collected_md.trim().is_empty() && !txt.trim().is_empty()
                                        {
                                            *collected_md = txt.to_string();
                                        }
                                    }
                                }
                            }
                        }
                        return (String::new(), None);
                    }
                    "result" => {
                        let is_err = val
                            .get("is_error")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false);
                        let res_text = val.get("result").and_then(|v| v.as_str()).unwrap_or("");

                        if let Some(usage_obj) = val.get("usage") {
                            let input_tokens = usage_obj
                                .get("input_tokens")
                                .and_then(|v| v.as_u64())
                                .unwrap_or(0) as u32;
                            let output_tokens = usage_obj
                                .get("output_tokens")
                                .and_then(|v| v.as_u64())
                                .unwrap_or(0) as u32;
                            let cache_read = usage_obj
                                .get("cache_read_input_tokens")
                                .and_then(|v| v.as_u64());
                            let cache_write = usage_obj
                                .get("cache_creation_input_tokens")
                                .and_then(|v| v.as_u64());
                            let cost_usd = val.get("total_cost_usd").and_then(|v| v.as_f64());
                            let cache_write_u32 = cache_write.unwrap_or(0) as u32;
                            let prompt_tokens = input_tokens + cache_write_u32;
                            let total_tokens = prompt_tokens + output_tokens;
                            *captured_usage = Some(TokenUsage {
                                prompt_tokens,
                                completion_tokens: output_tokens,
                                reasoning_tokens: 0,
                                total_tokens,
                                cache_read_tokens: cache_read,
                                cache_write_tokens: cache_write,
                                cost_usd,
                                basis: Some("reported".to_string()),
                            });
                        }

                        if is_err {
                            let err_msg = if !res_text.trim().is_empty() {
                                res_text.trim().to_string()
                            } else if let Some(errs) =
                                val.get("errors").and_then(|v| v.as_array())
                            {
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
                            *last_known_activity =
                                format!("Completed CLI session ({} bytes)", res_text.len());
                            return (
                                format!("[CLI Engine Result] Completed ({} bytes)", res_text.len()),
                                None,
                            );
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_claude_result_usage_totals_with_real_session_data() {
        // Real numbers from ~/.claude/projects/G--xampp-httpdocs-fly-test/0f2c62cd-e7c7-4004-82fe-9d5e02a2b689.jsonl
        let raw_line = r#"{"type":"result","status":"success","result":"Done.","total_cost_usd":0.0384,"usage":{"input_tokens":2,"cache_creation_input_tokens":8956,"cache_read_input_tokens":15570,"output_tokens":188}}"#;
        let mut state = StreamDecodeState::new(None, String::new(), &[]);
        decode_stdout_line(raw_line, &mut state);

        let usage = state.captured_usage.expect("Usage should be captured from result event");
        assert_eq!(usage.prompt_tokens, 2 + 8956); // 8958: input + cache creation
        assert_eq!(usage.completion_tokens, 188);
        assert_eq!(usage.total_tokens, 2 + 8956 + 188); // 9146: input + cache creation + output (cache reads excluded)
        assert_eq!(usage.cache_read_tokens, Some(15570));
        assert_eq!(usage.cache_write_tokens, Some(8956));
        assert_eq!(usage.cost_usd, Some(0.0384));
        assert_eq!(usage.basis.as_deref(), Some("reported"));
    }
}

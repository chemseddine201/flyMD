//! Subprocess Command builder for Claude Code, Antigravity Gemini, and custom agents.

use std::process::Command;

/// Normalizes Antigravity (`agy`) model slugs and effort levels so they always match `agy models` capabilities.
/// Prevents CLI exit code 1 from legacy slugs (e.g. `gemini-2.5-pro`), effort suffixes (`gpt-oss-120b-medium`),
/// or unsupported effort tiers (`xhigh` / `max` on models that only accept `low` | `medium` | `high`).
pub fn normalize_antigravity_model_and_effort(
    model_id: Option<&str>,
    effort_val: &str,
    thinking_on: bool,
) -> (Option<String>, String) {
    let raw_eff = if !thinking_on {
        "low"
    } else {
        match effort_val.trim().to_lowercase().as_str() {
            "low" => "low",
            "medium" => "medium",
            // `agy` supports low | medium | high on its frontier models; clamp xhigh/max -> high
            "high" | "xhigh" | "max" => "high",
            _ => "medium",
        }
    };

    let Some(raw_model) = model_id.map(|m| m.trim()).filter(|m| !m.is_empty() && *m != "default") else {
        return (None, raw_eff.to_string());
    };

    let lower = raw_model.to_lowercase();

    // Map legacy / non-agy model slugs to valid Antigravity subscription models
    let mapped_base = match lower.as_str() {
        "gemini-2.5-pro" | "gemini-2.0-pro-exp-02-05" | "gemini-1.5-pro" | "gemini-pro" => {
            "gemini-4-argon".to_string()
        }
        "gemini-2.5-flash" | "gemini-2.0-flash-thinking" | "gemini-2.0-flash" | "gemini-flash" => {
            "gemini-3.8-flash".to_string()
        }
        "claude-3-7-sonnet" | "claude-3-7-sonnet-thought" | "claude-3-5-sonnet" => {
            "claude-sonnet-5-5".to_string()
        }
        "claude-3-opus" => "claude-opus-5-5".to_string(),
        other => other.to_string(),
    };

    // Strip baked-in effort suffix if present (e.g. `gemini-4-argon-high` or `gpt-oss-120b-medium`)
    let mut base_slug = mapped_base.clone();
    let mut suffix_effort: Option<&str> = None;
    for eff_suffix in ["low", "medium", "high", "xhigh", "max"] {
        let suffix_pattern = format!("-{}", eff_suffix);
        if mapped_base.ends_with(&suffix_pattern) {
            base_slug = mapped_base[..mapped_base.len() - suffix_pattern.len()].to_string();
            suffix_effort = Some(match eff_suffix {
                "xhigh" | "max" => "high",
                other => other,
            });
            break;
        }
    }

    // `gpt-oss-120b` in `agy` only supports `medium` effort
    if base_slug.starts_with("gpt-oss-120b") {
        return (Some("gpt-oss-120b".to_string()), "medium".to_string());
    }

    let final_effort = if !thinking_on {
        "low".to_string()
    } else if effort_val.trim().is_empty() {
        suffix_effort.unwrap_or(raw_eff).to_string()
    } else {
        raw_eff.to_string()
    };

    (Some(base_slug), final_effort)
}

/// Constructs a configured CLI `Command` for the target agent runner.
/// Unifies Windows `.cmd` / `.bat` shell invocation and native executables without duplicating arguments.
#[allow(clippy::too_many_arguments)]
pub fn build_agent_cli_command(
    bin: &str,
    agent_id: &str,
    exec_dir: &str,
    prompt_arg: &str,
    resume_sid: Option<&str>,
    warm_cli_continue: bool,
    thinking_on: bool,
    effort_val: &str,
    model_id: Option<&str>,
) -> Command {
    build_agent_cli_command_internal(
        bin,
        agent_id,
        exec_dir,
        prompt_arg,
        resume_sid,
        warm_cli_continue,
        thinking_on,
        effort_val,
        model_id,
        false,
    )
}

/// Resolves minimal necessary tools per intent for token conservation.
pub fn resolve_intent_tools(intent: &str) -> &'static str {
    match intent {
        "build" | "fix-bugs" | "write-tests" => "Read,Edit,Write,Grep,Glob,Bash,PowerShell",
        "refine-plan" => "Read,Edit,Write,Grep,Glob,Bash,PowerShell,WebFetch,WebSearch",
        "review" | "explain" => "Read,Grep,Glob,Bash,PowerShell",
        _ => "",
    }
}

/// Constructs a configured CLI `Command` with support for fused `--model <base>-<effort>` retry form.
#[allow(clippy::too_many_arguments)]
pub fn build_agent_cli_command_internal(
    bin: &str,
    agent_id: &str,
    exec_dir: &str,
    prompt_arg: &str,
    resume_sid: Option<&str>,
    warm_cli_continue: bool,
    thinking_on: bool,
    effort_val: &str,
    model_id: Option<&str>,
    fuse_antigravity_effort: bool,
) -> Command {
    build_agent_cli_command_with_mode(
        bin,
        agent_id,
        exec_dir,
        prompt_arg,
        resume_sid,
        warm_cli_continue,
        thinking_on,
        effort_val,
        model_id,
        fuse_antigravity_effort,
        None,
        None,
    )
}

/// Constructs a configured CLI `Command` with support for per-intent tools and tokenSaver flags.
#[allow(clippy::too_many_arguments)]
pub fn build_agent_cli_command_with_mode(
    bin: &str,
    agent_id: &str,
    exec_dir: &str,
    prompt_arg: &str,
    resume_sid: Option<&str>,
    warm_cli_continue: bool,
    thinking_on: bool,
    effort_val: &str,
    model_id: Option<&str>,
    fuse_antigravity_effort: bool,
    intent: Option<&str>,
    token_saver: Option<&str>,
) -> Command {
    let bin_lower = bin.to_lowercase();
    let is_batch = bin_lower.ends_with(".cmd") || bin_lower.ends_with(".bat");

    let (program, prefix_args) = if is_batch {
        ("cmd.exe", vec!["/C", bin])
    } else {
        (bin, vec![])
    };

    let mut cmd = Command::new(program);
    for arg in prefix_args {
        cmd.arg(arg);
    }

    let sanitized_model = model_id.and_then(|m| {
        let trimmed = m.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });

    match agent_id {
        "opencode" => {
            cmd.args(["run", prompt_arg]);
            if let Some(model) = sanitized_model {
                cmd.args(["--model", model]);
            }
        }
        "antigravity" => {
            let (norm_model, norm_effort) =
                normalize_antigravity_model_and_effort(sanitized_model, effort_val, thinking_on);
            cmd.args([
                "-p",
                prompt_arg,
                "--dangerously-skip-permissions",
                "--add-dir",
                exec_dir,
                "--mode",
                "accept-edits",
                "--output-format",
                "stream-json",
            ]);
            if fuse_antigravity_effort {
                let fused = match norm_model {
                    Some(ref m) => format!("{}-{}", m, norm_effort),
                    None => norm_effort.clone(),
                };
                cmd.args(["--model", fused.as_str()]);
                // Omit --effort when fused to recover from "invalid model selection" CLI rejection
            } else {
                if let Some(ref model) = norm_model {
                    cmd.args(["--model", model.as_str()]);
                }
                cmd.args(["--effort", norm_effort.as_str()]);
            }
        }
        "claude-code" => {
            if let Some(sid) = resume_sid {
                cmd.args(["--resume", sid]);
            } else if warm_cli_continue {
                cmd.arg("-c");
            }
            cmd.args([
                "-p",
                prompt_arg,
                "--output-format",
                "stream-json",
                "--verbose",
                "--include-partial-messages",
                "--dangerously-skip-permissions",
                "--add-dir",
                exec_dir,
            ]);

            if matches!(token_saver, Some("standard") | Some("strict")) {
                let tools = intent.map(resolve_intent_tools).unwrap_or("");
                if !tools.is_empty() {
                    cmd.args(["--tools", tools]);
                }
                if token_saver == Some("strict") {
                    cmd.args([
                        "--strict-mcp-config",
                        "--disable-slash-commands",
                        "--setting-sources",
                        "project",
                    ]);
                }
            }

            if let Some(model) = sanitized_model {
                cmd.args(["--model", model]);
            }
            if thinking_on {
                cmd.args(["--effort", effort_val]);
            } else {
                cmd.args([
                    "--effort",
                    "low",
                    "--settings",
                    "{\"alwaysThinkingEnabled\":false}",
                ]);
            }
        }
        _ => {
            cmd.args([
                "-p",
                prompt_arg,
                "--dangerously-skip-permissions",
                "--add-dir",
                exec_dir,
            ]);
            if let Some(model) = sanitized_model {
                cmd.args(["--model", model]);
            }
        }
    }

    cmd
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_agent_cli_command_with_model_and_effort() {
        let cmd = build_agent_cli_command(
            "claude",
            "claude-code",
            "C:\\workspace",
            "Refactor code",
            None,
            false,
            true,
            "high",
            Some("claude-3-7-sonnet"),
        );
        let args: Vec<String> = cmd.get_args().map(|s| s.to_string_lossy().into_owned()).collect();
        assert!(args.contains(&"--model".to_string()));
        assert!(args.contains(&"claude-3-7-sonnet".to_string()));
        assert!(args.contains(&"--effort".to_string()));
        assert!(args.contains(&"high".to_string()));
    }

    #[test]
    fn test_build_agent_cli_command_antigravity_with_model() {
        let cmd = build_agent_cli_command(
            "agy",
            "antigravity",
            "C:\\workspace",
            "Design module",
            None,
            false,
            false,
            "medium",
            Some("gemini-2.5-pro"),
        );
        let args: Vec<String> = cmd.get_args().map(|s| s.to_string_lossy().into_owned()).collect();
        assert!(args.contains(&"--model".to_string()));
        assert!(args.contains(&"gemini-4-argon".to_string()));
        assert!(args.contains(&"--effort".to_string()));
        assert!(args.contains(&"low".to_string())); // thinking_on is false -> effort low
    }

    #[test]
    fn test_dispatched_pipeline_task_with_tokensaver_includes_tools_list() {
        let cmd = build_agent_cli_command_with_mode(
            "claude",
            "claude-code",
            "C:\\workspace",
            "Implement fix",
            None,
            false,
            true,
            "medium",
            Some("claude-3-7-sonnet"),
            false,
            Some("build"),
            Some("standard"),
        );
        let args: Vec<String> = cmd.get_args().map(|s| s.to_string_lossy().into_owned()).collect();
        assert!(args.contains(&"--tools".to_string()));
        let tools_idx = args.iter().position(|a| a == "--tools").unwrap();
        assert_eq!(&args[tools_idx + 1], "Read,Edit,Write,Grep,Glob,Bash,PowerShell");
    }

    #[test]
    fn test_dispatched_pipeline_task_tokensaver_off_omits_tools() {
        let cmd = build_agent_cli_command_with_mode(
            "claude",
            "claude-code",
            "C:\\workspace",
            "Implement fix",
            None,
            false,
            true,
            "medium",
            Some("claude-3-7-sonnet"),
            false,
            Some("build"),
            Some("off"),
        );
        let args: Vec<String> = cmd.get_args().map(|s| s.to_string_lossy().into_owned()).collect();
        assert!(!args.contains(&"--tools".to_string()));
    }
}

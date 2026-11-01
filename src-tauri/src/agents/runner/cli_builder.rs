//! Subprocess Command builder for Claude Code, Antigravity Gemini, and custom agents.

use std::process::Command;

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
            if let Some(model) = sanitized_model {
                cmd.args(["--model", model]);
            }
            if thinking_on {
                cmd.args(["--effort", effort_val]);
            } else {
                cmd.args(["--effort", "low"]);
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
        assert!(args.contains(&"gemini-2.5-pro".to_string()));
        assert!(args.contains(&"--effort".to_string()));
        assert!(args.contains(&"low".to_string())); // thinking_on is false -> effort low
    }
}

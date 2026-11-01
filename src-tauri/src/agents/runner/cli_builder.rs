//! Subprocess Command builder for Claude Code, Antigravity Gemini, and custom agents.

use std::process::Command;

/// Constructs a configured CLI `Command` for the target agent runner.
/// Unifies Windows `.cmd` / `.bat` shell invocation and native executables without duplicating arguments.
pub fn build_agent_cli_command(
    bin: &str,
    agent_id: &str,
    exec_dir: &str,
    prompt_arg: &str,
    resume_sid: Option<&str>,
    warm_cli_continue: bool,
    thinking_on: bool,
    effort_val: &str,
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

    match agent_id {
        "opencode" => {
            cmd.args(["run", prompt_arg]);
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
        }
    }

    cmd
}


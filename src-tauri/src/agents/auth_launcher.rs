//! Platform-specific CLI login terminal launcher and web browser OAuth/clipboard launcher.

use super::types::AgentProfile;
use std::fs;
use std::process::{Command, Stdio};

/// Spawns an interactive system terminal running the official CLI login command for `profile`,
/// falling back to the agent's web sign-in URL if the binary is not on `PATH`.
pub fn launch_cli_login_terminal(profile: &AgentProfile, agent_id: &str) -> Result<(), String> {
    let login_cmd = profile
        .login_command
        .clone()
        .or_else(|| profile.detected_binary_path.clone())
        .unwrap_or_else(|| {
            profile
                .binary_names
                .first()
                .cloned()
                .unwrap_or_else(|| profile.id.clone())
        });

    let bin_name = login_cmd
        .split_whitespace()
        .next()
        .unwrap_or(&login_cmd)
        .to_string();

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NEW_CONSOLE: u32 = 0x00000010;

        let safe_id: String = agent_id
            .chars()
            .map(|c| {
                if c.is_alphanumeric() || c == '-' {
                    c
                } else {
                    '_'
                }
            })
            .collect();
        let bat_path = std::env::temp_dir().join(format!("flymd-cli-login-{}.cmd", safe_id));
        let web_fallback = profile
            .web_url
            .clone()
            .unwrap_or_else(|| "https://claude.ai".to_string());

        let bat_content = format!(
            "@echo off\r\n\
            title FlyMD CLI Login - {name}\r\n\
            color 0B\r\n\
            echo ============================================================\r\n\
            echo   FlyMD Multi-Agent Supervisor - Official CLI Login\r\n\
            echo   Agent:   {name} ({vendor})\r\n\
            echo   Command: {cmd}\r\n\
            echo ============================================================\r\n\
            echo.\r\n\
            where \"{bin}\" >nul 2>nul\r\n\
            if %ERRORLEVEL% NEQ 0 (\r\n\
                if not exist \"{bin}\" (\r\n\
                    color 0E\r\n\
                    echo [Notice] The CLI tool \"{bin}\" was not found on your system PATH.\r\n\
                    echo.\r\n\
                    echo You do NOT need the CLI tool to use {name} with FlyMD!\r\n\
                    echo Opening {name} in your default web browser ({url}) so you can sign in for free...\r\n\
                    echo.\r\n\
                    rundll32.exe url.dll,FileProtocolHandler \"{url}\"\r\n\
                    pause\r\n\
                    exit /b 0\r\n\
                )\r\n\
            )\r\n\
            echo Running: {cmd}\r\n\
            echo.\r\n\
            call {cmd}\r\n\
            echo.\r\n\
            echo [FlyMD] CLI Login session finished.\r\n\
            pause\r\n",
            name = profile.name,
            vendor = profile.vendor,
            cmd = login_cmd,
            bin = bin_name,
            url = web_fallback
        );

        fs::write(&bat_path, bat_content)
            .map_err(|e| format!("Failed to prepare CLI login script: {}", e))?;

        Command::new("cmd.exe")
            .args(["/C", &bat_path.to_string_lossy()])
            .creation_flags(CREATE_NEW_CONSOLE)
            .spawn()
            .map_err(|e| format!("Failed to launch CLI login terminal: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        let _ = (bin_name, agent_id);
        Command::new("osascript")
            .args([
                "-e",
                &format!(
                    "tell application \"Terminal\" to do script \"{}\"",
                    login_cmd
                ),
            ])
            .spawn()
            .map_err(|e| format!("Failed to launch Terminal: {}", e))?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let _ = (bin_name, agent_id);
        Command::new("sh")
            .args(["-c", &login_cmd])
            .spawn()
            .map_err(|e| format!("Failed to launch login command: {}", e))?;
    }

    Ok(())
}

/// Copies an optional Markdown task prompt to the system clipboard and opens the agent's web session URL.
pub fn launch_web_auth_browser(
    profile: &AgentProfile,
    task_prompt: Option<&str>,
) -> Result<String, String> {
    let target_url = profile
        .web_url
        .clone()
        .filter(|u| !u.trim().is_empty())
        .unwrap_or_else(|| "https://claude.ai/new".to_string());

    if let Some(prompt_text) = task_prompt {
        if !prompt_text.trim().is_empty() {
            #[cfg(target_os = "windows")]
            {
                use std::io::Write;
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                if let Ok(mut child) = Command::new("clip.exe")
                    .stdin(Stdio::piped())
                    .creation_flags(CREATE_NO_WINDOW)
                    .spawn()
                {
                    if let Some(mut stdin) = child.stdin.take() {
                        let _ = stdin.write_all(prompt_text.as_bytes());
                    }
                    let _ = child.wait();
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", &target_url])
            .spawn()
            .or_else(|_| Command::new("explorer.exe").arg(&target_url).spawn())
            .map_err(|e| format!("Failed to open system default browser: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&target_url)
            .spawn()
            .map_err(|e| format!("Failed to open default browser: {}", e))?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(&target_url)
            .spawn()
            .map_err(|e| format!("Failed to open default browser: {}", e))?;
    }

    Ok(target_url)
}

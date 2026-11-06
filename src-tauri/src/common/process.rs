//! Process management, process-tree termination, and binary discovery utilities.

use std::path::PathBuf;

/// Terminates an entire process tree (including grandchild processes like node.exe/python.exe).
/// On Windows, sets CREATE_NO_WINDOW (0x08000000) so no console window flashes.
pub fn kill_process_tree(pid: u32) {
    if pid == 0 {
        return;
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        // CREATE_NO_WINDOW = 0x08000000
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .creation_flags(0x08000000)
            .output();
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        let _ = Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output();
    }
}

/// Checks if a process ID is currently running on the system.
pub fn is_pid_alive(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        if let Ok(output) = Command::new("tasklist")
            .args(["/FI", &format!("PID eq {}", pid), "/FO", "CSV", "/NH"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout);
            let needle = format!("\"{}\"", pid);
            return text
                .lines()
                .any(|line| line.split(',').nth(1).map(|col| col.trim()) == Some(needle.as_str()));
        }
        false
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::path::Path::new(&format!("/proc/{}", pid)).exists()
    }
}

/// Resolves the user's home directory across Windows and Unix platforms.
pub fn get_user_home_dir() -> Option<PathBuf> {
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let p = PathBuf::from(profile);
        if p.exists() {
            return Some(p);
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        let p = PathBuf::from(home);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

/// Locates executable binaries across PATH and standard user installation directories.
pub fn find_binary_on_system(candidates: &[&str]) -> Option<String> {
    let mut search_dirs: Vec<PathBuf> = Vec::new();

    if let Ok(path_var) = std::env::var("PATH") {
        for part in std::env::split_paths(&path_var) {
            if part.exists() {
                search_dirs.push(part);
            }
        }
    }

    if let Some(home) = get_user_home_dir() {
        search_dirs.push(home.join(".local").join("bin"));
        search_dirs.push(home.join(".cargo").join("bin"));
        search_dirs.push(home.join(".opencode").join("bin"));
        search_dirs.push(home.join(".claude").join("local"));
        search_dirs.push(home.join("AppData").join("Local").join("agy").join("bin"));
        search_dirs.push(home.join("AppData").join("Roaming").join("npm"));
        search_dirs.push(
            home.join("AppData")
                .join("Local")
                .join("Programs")
                .join("cursor")
                .join("resources")
                .join("app")
                .join("bin"),
        );
        search_dirs.push(
            home.join("AppData")
                .join("Local")
                .join("Programs")
                .join("Antigravity")
                .join("bin"),
        );
        search_dirs.push(
            home.join("AppData")
                .join("Local")
                .join("Programs")
                .join("Antigravity IDE")
                .join("bin"),
        );
        search_dirs.push(
            home.join("AppData")
                .join("Local")
                .join("Programs")
                .join("Zed")
                .join("bin"),
        );
        search_dirs.push(home.join("AppData").join("Local").join("Zed").join("bin"));
    }

    let exts = if cfg!(target_os = "windows") {
        vec![".exe", ".cmd", ".bat", ""]
    } else {
        vec![""]
    };

    for dir in &search_dirs {
        for cand in candidates {
            for ext in &exts {
                let fname = if !ext.is_empty() && cand.ends_with(ext) {
                    cand.to_string()
                } else {
                    format!("{}{}", cand, ext)
                };
                let full = dir.join(&fname);
                if full.is_file() {
                    return Some(full.to_string_lossy().to_string());
                }
            }
        }
    }

    None
}

//! Safety snapshot creation, restore points, and shared project memory ledger.

use super::types::{now_ms, AgentCheckpoint};
use crate::store::SharedStore;
use std::fs;
use std::path::Path;
use std::process::Command;
use tauri::{AppHandle, Emitter};

/// Creates a safety restore point before an agent task executes.
pub fn create_safety_checkpoint(
    store: &SharedStore,
    app_handle: &AppHandle,
    task_id: &str,
    agent_id: &str,
    workspace_path: &str,
    target_file_path: &str,
) -> Option<AgentCheckpoint> {
    let ws = Path::new(workspace_path);
    if !ws.exists() {
        return None;
    }

    let cp_id = format!("cp-{}", now_ms());
    let backup_dir = ws.join(".flymd").join("checkpoints").join(&cp_id);
    fs::create_dir_all(&backup_dir).ok()?;

    if !target_file_path.is_empty() && Path::new(target_file_path).is_file() {
        if let Some(fname) = Path::new(target_file_path).file_name() {
            fs::copy(target_file_path, backup_dir.join(fname)).ok();
        }
    }

    let git_ref = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .current_dir(ws)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());

    let cp = AgentCheckpoint {
        id: cp_id.clone(),
        task_id: task_id.to_string(),
        agent_id: agent_id.to_string(),
        workspace_path: workspace_path.to_string(),
        created_at: now_ms(),
        label: format!("Before {} task", agent_id),
        git_ref,
        backup_dir: Some(backup_dir.to_string_lossy().to_string()),
        restored: false,
    };

    let mut checkpoints = store.get_agent_checkpoints();
    checkpoints.insert(0, cp.clone());
    store.save_agent_checkpoints(checkpoints.clone());
    app_handle
        .emit("agent:checkpoints-updated", &checkpoints)
        .ok();

    Some(cp)
}

/// Restores files and git state from a previously saved safety checkpoint.
pub fn restore_checkpoint(
    store: &SharedStore,
    app_handle: &AppHandle,
    checkpoint_id: &str,
) -> Result<String, String> {
    let mut checkpoints = store.get_agent_checkpoints();
    let idx = checkpoints
        .iter()
        .position(|c| c.id == checkpoint_id)
        .ok_or_else(|| "Checkpoint not found".to_string())?;

    let cp = checkpoints[idx].clone();
    let ws = Path::new(&cp.workspace_path);

    if let Some(ref backup_dir_str) = cp.backup_dir {
        let bdir = Path::new(backup_dir_str);
        if bdir.exists() {
            if let Ok(entries) = fs::read_dir(bdir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(fname) = path.file_name() {
                            fs::copy(&path, ws.join(fname)).ok();
                        }
                    }
                }
            }
        }
    }

    if let Some(ref git_sha) = cp.git_ref {
        if !git_sha.is_empty() && ws.exists() {
            Command::new("git")
                .args(["checkout", git_sha, "--", "."])
                .current_dir(ws)
                .output()
                .ok();
        }
    }

    checkpoints[idx].restored = true;
    store.save_agent_checkpoints(checkpoints.clone());
    app_handle
        .emit("agent:checkpoints-updated", &checkpoints)
        .ok();

    let mut tasks = store.get_agent_tasks();
    if let Some(t) = tasks.iter_mut().find(|t| t.id == cp.task_id) {
        t.status = "undone".to_string();
        t.logs
            .push("[Safety Time-Machine] Restored workspace to pre-task checkpoint.".to_string());
    }
    store.save_agent_tasks(tasks.clone());
    app_handle.emit("agent:tasks-updated", &tasks).ok();

    Ok(format!("Restored safety checkpoint {}", cp.id))
}

/// Appends an execution entry to the shared `.flymd/MEMORY.md` ledger.
pub fn append_project_memory(workspace_path: &str, entry_markdown: &str) {
    let ws = Path::new(workspace_path);
    if !ws.exists() {
        return;
    }
    let flymd_dir = ws.join(".flymd");
    fs::create_dir_all(&flymd_dir).ok();
    let mem_file = flymd_dir.join("MEMORY.md");

    let mut current = if mem_file.exists() {
        fs::read_to_string(&mem_file).unwrap_or_default()
    } else {
        "# FlyMD Shared Agent Memory Ledger\n\n> Auto-maintained context ledger across Antigravity, Claude Code, OpenCode, ZCode, Cursor, Codex, and Custom Agents.\n\n".to_string()
    };

    current.push_str(entry_markdown);
    current.push('\n');
    fs::write(&mem_file, current).ok();
}

/// Safely returns up to the last `max_bytes` of a UTF-8 string on a valid character boundary.
pub fn safe_tail_utf8(content: &str, max_bytes: usize) -> String {
    if content.len() <= max_bytes {
        return content.to_string();
    }
    let min_start = content.len() - max_bytes;
    let start_idx = content
        .char_indices()
        .map(|(idx, _)| idx)
        .find(|&idx| idx >= min_start)
        .unwrap_or(content.len());
    content[start_idx..].to_string()
}

/// Reads recent history from `.flymd/MEMORY.md` for cross-agent context synchronization.
pub fn read_project_memory(workspace_path: &str) -> String {
    let mem_file = Path::new(workspace_path).join(".flymd").join("MEMORY.md");
    if mem_file.exists() {
        let content = fs::read_to_string(&mem_file).unwrap_or_default();
        safe_tail_utf8(&content, 4000)
    } else {
        String::new()
    }
}

/// Clears temporary agent handoffs, reports, checkpoints, and optionally resets .flymd/MEMORY.md
pub fn clear_workspace_memory_and_cache(
    workspace_path: &str,
    clear_memory: bool,
) -> Result<String, String> {
    let ws = Path::new(workspace_path);
    if !ws.exists() {
        return Err(format!("Workspace path does not exist: {}", workspace_path));
    }
    let flymd_dir = ws.join(".flymd");
    if !flymd_dir.exists() {
        return Ok("No .flymd cache directory found to clean.".to_string());
    }

    let mut cleared_items = Vec::new();

    // 1. Clean handoffs
    let handoffs_dir = flymd_dir.join("handoffs");
    if handoffs_dir.exists() {
        if let Ok(entries) = fs::read_dir(&handoffs_dir) {
            let count = entries
                .flatten()
                .filter(|e| fs::remove_file(e.path()).is_ok())
                .count();
            if count > 0 {
                cleared_items.push(format!("{} handoff package(s)", count));
            }
        }
    }

    // 2. Clean reports
    let reports_dir = flymd_dir.join("reports");
    if reports_dir.exists() {
        if let Ok(entries) = fs::read_dir(&reports_dir) {
            let count = entries
                .flatten()
                .filter(|e| fs::remove_file(e.path()).is_ok())
                .count();
            if count > 0 {
                cleared_items.push(format!("{} temporary report(s)", count));
            }
        }
    }

    // 3. Clean checkpoints
    let checkpoints_dir = flymd_dir.join("checkpoints");
    if checkpoints_dir.exists() {
        if let Ok(entries) = fs::read_dir(&checkpoints_dir) {
            let count = entries
                .flatten()
                .filter(|e| fs::remove_dir_all(e.path()).is_ok())
                .count();
            if count > 0 {
                cleared_items.push(format!("{} checkpoint backup(s)", count));
            }
        }
    }

    // 3b. Clean cross-model cognitive cache
    let cache_dir = flymd_dir.join("cache");
    if cache_dir.exists() {
        if let Ok(entries) = fs::read_dir(&cache_dir) {
            let count = entries
                .flatten()
                .filter(|e| fs::remove_file(e.path()).is_ok())
                .count();
            if count > 0 {
                cleared_items.push(format!("{} cognitive cache packet(s)", count));
            }
        }
    }

    // 4. Optionally clear MEMORY.md
    if clear_memory {
        let mem_file = flymd_dir.join("MEMORY.md");
        if mem_file.exists() {
            let clean_content = "# FlyMD Shared Agent Memory Ledger\n\n> Auto-maintained context ledger across Antigravity, Claude Code, OpenCode, ZCode, Cursor, Codex, and Custom Agents.\n\n";
            let _ = fs::write(mem_file, clean_content);
            cleared_items.push("shared memory ledger".to_string());
        }
    }

    if cleared_items.is_empty() {
        Ok("Workspace cache was already clean.".to_string())
    } else {
        Ok(format!(
            "Successfully cleared: {}",
            cleared_items.join(", ")
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safe_tail_utf8_with_multibyte_arabic() {
        let arabic_block = "مواصفات المحاكاة الفيزيائية التفاعلية — التحقق من سلامة الذاكرة المشتركة\n".repeat(120);
        assert!(arabic_block.len() > 6000);
        let sliced = safe_tail_utf8(&arabic_block, 4000);
        assert!(sliced.len() <= 4000);
        assert!(!sliced.is_empty());
    }
}

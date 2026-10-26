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

/// Reads recent history from `.flymd/MEMORY.md` for cross-agent context synchronization.
pub fn read_project_memory(workspace_path: &str) -> String {
    let mem_file = Path::new(workspace_path).join(".flymd").join("MEMORY.md");
    if mem_file.exists() {
        let content = fs::read_to_string(&mem_file).unwrap_or_default();
        if content.len() > 4000 {
            content[content.len() - 4000..].to_string()
        } else {
            content
        }
    } else {
        String::new()
    }
}

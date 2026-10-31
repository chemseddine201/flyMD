//! Safety snapshot creation, restore points, and shared project memory ledger.

use super::types::{now_ms, AgentCheckpoint};
use crate::store::SharedStore;
use std::fs;
use std::path::Path;
use std::process::Command;
use tauri::{AppHandle, Emitter};

/// Helper to collect relative paths of workspace source/deliverable files (excluding internal/build dirs).
fn collect_workspace_snapshot_files(root: &Path, current: &Path, depth: usize, out: &mut Vec<String>) {
    if depth > 2 {
        return;
    }
    let Ok(entries) = fs::read_dir(current) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.')
            || name.eq_ignore_ascii_case("node_modules")
            || name.eq_ignore_ascii_case("target")
            || name.eq_ignore_ascii_case("dist")
            || name.eq_ignore_ascii_case("release")
            || name.eq_ignore_ascii_case("build")
        {
            continue;
        }
        if path.is_dir() {
            collect_workspace_snapshot_files(root, &path, depth + 1, out);
        } else if path.is_file() {
            if let Ok(meta) = path.metadata() {
                // Snapshot text/source/deliverable files up to 5 MB
                if meta.len() <= 5 * 1024 * 1024 {
                    if let Ok(rel) = path.strip_prefix(root) {
                        let rel_norm = rel.to_string_lossy().replace('\\', "/");
                        out.push(rel_norm);
                    }
                }
            }
        }
    }
}

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

    // Snapshot all existing workspace deliverable/source files so rollback can both
    // restore modified files AND delete any newly created partial files.
    let mut pre_existing_files = Vec::new();
    collect_workspace_snapshot_files(ws, ws, 0, &mut pre_existing_files);
    pre_existing_files.sort();

    for rel in &pre_existing_files {
        let src = ws.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        let dst = backup_dir.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        if let Some(parent) = dst.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::copy(&src, &dst);
    }

    if !target_file_path.is_empty() && Path::new(target_file_path).is_file() {
        if let Some(fname) = Path::new(target_file_path).file_name() {
            let fname_str = fname.to_string_lossy().to_string();
            let dst = backup_dir.join(fname);
            if !dst.exists() {
                fs::copy(target_file_path, dst).ok();
            }
            if !pre_existing_files.contains(&fname_str) {
                pre_existing_files.push(fname_str);
            }
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
        pre_existing_files,
        reverted_files: Vec::new(),
    };

    let mut checkpoints = store.get_agent_checkpoints();
    checkpoints.insert(0, cp.clone());
    store.save_agent_checkpoints(checkpoints.clone());
    app_handle
        .emit("agent:checkpoints-updated", &checkpoints)
        .ok();

    Some(cp)
}

/// Helper to recursively restore backed up files from `backup_dir` into `ws`.
fn restore_backup_dir_recursive(
    backup_root: &Path,
    current_backup: &Path,
    ws_root: &Path,
    reverted: &mut Vec<String>,
) {
    let Ok(entries) = fs::read_dir(current_backup) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            restore_backup_dir_recursive(backup_root, &path, ws_root, reverted);
        } else if path.is_file() {
            if let Ok(rel) = path.strip_prefix(backup_root) {
                let rel_norm = rel.to_string_lossy().replace('\\', "/");
                let dst = ws_root.join(rel);
                if let Some(parent) = dst.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                if fs::copy(&path, &dst).is_ok() {
                    reverted.push(format!("restored:{}", rel_norm));
                }
            }
        }
    }
}

/// Restores files and git state from a previously saved safety checkpoint,
/// including deleting newly created partial files that did not exist before the task started.
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
    let mut reverted_files: Vec<String> = Vec::new();

    // 1. Identify and remove any files newly created during the task that did not exist in `pre_existing_files`
    if ws.exists() {
        let mut current_files = Vec::new();
        collect_workspace_snapshot_files(ws, ws, 0, &mut current_files);

        let backup_root_opt = cp.backup_dir.as_ref().map(Path::new);
        for cur_rel in &current_files {
            let existed_before = if !cp.pre_existing_files.is_empty() {
                cp.pre_existing_files
                    .iter()
                    .any(|p| p.eq_ignore_ascii_case(cur_rel))
            } else if let Some(bdir) = backup_root_opt {
                bdir.join(cur_rel.replace('/', std::path::MAIN_SEPARATOR_STR))
                    .exists()
            } else {
                true
            };

            if !existed_before {
                let target_to_delete = ws.join(cur_rel.replace('/', std::path::MAIN_SEPARATOR_STR));
                if target_to_delete.is_file() && fs::remove_file(&target_to_delete).is_ok() {
                    reverted_files.push(format!("removed:{}", cur_rel));
                }
            }
        }
    }

    // 2. Restore all pre-existing files from `backup_dir`
    if let Some(ref backup_dir_str) = cp.backup_dir {
        let bdir = Path::new(backup_dir_str);
        if bdir.exists() {
            restore_backup_dir_recursive(bdir, bdir, ws, &mut reverted_files);
        }
    }

    // 3. If workspace is a Git repository, also restore tracked files
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
    checkpoints[idx].reverted_files = reverted_files.clone();
    store.save_agent_checkpoints(checkpoints.clone());
    app_handle
        .emit("agent:checkpoints-updated", &checkpoints)
        .ok();

    let summary_detail = if reverted_files.is_empty() {
        "Workspace state verified clean.".to_string()
    } else {
        format!("Reverted/cleaned {} workspace item(s): {}", reverted_files.len(), reverted_files.join(", "))
    };

    let mut tasks = store.get_agent_tasks();
    if let Some(t) = tasks.iter_mut().find(|t| t.id == cp.task_id) {
        t.status = "undone".to_string();
        t.logs.push(format!(
            "[Safety Time-Machine] Restored workspace to pre-task checkpoint ({}). {}",
            cp.id, summary_detail
        ));
    }
    store.save_agent_tasks(tasks.clone());
    app_handle.emit("agent:tasks-updated", &tasks).ok();

    Ok(format!("Restored safety checkpoint {}: {}", cp.id, summary_detail))
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
    clear_temp_cache: Option<bool>,
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
    let clean_temp = clear_temp_cache.unwrap_or(true);

    if clean_temp {
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

    #[test]
    fn test_workspace_snapshot_and_restore_removes_new_files_and_restores_modified() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_cp_test_{}", now_ms()));
        let ws = temp_dir.join("workspace");
        let backup_dir = ws.join(".flymd").join("checkpoints").join("cp-test");
        fs::create_dir_all(&backup_dir).unwrap();

        // 1. Pre-existing file before task starts
        let plan_path = ws.join("Plan.md");
        fs::write(&plan_path, "# Original Plan\nStep 1").unwrap();

        let mut pre_existing = Vec::new();
        collect_workspace_snapshot_files(&ws, &ws, 0, &mut pre_existing);
        assert_eq!(pre_existing, vec!["Plan.md".to_string()]);

        // Copy pre-existing to backup_dir
        fs::copy(&plan_path, backup_dir.join("Plan.md")).unwrap();

        // 2. Simulate failed task modifying Plan.md and creating a partial index.html
        fs::write(&plan_path, "# Corrupted Plan").unwrap();
        let partial_html = ws.join("index.html");
        fs::write(&partial_html, "<html><body>Partial incomplete").unwrap();

        // 3. Simulate restore logic: remove files not in pre_existing, then restore backup_dir
        let mut current_files = Vec::new();
        collect_workspace_snapshot_files(&ws, &ws, 0, &mut current_files);
        let mut reverted = Vec::new();
        for cur_rel in &current_files {
            if !pre_existing.iter().any(|p| p.eq_ignore_ascii_case(cur_rel)) {
                let target = ws.join(cur_rel);
                if target.is_file() && fs::remove_file(&target).is_ok() {
                    reverted.push(format!("removed:{}", cur_rel));
                }
            }
        }
        restore_backup_dir_recursive(&backup_dir, &backup_dir, &ws, &mut reverted);

        assert!(!partial_html.exists(), "Newly created partial file should be deleted on revert");
        assert_eq!(
            fs::read_to_string(&plan_path).unwrap(),
            "# Original Plan\nStep 1",
            "Pre-existing file should be restored byte-for-byte"
        );
        assert!(reverted.contains(&"removed:index.html".to_string()));
        assert!(reverted.contains(&"restored:Plan.md".to_string()));

        let _ = fs::remove_dir_all(&temp_dir);
    }
}

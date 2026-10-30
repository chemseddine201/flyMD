//! Atomic filesystem storage for hierarchical project metadata, scoped memory, and master ledger.

use super::types::{ProjectMemoryRecord, ProjectNode};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};

/// Resolves a guaranteed writable base path for workspace operations.
pub fn resolve_safe_workspace(workspace_path: &Path) -> PathBuf {
    if !workspace_path.as_os_str().is_empty() && workspace_path != Path::new(".") {
        if fs::create_dir_all(workspace_path).is_ok() {
            let test_dir = workspace_path.join(".flymd");
            if fs::create_dir_all(&test_dir).is_ok() {
                return workspace_path.to_path_buf();
            }
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        if cwd != Path::new("C:\\Windows\\System32") {
            let test_dir = cwd.join(".flymd");
            if fs::create_dir_all(&test_dir).is_ok() {
                return cwd;
            }
        }
    }
    let temp_flymd = std::env::temp_dir().join("FlyMD_Projects");
    let _ = fs::create_dir_all(&temp_flymd);
    temp_flymd
}

/// Resolves `.flymd/projects` base path inside the workspace.
pub fn get_projects_dir(workspace_path: &Path) -> PathBuf {
    let base = resolve_safe_workspace(workspace_path);
    base.join(".flymd").join("projects")
}

/// Resolves the specific folder for a project node: `.flymd/projects/{id}`.
pub fn get_project_node_dir(workspace_path: &Path, project_id: &str) -> PathBuf {
    get_projects_dir(workspace_path).join(project_id)
}

/// Resolves the master memory path: `.flymd/MASTER_MEMORY.md`.
pub fn get_master_memory_path(workspace_path: &Path) -> PathBuf {
    let base = resolve_safe_workspace(workspace_path);
    base.join(".flymd").join("MASTER_MEMORY.md")
}

/// Saves a project node configuration atomically.
pub fn save_project_node(workspace_path: &Path, node: &ProjectNode) -> Result<(), String> {
    let dir = get_project_node_dir(workspace_path, &node.id);
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create project dir: {}", e))?;

    let file_path = dir.join("project.json");
    let json_bytes = serde_json::to_vec_pretty(node)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;

    atomic_write(&file_path, &json_bytes)
}

/// Loads a single project node from disk.
pub fn load_project_node(workspace_path: &Path, project_id: &str) -> Result<ProjectNode, String> {
    let file_path = get_project_node_dir(workspace_path, project_id).join("project.json");
    if !file_path.exists() {
        return Err(format!("Project file not found: {:?}", file_path));
    }

    let bytes = fs::read(&file_path).map_err(|e| format!("Failed to read project file: {}", e))?;
    serde_json::from_slice::<ProjectNode>(&bytes)
        .map_err(|e| format!("Failed to parse project.json: {}", e))
}

/// Scans the `.flymd/projects` directory and loads all registered project nodes.
pub fn load_all_projects(workspace_path: &Path) -> Vec<ProjectNode> {
    let mut projects = Vec::new();
    let base_dir = get_projects_dir(workspace_path);
    if !base_dir.exists() {
        return projects;
    }

    if let Ok(entries) = fs::read_dir(base_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                let id = entry.file_name().to_string_lossy().to_string();
                if let Ok(node) = load_project_node(workspace_path, &id) {
                    projects.push(node);
                }
            }
        }
    }

    projects.sort_by_key(|p| p.created_at);
    projects
}

/// Deletes a project node directory and its associated scoped memory on disk.
pub fn delete_project_dir(workspace_path: &Path, project_id: &str) -> Result<(), String> {
    let dir = get_project_node_dir(workspace_path, project_id);
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| format!("Failed to delete project directory: {}", e))?;
    }
    Ok(())
}

/// Appends a memory record to `.flymd/projects/{id}/memory.jsonl` with immediate flush.
pub fn append_project_memory_record(
    workspace_path: &Path,
    project_id: &str,
    record: &ProjectMemoryRecord,
) -> Result<(), String> {
    let dir = get_project_node_dir(workspace_path, project_id);
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create project dir: {}", e))?;

    let file_path = dir.join("memory.jsonl");
    let mut line = serde_json::to_string(record)
        .map_err(|e| format!("Failed to serialize memory record: {}", e))?;
    line.push('\n');

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|e| format!("Failed to open memory.jsonl: {}", e))?;

    file.write_all(line.as_bytes())
        .map_err(|e| format!("Failed to write to memory.jsonl: {}", e))?;
    file.flush()
        .map_err(|e| format!("Failed to flush memory.jsonl: {}", e))?;

    Ok(())
}

/// Reads all memory records from `.flymd/projects/{id}/memory.jsonl`.
pub fn read_project_memory_records(
    workspace_path: &Path,
    project_id: &str,
) -> Vec<ProjectMemoryRecord> {
    let mut records = Vec::new();
    let file_path = get_project_node_dir(workspace_path, project_id).join("memory.jsonl");
    if !file_path.exists() {
        return records;
    }

    if let Ok(file) = fs::File::open(&file_path) {
        let reader = BufReader::new(file);
        for line_res in reader.lines() {
            if let Ok(line) = line_res {
                let trimmed = line.trim();
                if !trimmed.is_empty() {
                    if let Ok(rec) = serde_json::from_str::<ProjectMemoryRecord>(trimmed) {
                        records.push(rec);
                    }
                }
            }
        }
    }

    records
}

/// Reads the Master Shared Memory file (`.flymd/MASTER_MEMORY.md`).
/// If not present, initializes a clean default header.
pub fn read_master_memory(workspace_path: &Path) -> String {
    let path = get_master_memory_path(workspace_path);
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            return content;
        }
    }

    let default_content = format!(
        "# Workspace Master Shared Memory\n\n\
        > Global architectural invariants, cross-project API contracts, and high-level milestones.\n\n\
        ## 1. System Invariants & Architecture Contracts\n\
        - All projects run in isolated process trees with PID tracking.\n\
        - Deliverables require verified evidence before marked completed.\n\n\
        ## 2. Completed Projects & Rollup Summaries\n\
        _No projects rolled up yet._\n"
    );

    // Best-effort initialize on disk
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(&path, default_content.as_bytes());

    default_content
}

/// Writes or updates `.flymd/MASTER_MEMORY.md` atomically.
pub fn write_master_memory(workspace_path: &Path, content: &str) -> Result<(), String> {
    let path = get_master_memory_path(workspace_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create .flymd dir: {}", e))?;
    }
    atomic_write(&path, content.as_bytes())
}

/// Helper for atomic file replacement.
fn atomic_write(target: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = target.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let tmp_path = target.with_extension(format!("tmp.{}", super::types::now_ms()));
    fs::write(&tmp_path, bytes).map_err(|e| format!("Failed to write tmp file: {}", e))?;

    if target.exists() {
        let _ = fs::remove_file(target);
    }

    if let Err(e) = fs::rename(&tmp_path, target) {
        // Fallback for Windows cross-volume, file locks, or network shares
        if let Err(ce) = fs::copy(&tmp_path, target) {
            let _ = fs::remove_file(&tmp_path);
            return Err(format!("Failed to write target file: {} (rename error: {})", ce, e));
        }
        let _ = fs::remove_file(&tmp_path);
    }

    Ok(())
}


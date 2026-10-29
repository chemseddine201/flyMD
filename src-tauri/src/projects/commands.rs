//! Tauri IPC command endpoints for Hierarchical Projects and Dual-Layer Memory.

use super::types::*;
use super::{ProjectTreeNode, SharedProjectManager};
use std::path::Path;
use tauri::State;

fn resolve_effective_ws(workspace_path: &str) -> String {
    if workspace_path.trim().is_empty() || workspace_path.trim() == "." {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    } else {
        workspace_path.to_string()
    }
}

#[tauri::command]
pub fn cmd_list_projects(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
) -> Vec<ProjectNode> {
    let ws = resolve_effective_ws(&workspace_path);
    projects.list_projects(Path::new(&ws))
}

#[tauri::command]
pub fn cmd_get_project_hierarchy(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
) -> Vec<ProjectTreeNode> {
    let ws = resolve_effective_ws(&workspace_path);
    projects.get_hierarchy(Path::new(&ws))
}

#[tauri::command]
pub fn cmd_create_project(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
    req: CreateProjectRequest,
) -> Result<ProjectNode, String> {
    let ws = resolve_effective_ws(&workspace_path);
    projects.create_project(Path::new(&ws), req)
}

#[tauri::command]
pub fn cmd_update_project(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
    project_id: String,
    req: UpdateProjectRequest,
) -> Result<ProjectNode, String> {
    let ws = resolve_effective_ws(&workspace_path);
    projects.update_project(Path::new(&ws), &project_id, req)
}

#[tauri::command]
pub fn cmd_delete_project(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
    project_id: String,
) -> Result<bool, String> {
    let ws = resolve_effective_ws(&workspace_path);
    projects.delete_project(Path::new(&ws), &project_id)
}

#[tauri::command]
pub fn cmd_get_master_memory(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
) -> String {
    let ws = resolve_effective_ws(&workspace_path);
    projects.get_master_memory(Path::new(&ws))
}

#[tauri::command]
pub fn cmd_update_master_memory(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
    content: String,
) -> Result<(), String> {
    let ws = resolve_effective_ws(&workspace_path);
    projects.update_master_memory(Path::new(&ws), &content)
}

#[tauri::command]
pub fn cmd_get_project_memory(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
    project_id: String,
) -> Vec<ProjectMemoryRecord> {
    let ws = resolve_effective_ws(&workspace_path);
    projects.get_project_memory(Path::new(&ws), &project_id)
}

#[tauri::command]
pub fn cmd_append_project_memory(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
    project_id: String,
    author_role: String,
    kind: MemoryEntryKind,
    summary: String,
    details: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<ProjectMemoryRecord, String> {
    let ws = resolve_effective_ws(&workspace_path);
    projects.append_project_memory(
        Path::new(&ws),
        &project_id,
        &author_role,
        kind,
        &summary,
        details.as_deref(),
        tags.unwrap_or_default(),
    )
}

#[tauri::command]
pub fn cmd_generate_recall_pack(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
    project_id: String,
    max_tokens: Option<usize>,
) -> RecallPack {
    let ws = resolve_effective_ws(&workspace_path);
    projects.generate_recall_pack(
        Path::new(&ws),
        &project_id,
        max_tokens.unwrap_or(2000),
    )
}

#[tauri::command]
pub fn cmd_rollup_project(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
    project_id: String,
    summary: String,
) -> Result<(), String> {
    let ws = resolve_effective_ws(&workspace_path);
    projects.rollup_project(Path::new(&ws), &project_id, &summary)
}


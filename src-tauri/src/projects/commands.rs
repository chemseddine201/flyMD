//! Tauri IPC command endpoints for Hierarchical Projects and Dual-Layer Memory.

use super::types::*;
use super::{ProjectTreeNode, SharedProjectManager};
use std::path::Path;
use tauri::State;

#[tauri::command]
pub fn cmd_list_projects(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
) -> Vec<ProjectNode> {
    projects.list_projects(Path::new(&workspace_path))
}

#[tauri::command]
pub fn cmd_get_project_hierarchy(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
) -> Vec<ProjectTreeNode> {
    projects.get_hierarchy(Path::new(&workspace_path))
}

#[tauri::command]
pub fn cmd_create_project(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
    req: CreateProjectRequest,
) -> Result<ProjectNode, String> {
    projects.create_project(Path::new(&workspace_path), req)
}

#[tauri::command]
pub fn cmd_update_project(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
    project_id: String,
    req: UpdateProjectRequest,
) -> Result<ProjectNode, String> {
    projects.update_project(Path::new(&workspace_path), &project_id, req)
}

#[tauri::command]
pub fn cmd_delete_project(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
    project_id: String,
) -> Result<bool, String> {
    projects.delete_project(Path::new(&workspace_path), &project_id)
}

#[tauri::command]
pub fn cmd_get_master_memory(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
) -> String {
    projects.get_master_memory(Path::new(&workspace_path))
}

#[tauri::command]
pub fn cmd_update_master_memory(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
    content: String,
) -> Result<(), String> {
    projects.update_master_memory(Path::new(&workspace_path), &content)
}

#[tauri::command]
pub fn cmd_get_project_memory(
    projects: State<'_, SharedProjectManager>,
    workspace_path: String,
    project_id: String,
) -> Vec<ProjectMemoryRecord> {
    projects.get_project_memory(Path::new(&workspace_path), &project_id)
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
    projects.append_project_memory(
        Path::new(&workspace_path),
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
    projects.generate_recall_pack(
        Path::new(&workspace_path),
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
    projects.rollup_project(Path::new(&workspace_path), &project_id, &summary)
}

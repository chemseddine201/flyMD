//! Hierarchical Projects & Dual-Layer Memory subsystem.
//!
//! Provides structured project management, cycle-free hierarchy operations,
//! Scoped Project Memory (.jsonl), Master Memory (.md), and token-budgeted Recall Packs.

pub mod cache;
pub mod commands;
pub mod memory;
pub mod storage;
pub mod tree;
pub mod types;

pub use cache::*;
pub use commands::*;
pub use memory::*;
pub use storage::*;
pub use tree::*;
pub use types::*;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

/// Central manager and thread-safe façade for project hierarchies and dual-layer memories.
pub struct ProjectManager {
    tree_cache: Arc<Mutex<HashMap<PathBuf, ProjectTree>>>,
}

pub type SharedProjectManager = Arc<ProjectManager>;

impl ProjectManager {
    pub fn new() -> SharedProjectManager {
        Arc::new(Self {
            tree_cache: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    /// Invalidate in-memory cache to force reloading from disk on next read.
    pub fn invalidate_cache(&self) {
        let mut lock = self.tree_cache.lock().unwrap();
        lock.clear();
    }

    /// Load or retrieve cached project tree for the workspace.
    fn get_or_load_tree(&self, workspace_path: &Path) -> ProjectTree {
        let effective_ws = storage::resolve_safe_workspace(workspace_path);
        let mut lock = self.tree_cache.lock().unwrap();
        if let Some(t) = lock.get(&effective_ws) {
            return t.clone();
        }

        let nodes = storage::load_all_projects(&effective_ws);
        let tree = ProjectTree::from_nodes(nodes);
        lock.insert(effective_ws, tree.clone());
        tree
    }

    /// List all flat projects registered in this workspace.
    pub fn list_projects(&self, workspace_path: &Path) -> Vec<ProjectNode> {
        let tree = self.get_or_load_tree(workspace_path);
        tree.get_all()
    }

    /// Return nested recursive hierarchy tree starting from all root projects.
    pub fn get_hierarchy(&self, workspace_path: &Path) -> Vec<ProjectTreeNode> {
        let tree = self.get_or_load_tree(workspace_path);
        tree.build_nested_hierarchy()
    }

    /// Create a new project or sub-project in the hierarchy.
    pub fn create_project(
        &self,
        workspace_path: &Path,
        req: CreateProjectRequest,
    ) -> Result<ProjectNode, String> {
        let effective_ws = storage::resolve_safe_workspace(workspace_path);

        let mut tree = self.get_or_load_tree(&effective_ws);
        let id = format!("proj-{}", now_ms());

        let node = ProjectNode {
            id: id.clone(),
            parent_id: req.parent_id,
            name: req.name.trim().to_string(),
            description: req.description.unwrap_or_default().trim().to_string(),
            scope_paths: req.scope_paths.unwrap_or_default(),
            status: ProjectStatus::Idle,
            active_debate_id: None,
            active_pipeline_id: None,
            created_at: now_ms(),
            updated_at: now_ms(),
        };

        // Validate tree constraints
        tree.insert(node.clone())?;
        storage::save_project_node(&effective_ws, &node)?;

        // Update cache
        let mut lock = self.tree_cache.lock().unwrap();
        lock.insert(effective_ws.clone(), tree);

        // Record initial creation in scoped memory
        let _ = memory::record_scoped_memory(
            &effective_ws,
            &id,
            "system",
            MemoryEntryKind::Decision,
            &format!("Created project node `{}` ({})", node.name, id),
            Some(&node.description),
            vec!["lifecycle".to_string(), "init".to_string()],
        );

        Ok(node)
    }

    /// Update an existing project node.
    pub fn update_project(
        &self,
        workspace_path: &Path,
        project_id: &str,
        req: UpdateProjectRequest,
    ) -> Result<ProjectNode, String> {
        let effective_ws = storage::resolve_safe_workspace(workspace_path);
        let mut tree = self.get_or_load_tree(&effective_ws);
        let mut current = tree
            .get(project_id)
            .cloned()
            .ok_or_else(|| format!("Project '{}' not found", project_id))?;

        if let Some(n) = req.name {
            current.name = n.trim().to_string();
        }
        if let Some(d) = req.description {
            current.description = d.trim().to_string();
        }
        if let Some(p) = req.scope_paths {
            current.scope_paths = p;
        }
        if let Some(s) = req.status {
            current.status = s;
        }
        if req.active_debate_id.is_some() {
            current.active_debate_id = req.active_debate_id;
        }
        if req.active_pipeline_id.is_some() {
            current.active_pipeline_id = req.active_pipeline_id;
        }
        current.updated_at = now_ms();

        tree.insert(current.clone())?;
        storage::save_project_node(&effective_ws, &current)?;

        let mut lock = self.tree_cache.lock().unwrap();
        lock.insert(effective_ws, tree);

        Ok(current)
    }

    /// Deletes a project node and all of its recursive child sub-projects.
    pub fn delete_project(&self, workspace_path: &Path, project_id: &str) -> Result<bool, String> {
        let effective_ws = storage::resolve_safe_workspace(workspace_path);
        let mut tree = self.get_or_load_tree(&effective_ws);
        let removed_ids = tree.remove_subtree(project_id);

        for id in &removed_ids {
            let _ = storage::delete_project_dir(&effective_ws, id);
        }

        let mut lock = self.tree_cache.lock().unwrap();
        lock.insert(effective_ws, tree);

        Ok(!removed_ids.is_empty())
    }

    /// Read master memory ledger.
    pub fn get_master_memory(&self, workspace_path: &Path) -> String {
        storage::read_master_memory(workspace_path)
    }

    /// Update master memory ledger.
    pub fn update_master_memory(&self, workspace_path: &Path, content: &str) -> Result<(), String> {
        storage::write_master_memory(workspace_path, content)
    }

    /// Read scoped memory for a specific project node.
    pub fn get_project_memory(
        &self,
        workspace_path: &Path,
        project_id: &str,
    ) -> Vec<ProjectMemoryRecord> {
        storage::read_project_memory_records(workspace_path, project_id)
    }

    /// Append record to project scoped memory.
    pub fn append_project_memory(
        &self,
        workspace_path: &Path,
        project_id: &str,
        author_role: &str,
        kind: MemoryEntryKind,
        summary: &str,
        details: Option<&str>,
        tags: Vec<String>,
    ) -> Result<ProjectMemoryRecord, String> {
        memory::record_scoped_memory(
            workspace_path,
            project_id,
            author_role,
            kind,
            summary,
            details,
            tags,
        )
    }

    /// Generate an OMH-aligned Recall Pack bounded by token budget.
    pub fn generate_recall_pack(
        &self,
        workspace_path: &Path,
        project_id: &str,
        max_tokens: usize,
    ) -> RecallPack {
        let tree = self.get_or_load_tree(workspace_path);
        memory::build_recall_pack(workspace_path, &tree, project_id, max_tokens)
    }

    /// Roll up a project's verified deliverables into Master Memory.
    pub fn rollup_project(
        &self,
        workspace_path: &Path,
        project_id: &str,
        summary: &str,
    ) -> Result<(), String> {
        let tree = self.get_or_load_tree(workspace_path);
        let project = tree
            .get(project_id)
            .ok_or_else(|| format!("Project '{}' not found for rollup", project_id))?;

        memory::rollup_project_to_master(workspace_path, project, summary)?;

        // Update project status to Completed
        self.update_project(
            workspace_path,
            project_id,
            UpdateProjectRequest {
                name: None,
                description: None,
                scope_paths: None,
                status: Some(ProjectStatus::Completed),
                active_debate_id: None,
                active_pipeline_id: None,
            },
        )?;

        Ok(())
    }
}


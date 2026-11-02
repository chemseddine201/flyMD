use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

fn default_theme() -> String {
    "dark".to_string()
}
fn default_false() -> bool {
    false
}
fn default_true() -> bool {
    true
}
fn default_ollama_url() -> String {
    "http://127.0.0.1:11434".to_string()
}
fn default_ollama_model() -> String {
    "".to_string()
}
fn default_view() -> String {
    "split".to_string()
}
fn default_font_size() -> u32 {
    14
}
fn default_text_dir() -> String {
    "auto".to_string()
}
fn default_scan_mode() -> String {
    "full-tree".to_string()
}
fn default_width_mode() -> String {
    "wide".to_string()
}
fn default_allowed_extensions() -> Vec<String> {
    vec![".md".to_string(), ".markdown".to_string()]
}
fn default_llm_config() -> crate::llm::LLMConfig {
    crate::llm::LLMConfig {
        provider: "ollama".to_string(),
        endpoint_url: "http://127.0.0.1:11434".to_string(),
        api_key: Some("".to_string()),
        model: "qwen2.5:3b".to_string(),
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct AccessibilityConfig {
    #[serde(rename = "highContrast", default)]
    pub high_contrast: bool,
    #[serde(rename = "dyslexicFont", default)]
    pub dyslexic_font: bool,
    #[serde(rename = "largePrint", default)]
    pub large_print: bool,
    #[serde(rename = "reducedMotion", default)]
    pub reduced_motion: bool,
    #[serde(rename = "colorBlindSafe", default)]
    pub color_blind_safe: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppSettings {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(rename = "floatAlwaysOnTop", default = "default_false")]
    pub float_always_on_top: bool,
    #[serde(rename = "previewAlwaysOnTop", default = "default_false")]
    pub preview_always_on_top: bool,
    #[serde(rename = "ollamaUrl", default = "default_ollama_url")]
    pub ollama_url: String,
    #[serde(rename = "ollamaModel", default = "default_ollama_model")]
    pub ollama_model: String,
    #[serde(rename = "defaultView", default = "default_view")]
    pub default_view: String,
    #[serde(rename = "autoSave", default = "default_false")]
    pub auto_save: bool,
    #[serde(rename = "fontSize", default = "default_font_size")]
    pub font_size: u32,
    #[serde(rename = "syncScroll", default = "default_true")]
    pub sync_scroll: bool,
    #[serde(rename = "textDirection", default = "default_text_dir")]
    pub text_direction: String,
    #[serde(rename = "llmConfig", default = "default_llm_config")]
    pub llm_config: crate::llm::LLMConfig,
    #[serde(rename = "previewWidthMode", default = "default_width_mode")]
    pub preview_width_mode: String,
    #[serde(rename = "a11yConfig", default)]
    pub a11y_config: AccessibilityConfig,
    #[serde(rename = "defaultAllowedExtensions", default = "default_allowed_extensions")]
    pub default_allowed_extensions: Vec<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            float_always_on_top: false,
            preview_always_on_top: false,
            ollama_url: default_ollama_url(),
            ollama_model: default_ollama_model(),
            default_view: default_view(),
            auto_save: false,
            font_size: default_font_size(),
            sync_scroll: true,
            text_direction: default_text_dir(),
            llm_config: default_llm_config(),
            preview_width_mode: default_width_mode(),
            a11y_config: AccessibilityConfig::default(),
            default_allowed_extensions: default_allowed_extensions(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HistoryItem {
    pub id: String,
    pub path: String,
    pub name: String,
    #[serde(rename = "lastOpened")]
    pub last_opened: i64,
    #[serde(default)]
    pub preview: String,
    #[serde(default)]
    pub size: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct FloatBounds {
    pub x: Option<i32>,
    pub y: Option<i32>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PreviewBounds {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub x: Option<i32>,
    pub y: Option<i32>,
    #[serde(rename = "isMaximized", default)]
    pub is_maximized: bool,
}

impl Default for PreviewBounds {
    fn default() -> Self {
        Self {
            width: Some(1440),
            height: Some(920),
            x: None,
            y: None,
            is_maximized: false,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FolderSupervisionConfig {
    pub path: String,
    pub name: String,
    pub enabled: bool,
    #[serde(rename = "autoOpenNew", default)]
    pub auto_open_new: bool,
    #[serde(rename = "scanMode", default = "default_scan_mode")]
    pub scan_mode: String,
    #[serde(rename = "collectExternalAgentArtifacts", default = "default_true")]
    pub collect_external_agent_artifacts: bool,
    #[serde(rename = "allowedExtensions", default = "default_allowed_extensions")]
    pub allowed_extensions: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StoreSchema {
    #[serde(rename = "schemaVersion", default = "current_version")]
    pub schema_version: u32,
    #[serde(default)]
    pub settings: AppSettings,
    #[serde(default)]
    pub history: Vec<HistoryItem>,
    #[serde(rename = "floatBounds", default)]
    pub float_bounds: FloatBounds,
    #[serde(rename = "previewBounds", default)]
    pub preview_bounds: PreviewBounds,
    #[serde(rename = "supervisionConfig")]
    pub supervision_config: Option<FolderSupervisionConfig>,
    #[serde(rename = "agentCredentials", default)]
    pub agent_credentials: std::collections::HashMap<String, crate::agents::AgentCredentialConfig>,
    #[serde(rename = "agentTasks", default)]
    pub agent_tasks: Vec<crate::agents::AgentTaskRecord>,
    #[serde(rename = "agentCheckpoints", default)]
    pub agent_checkpoints: Vec<crate::agents::AgentCheckpoint>,
}

fn current_version() -> u32 {
    3
}

impl Default for StoreSchema {
    fn default() -> Self {
        Self {
            schema_version: 3,
            settings: AppSettings::default(),
            history: Vec::new(),
            float_bounds: FloatBounds::default(),
            preview_bounds: PreviewBounds::default(),
            supervision_config: None,
            agent_credentials: std::collections::HashMap::new(),
            agent_tasks: Vec::new(),
            agent_checkpoints: Vec::new(),
        }
    }
}

pub struct AppStore {
    file_path: PathBuf,
    pub data: Mutex<StoreSchema>,
}

pub type SharedStore = Arc<AppStore>;

impl AppStore {
    pub fn new(config_dir: PathBuf) -> SharedStore {
        fs::create_dir_all(&config_dir).ok();
        let file_path = config_dir.join("fly-md-store.json");
        let initial_data = if file_path.exists() {
            fs::read_to_string(&file_path)
                .ok()
                .and_then(|raw| serde_json::from_str::<StoreSchema>(&raw).ok())
                .unwrap_or_default()
        } else {
            if let Ok(appdata) = std::env::var("APPDATA") {
                let electron_store = PathBuf::from(appdata)
                    .join("fly-md")
                    .join("fly-md-store.json");
                if electron_store.exists() {
                    fs::read_to_string(&electron_store)
                        .ok()
                        .and_then(|raw| serde_json::from_str::<StoreSchema>(&raw).ok())
                        .unwrap_or_default()
                } else {
                    StoreSchema::default()
                }
            } else {
                StoreSchema::default()
            }
        };

        Arc::new(AppStore {
            file_path,
            data: Mutex::new(initial_data),
        })
    }

    pub fn save(&self) {
        if let Ok(guard) = self.data.lock() {
            if let Ok(json_str) = serde_json::to_string_pretty(&*guard) {
                fs::write(&self.file_path, json_str).ok();
            }
        }
    }

    pub fn get_settings(&self) -> AppSettings {
        self.data.lock().unwrap_or_else(|e| e.into_inner()).settings.clone()
    }

    pub fn save_settings(&self, partial: serde_json::Value) -> AppSettings {
        let mut guard = self.data.lock().unwrap_or_else(|e| e.into_inner());
        if let Ok(mut current_val) = serde_json::to_value(&guard.settings) {
            if let (Some(c_obj), Some(p_obj)) = (current_val.as_object_mut(), partial.as_object()) {
                for (k, v) in p_obj {
                    c_obj.insert(k.clone(), v.clone());
                }
                if let Ok(updated) = serde_json::from_value::<AppSettings>(current_val) {
                    guard.settings = updated;
                }
            }
        }
        let res = guard.settings.clone();
        drop(guard);
        self.save();
        res
    }

    pub fn get_history(&self) -> Vec<HistoryItem> {
        self.data.lock().unwrap_or_else(|e| e.into_inner()).history.clone()
    }

    pub fn add_history(&self, item: HistoryItem) -> Vec<HistoryItem> {
        let mut guard = self.data.lock().unwrap_or_else(|e| e.into_inner());
        guard.history.retain(|h| h.path != item.path);
        guard.history.insert(0, item);
        if guard.history.len() > 20 {
            guard.history.truncate(20);
        }
        let res = guard.history.clone();
        drop(guard);
        self.save();
        res
    }

    pub fn remove_history(&self, id: &str) -> Vec<HistoryItem> {
        let mut guard = self.data.lock().unwrap_or_else(|e| e.into_inner());
        guard.history.retain(|h| h.id != id);
        let res = guard.history.clone();
        drop(guard);
        self.save();
        res
    }

    pub fn clear_history(&self) {
        let mut guard = self.data.lock().unwrap_or_else(|e| e.into_inner());
        guard.history.clear();
        drop(guard);
        self.save();
    }

    pub fn get_float_bounds(&self) -> FloatBounds {
        self.data.lock().unwrap_or_else(|e| e.into_inner()).float_bounds.clone()
    }

    pub fn update_float_bounds(&self, x: i32, y: i32) {
        let mut guard = self.data.lock().unwrap_or_else(|e| e.into_inner());
        guard.float_bounds = FloatBounds {
            x: Some(x),
            y: Some(y),
        };
    }

    pub fn set_float_bounds(&self, x: i32, y: i32) {
        let mut guard = self.data.lock().unwrap_or_else(|e| e.into_inner());
        guard.float_bounds = FloatBounds {
            x: Some(x),
            y: Some(y),
        };
        drop(guard);
        self.save();
    }

    pub fn get_supervision_config(&self) -> Option<FolderSupervisionConfig> {
        self.data.lock().unwrap_or_else(|e| e.into_inner()).supervision_config.clone()
    }

    pub fn set_supervision_config(&self, config: Option<FolderSupervisionConfig>) {
        let mut guard = self.data.lock().unwrap_or_else(|e| e.into_inner());
        guard.supervision_config = config;
        drop(guard);
        self.save();
    }

    pub fn get_agent_credentials(
        &self,
    ) -> std::collections::HashMap<String, crate::agents::AgentCredentialConfig> {
        self.data.lock().unwrap_or_else(|e| e.into_inner()).agent_credentials.clone()
    }

    pub fn set_agent_credential(&self, agent_id: &str, cred: crate::agents::AgentCredentialConfig) {
        let mut guard = self.data.lock().unwrap_or_else(|e| e.into_inner());
        guard.agent_credentials.insert(agent_id.to_string(), cred);
        drop(guard);
        self.save();
    }

    pub fn remove_agent_credential(&self, agent_id: &str) {
        let mut guard = self.data.lock().unwrap_or_else(|e| e.into_inner());
        guard.agent_credentials.remove(agent_id);
        drop(guard);
        self.save();
    }

    pub fn get_agent_tasks(&self) -> Vec<crate::agents::AgentTaskRecord> {
        self.data.lock().unwrap_or_else(|e| e.into_inner()).agent_tasks.clone()
    }

    /// Mutates an agent task in place under a single lock acquisition without TOCTOU races.
    /// Only clones the full `agent_tasks` vector when `snapshot_all` is true (e.g., when the
    /// caller is ready to emit a throttled IPC broadcast), avoiding 95%+ of heap clones during streaming.
    /// If `persist` is true, immediately saves to disk (for state transitions or 1s debounced flushes).
    pub fn mutate_agent_task<F>(
        &self,
        task_id: &str,
        persist: bool,
        snapshot_all: bool,
        f: F,
    ) -> Option<Option<Vec<crate::agents::AgentTaskRecord>>>
    where
        F: FnOnce(&mut crate::agents::AgentTaskRecord),
    {
        let mut guard = self.data.lock().unwrap_or_else(|e| e.into_inner());
        let pos = guard.agent_tasks.iter().position(|t| t.id == task_id)?;
        f(&mut guard.agent_tasks[pos]);
        let all_tasks = if snapshot_all {
            Some(guard.agent_tasks.clone())
        } else {
            None
        };
        drop(guard);

        if persist {
            self.save();
        }

        Some(all_tasks)
    }

    pub fn save_agent_tasks(&self, tasks: Vec<crate::agents::AgentTaskRecord>) {
        let mut guard = self.data.lock().unwrap_or_else(|e| e.into_inner());
        guard.agent_tasks = tasks;
        if guard.agent_tasks.len() > 50 {
            guard.agent_tasks.truncate(50);
        }
        drop(guard);
        self.save();
    }

    pub fn get_agent_checkpoints(&self) -> Vec<crate::agents::AgentCheckpoint> {
        self.data.lock().unwrap_or_else(|e| e.into_inner()).agent_checkpoints.clone()
    }

    pub fn save_agent_checkpoints(&self, checkpoints: Vec<crate::agents::AgentCheckpoint>) {
        let mut guard = self.data.lock().unwrap_or_else(|e| e.into_inner());
        guard.agent_checkpoints = checkpoints;
        if guard.agent_checkpoints.len() > 30 {
            guard.agent_checkpoints.truncate(30);
        }
        drop(guard);
        self.save();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agents::{now_ms, AgentTaskRecord};

    fn sample_task(id: &str) -> AgentTaskRecord {
        AgentTaskRecord {
            id: id.to_string(),
            target_agent_id: "claude-code".to_string(),
            source_agent_id: None,
            file_path: "plan.md".to_string(),
            file_name: "plan.md".to_string(),
            intent: "build".to_string(),
            custom_prompt: None,
            workspace_path: ".".to_string(),
            worktree_path: None,
            checkpoint_id: None,
            handoff_file_path: None,
            output_report_path: None,
            status: "running".to_string(),
            created_at: 1000,
            started_at: Some(1000),
            completed_at: None,
            logs: Vec::new(),
            checklist_total: 0,
            checklist_completed: 0,
            error: None,
            pipeline_id: None,
            next_agent_in_chain: None,
            next_intent_in_chain: None,
            response_markdown: None,
            thinking_trace: Vec::new(),
            progress_stage: Some("executing".to_string()),
            progress_percent: 50,
            tool_actions: Vec::new(),
            custom_action_id: None,
            step_note: None,
            verification_report: None,
            outcome_reason: None,
            attempt_count: 1,
            error_diagnostic: None,
            cli_session_id: None,
            modified_files: Vec::new(),
            effort_level: Some("medium".to_string()),
            thinking_enabled: Some(true),
            model_id: None,
            token_usage: None,
        }
    }

    #[test]
    fn test_mutate_agent_task_conditional_snapshot() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_store_test_{}", now_ms()));
        let store = AppStore::new(temp_dir.clone());
        store.save_agent_tasks(vec![sample_task("task-1"), sample_task("task-2")]);

        // Missing task returns None
        let missing = store.mutate_agent_task("task-999", false, false, |t| {
            t.logs.push("nope".to_string());
        });
        assert!(missing.is_none());

        // Throttled streaming mutation (snapshot_all = false) mutates in place without cloning vector
        let no_snap = store.mutate_agent_task("task-1", false, false, |t| {
            t.logs.push("line-1".to_string());
            t.progress_percent = 76;
        });
        assert!(matches!(no_snap, Some(None)));

        // Broadcast mutation (snapshot_all = true) returns full vector snapshot reflecting prior mutations
        let with_snap = store
            .mutate_agent_task("task-1", true, true, |t| {
                t.logs.push("line-2".to_string());
                t.status = "completed".to_string();
            })
            .flatten()
            .expect("expected task vector snapshot");

        assert_eq!(with_snap.len(), 2);
        assert_eq!(with_snap[0].logs, vec!["line-1", "line-2"]);
        assert_eq!(with_snap[0].progress_percent, 76);
        assert_eq!(with_snap[0].status, "completed");

        fs::remove_dir_all(&temp_dir).ok();
    }
}

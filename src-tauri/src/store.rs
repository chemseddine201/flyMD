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
        self.data.lock().unwrap().settings.clone()
    }

    pub fn save_settings(&self, partial: serde_json::Value) -> AppSettings {
        let mut guard = self.data.lock().unwrap();
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
        self.data.lock().unwrap().history.clone()
    }

    pub fn add_history(&self, item: HistoryItem) -> Vec<HistoryItem> {
        let mut guard = self.data.lock().unwrap();
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
        let mut guard = self.data.lock().unwrap();
        guard.history.retain(|h| h.id != id);
        let res = guard.history.clone();
        drop(guard);
        self.save();
        res
    }

    pub fn clear_history(&self) {
        let mut guard = self.data.lock().unwrap();
        guard.history.clear();
        drop(guard);
        self.save();
    }

    pub fn get_float_bounds(&self) -> FloatBounds {
        self.data.lock().unwrap().float_bounds.clone()
    }

    pub fn update_float_bounds(&self, x: i32, y: i32) {
        let mut guard = self.data.lock().unwrap();
        guard.float_bounds = FloatBounds {
            x: Some(x),
            y: Some(y),
        };
    }

    pub fn set_float_bounds(&self, x: i32, y: i32) {
        let mut guard = self.data.lock().unwrap();
        guard.float_bounds = FloatBounds {
            x: Some(x),
            y: Some(y),
        };
        drop(guard);
        self.save();
    }

    pub fn get_supervision_config(&self) -> Option<FolderSupervisionConfig> {
        self.data.lock().unwrap().supervision_config.clone()
    }

    pub fn set_supervision_config(&self, config: Option<FolderSupervisionConfig>) {
        let mut guard = self.data.lock().unwrap();
        guard.supervision_config = config;
        drop(guard);
        self.save();
    }

    pub fn get_agent_credentials(
        &self,
    ) -> std::collections::HashMap<String, crate::agents::AgentCredentialConfig> {
        self.data.lock().unwrap().agent_credentials.clone()
    }

    pub fn set_agent_credential(&self, agent_id: &str, cred: crate::agents::AgentCredentialConfig) {
        let mut guard = self.data.lock().unwrap();
        guard.agent_credentials.insert(agent_id.to_string(), cred);
        drop(guard);
        self.save();
    }

    pub fn remove_agent_credential(&self, agent_id: &str) {
        let mut guard = self.data.lock().unwrap();
        guard.agent_credentials.remove(agent_id);
        drop(guard);
        self.save();
    }

    pub fn get_agent_tasks(&self) -> Vec<crate::agents::AgentTaskRecord> {
        self.data.lock().unwrap().agent_tasks.clone()
    }

    pub fn save_agent_tasks(&self, tasks: Vec<crate::agents::AgentTaskRecord>) {
        let mut guard = self.data.lock().unwrap();
        guard.agent_tasks = tasks;
        if guard.agent_tasks.len() > 50 {
            guard.agent_tasks.truncate(50);
        }
        drop(guard);
        self.save();
    }

    pub fn get_agent_checkpoints(&self) -> Vec<crate::agents::AgentCheckpoint> {
        self.data.lock().unwrap().agent_checkpoints.clone()
    }

    pub fn save_agent_checkpoints(&self, checkpoints: Vec<crate::agents::AgentCheckpoint>) {
        let mut guard = self.data.lock().unwrap();
        guard.agent_checkpoints = checkpoints;
        if guard.agent_checkpoints.len() > 30 {
            guard.agent_checkpoints.truncate(30);
        }
        drop(guard);
        self.save();
    }
}

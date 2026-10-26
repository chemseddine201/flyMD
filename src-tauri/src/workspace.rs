use crate::agents::count_markdown_checklists;
use crate::store::{FolderSupervisionConfig, SharedStore};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ScannedMdFile {
    pub path: String,
    pub name: String,
    #[serde(rename = "relativePath")]
    pub relative_path: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "modifiedAt")]
    pub modified_at: i64,
    pub size: u64,
    #[serde(rename = "isNew")]
    pub is_new: bool,
    #[serde(rename = "sourceAgent")]
    pub source_agent: Option<String>,
    #[serde(rename = "checklistTotal", default)]
    pub checklist_total: usize,
    #[serde(rename = "checklistDone", default)]
    pub checklist_done: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SupervisedFileEvent {
    pub file: ScannedMdFile,
    #[serde(rename = "isNew")]
    pub is_new: bool,
    #[serde(rename = "autoOpen")]
    pub auto_open: bool,
}

pub struct WorkspaceManager {
    store: SharedStore,
    app_handle: AppHandle,
    session_start_time: i64,
    active_watcher: Mutex<Option<RecommendedWatcher>>,
    known_files: Arc<Mutex<HashMap<String, i64>>>,
    debounce_map: Arc<Mutex<HashMap<String, Instant>>>,
}

pub type SharedWorkspaceManager = Arc<WorkspaceManager>;

fn is_markdown(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.ends_with(".md")
        || lower.ends_with(".markdown")
        || lower.ends_with(".mdown")
        || lower.ends_with(".mdc")
        || lower.ends_with(".txt")
}

fn is_ignored_dir(name: &str) -> bool {
    // Ignore all hidden/dot directories (.flymd, .agent, .claude, .git, .vscode, etc.)
    if name.starts_with('.') {
        return true;
    }
    matches!(
        name,
        "node_modules"
            | "checkpoints"
            | "worktrees"
            | "dist"
            | "dist-electron"
            | "build"
            | "release"
            | "vendor"
            | "coverage"
            | "target"
            | "bin"
            | "obj"
    )
}

fn inspect_markdown_metadata(path: &Path) -> (Option<String>, usize, usize) {
    let path_lower = path.to_string_lossy().to_lowercase();
    let fname_lower = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_lowercase();

    let mut detected_agent = if path_lower.contains("antigravity")
        || path_lower.contains(".agent")
        || path_lower.contains(".gemini")
    {
        Some("antigravity".to_string())
    } else if path_lower.contains("claude") || fname_lower == "claude.md" {
        Some("claude-code".to_string())
    } else if path_lower.contains("opencode") {
        Some("opencode".to_string())
    } else if path_lower.contains("cursor") {
        Some("cursor".to_string())
    } else if path_lower.contains("codex") {
        Some("codex".to_string())
    } else if path_lower.contains("zcode") || path_lower.contains(".zed") {
        Some("zcode".to_string())
    } else {
        None
    };

    if let Ok(content) = fs::read_to_string(path) {
        let (total, done) = count_markdown_checklists(&content);
        if detected_agent.is_none() {
            let head: String = content
                .lines()
                .take(20)
                .collect::<Vec<_>>()
                .join("\n")
                .to_lowercase();
            if head.contains("antigravity") {
                detected_agent = Some("antigravity".to_string());
            } else if head.contains("claude-code") || head.contains("claude code") {
                detected_agent = Some("claude-code".to_string());
            } else if head.contains("opencode") {
                detected_agent = Some("opencode".to_string());
            } else if head.contains("codex") {
                detected_agent = Some("codex".to_string());
            } else if head.contains("cursor") {
                detected_agent = Some("cursor".to_string());
            } else if head.contains("zcode") {
                detected_agent = Some("zcode".to_string());
            }
        }
        (detected_agent, total, done)
    } else {
        (detected_agent, 0, 0)
    }
}

impl WorkspaceManager {
    pub fn new(app_handle: AppHandle, store: SharedStore) -> SharedWorkspaceManager {
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        Arc::new(WorkspaceManager {
            store,
            app_handle,
            session_start_time: now,
            active_watcher: Mutex::new(None),
            known_files: Arc::new(Mutex::new(HashMap::new())),
            debounce_map: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    pub fn scan_directory(&self, root_str: &str, scan_mode: &str) -> Vec<ScannedMdFile> {
        let root = Path::new(root_str);
        if !root.exists() || !root.is_dir() {
            return Vec::new();
        }

        let mut results = Vec::new();
        let is_shallow = scan_mode == "shallow";

        if is_shallow {
            if let Ok(entries) = fs::read_dir(root) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                            if !file_name.starts_with('.') && is_markdown(file_name) {
                                if let Ok(meta) = entry.metadata() {
                                    let mtime = meta
                                        .modified()
                                        .ok()
                                        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                                        .map(|d| d.as_millis() as i64)
                                        .unwrap_or(0);
                                    let ctime = meta
                                        .created()
                                        .ok()
                                        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                                        .map(|d| d.as_millis() as i64)
                                        .unwrap_or(mtime);
                                    let is_recent = ctime >= self.session_start_time
                                        || mtime >= self.session_start_time;
                                    let (source_agent, checklist_total, checklist_done) =
                                        inspect_markdown_metadata(&path);

                                    results.push(ScannedMdFile {
                                        path: path.to_string_lossy().to_string(),
                                        name: file_name.to_string(),
                                        relative_path: file_name.to_string(),
                                        created_at: ctime,
                                        modified_at: mtime,
                                        size: meta.len(),
                                        is_new: is_recent,
                                        source_agent,
                                        checklist_total,
                                        checklist_done,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        } else {
            let walker = WalkDir::new(root).into_iter().filter_entry(|e| {
                if e.file_type().is_dir() {
                    let name = e.file_name().to_str().unwrap_or("");
                    !is_ignored_dir(name)
                } else {
                    true
                }
            });

            for entry in walker.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                        if is_markdown(file_name) {
                            if let Ok(meta) = entry.metadata() {
                                let mtime = meta
                                    .modified()
                                    .ok()
                                    .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                                    .map(|d| d.as_millis() as i64)
                                    .unwrap_or(0);
                                let ctime = meta
                                    .created()
                                    .ok()
                                    .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                                    .map(|d| d.as_millis() as i64)
                                    .unwrap_or(mtime);
                                let rel = path.strip_prefix(root).unwrap_or(path);
                                let is_recent = ctime >= self.session_start_time
                                    || mtime >= self.session_start_time;
                                let (source_agent, checklist_total, checklist_done) =
                                    inspect_markdown_metadata(path);

                                results.push(ScannedMdFile {
                                    path: path.to_string_lossy().to_string(),
                                    name: file_name.to_string(),
                                    relative_path: rel.to_string_lossy().to_string(),
                                    created_at: ctime,
                                    modified_at: mtime,
                                    size: meta.len(),
                                    is_new: is_recent,
                                    source_agent,
                                    checklist_total,
                                    checklist_done,
                                });
                            }
                        }
                    }
                }
            }
        }

        results.sort_by(|a, b| {
            let time_a = a.created_at.max(a.modified_at);
            let time_b = b.created_at.max(b.modified_at);
            time_b.cmp(&time_a)
        });

        {
            let mut kf = self.known_files.lock().unwrap();
            kf.clear();
            for f in &results {
                kf.insert(f.path.clone(), f.modified_at);
            }
        }

        results
    }

    pub fn set_supervision(&self, config: FolderSupervisionConfig) -> bool {
        {
            let mut w_guard = self.active_watcher.lock().unwrap();
            *w_guard = None;
        }

        if !config.enabled || config.path.is_empty() || !Path::new(&config.path).exists() {
            self.store.set_supervision_config(None);
            return true;
        }

        self.store.set_supervision_config(Some(config.clone()));

        let app_handle = self.app_handle.clone();
        let root_path_str = config.path.clone();
        let root_path = PathBuf::from(&root_path_str);
        let scan_mode = config.scan_mode.clone();
        let is_shallow = scan_mode == "shallow";
        let session_start = self.session_start_time;
        let known_files = Arc::clone(&self.known_files);
        let debounce_map = Arc::clone(&self.debounce_map);

        let watcher_res = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                match event.kind {
                    EventKind::Create(_) | EventKind::Modify(_) => {
                        for path in event.paths {
                            if !path.is_file() {
                                continue;
                            }
                            let fname = match path.file_name().and_then(|n| n.to_str()) {
                                Some(n) => n,
                                None => continue,
                            };
                            if !is_markdown(fname) {
                                continue;
                            }

                            let should_ignore = path.components().any(|c| {
                                let s = c.as_os_str().to_str().unwrap_or("");
                                is_ignored_dir(s)
                            });
                            if should_ignore {
                                continue;
                            }

                            let path_str = path.to_string_lossy().to_string();

                            {
                                let mut dm = debounce_map.lock().unwrap();
                                if let Some(last_time) = dm.get(&path_str) {
                                    if last_time.elapsed() < Duration::from_millis(300) {
                                        continue;
                                    }
                                }
                                dm.insert(path_str.clone(), Instant::now());
                            }

                            if let Ok(meta) = fs::metadata(&path) {
                                let mtime = meta
                                    .modified()
                                    .ok()
                                    .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                                    .map(|d| d.as_millis() as i64)
                                    .unwrap_or(0);
                                let ctime = meta
                                    .created()
                                    .ok()
                                    .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                                    .map(|d| d.as_millis() as i64)
                                    .unwrap_or(mtime);

                                let is_create_kind = matches!(event.kind, EventKind::Create(_));
                                let is_new = {
                                    let mut kf = known_files.lock().unwrap();
                                    let known = kf.contains_key(&path_str);
                                    kf.insert(path_str.clone(), mtime);
                                    is_create_kind || !known || ctime >= session_start
                                };

                                let rel = path.strip_prefix(&root_path).unwrap_or(&path);
                                let (source_agent, checklist_total, checklist_done) =
                                    inspect_markdown_metadata(&path);

                                let scanned = ScannedMdFile {
                                    path: path_str.clone(),
                                    name: fname.to_string(),
                                    relative_path: rel.to_string_lossy().to_string(),
                                    created_at: ctime,
                                    modified_at: mtime,
                                    size: meta.len(),
                                    is_new,
                                    source_agent,
                                    checklist_total,
                                    checklist_done,
                                };

                                let evt = SupervisedFileEvent {
                                    file: scanned,
                                    is_new,
                                    auto_open: is_new,
                                };

                                app_handle.emit("workspace:file-event", &evt).ok();
                            }
                        }
                    }
                    _ => {}
                }
            }
        });

        if let Ok(mut watcher) = watcher_res {
            let recursive_mode = if is_shallow {
                RecursiveMode::NonRecursive
            } else {
                RecursiveMode::Recursive
            };
            if watcher
                .watch(Path::new(&config.path), recursive_mode)
                .is_ok()
            {
                let mut w_guard = self.active_watcher.lock().unwrap();
                *w_guard = Some(watcher);
                println!(
                    "[WorkspaceManager] Now supervising {} (mode: {}, autoOpen: {})",
                    config.path, config.scan_mode, config.auto_open_new
                );
                return true;
            }
        }

        false
    }
}

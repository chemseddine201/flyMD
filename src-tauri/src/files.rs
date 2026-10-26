use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::SystemTime;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileOpenResult {
    pub path: String,
    pub name: String,
    pub content: String,
    #[serde(rename = "lastModified")]
    pub last_modified: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileSaveResponse {
    pub success: bool,
    pub path: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

pub fn read_file_entry(path_str: &str) -> Result<FileOpenResult, String> {
    let p = Path::new(path_str);
    if !p.exists() {
        return Err(format!("File does not exist: {}", path_str));
    }
    let content = fs::read_to_string(p).map_err(|e| e.to_string())?;
    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("document.md").to_string();
    let meta = fs::metadata(p).map_err(|e| e.to_string())?;
    let last_modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    Ok(FileOpenResult {
        path: path_str.to_string(),
        name,
        content,
        last_modified,
    })
}

#[tauri::command]
pub async fn cmd_open_file_dialog(app: AppHandle) -> Result<Option<FileOpenResult>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("Markdown Files", &["md", "markdown", "mdown", "txt"])
        .add_filter("All Files", &["*"])
        .blocking_pick_file();

    match file_path {
        Some(p) => {
            let path_str = p.as_path().and_then(|p| p.to_str()).unwrap_or("").to_string();
            if path_str.is_empty() {
                Ok(None)
            } else {
                read_file_entry(&path_str).map(Some)
            }
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn cmd_open_folder_dialog(app: AppHandle) -> Result<Option<String>, String> {
    let folder_path = app.dialog().file().blocking_pick_folder();
    match folder_path {
        Some(p) => {
            let path_str = p.as_path().and_then(|p| p.to_str()).unwrap_or("").to_string();
            if path_str.is_empty() {
                Ok(None)
            } else {
                Ok(Some(path_str))
            }
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn cmd_read_file(file_path: String) -> Result<FileOpenResult, String> {
    read_file_entry(&file_path)
}

#[tauri::command]
pub async fn cmd_save_file(file_path: String, content: String) -> Result<FileSaveResponse, String> {
    match fs::write(&file_path, &content) {
        Ok(_) => Ok(FileSaveResponse {
            success: true,
            path: Some(file_path),
            error: None,
        }),
        Err(e) => Ok(FileSaveResponse {
            success: false,
            path: Some(file_path),
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn cmd_save_file_dialog(
    app: AppHandle,
    default_name: String,
    content: String,
    filters: Vec<FileFilter>,
) -> Result<FileSaveResponse, String> {
    let mut builder = app.dialog().file().set_file_name(&default_name);
    for f in &filters {
        let exts: Vec<&str> = f.extensions.iter().map(|s| s.as_str()).collect();
        builder = builder.add_filter(&f.name, &exts);
    }
    if filters.is_empty() {
        builder = builder.add_filter("Markdown Files", &["md", "markdown"]);
    }

    let save_path = builder.blocking_save_file();
    match save_path {
        Some(p) => {
            let path_str = p.as_path().and_then(|p| p.to_str()).unwrap_or("").to_string();
            if path_str.is_empty() {
                return Ok(FileSaveResponse {
                    success: false,
                    path: None,
                    error: Some("No path chosen".to_string()),
                });
            }
            match fs::write(&path_str, &content) {
                Ok(_) => Ok(FileSaveResponse {
                    success: true,
                    path: Some(path_str),
                    error: None,
                }),
                Err(e) => Ok(FileSaveResponse {
                    success: false,
                    path: Some(path_str),
                    error: Some(e.to_string()),
                }),
            }
        }
        None => Ok(FileSaveResponse {
            success: false,
            path: None,
            error: Some("Save cancelled".to_string()),
        }),
    }
}


use crate::files::read_file_entry;
use crate::store::SharedStore;
use crate::workspace::SharedWorkspaceManager;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub const BRIDGE_SCRIPT: &str = include_str!("../../bridge/tauri-bridge.js");

pub fn get_or_create_float_window(app: &AppHandle, store: &SharedStore) -> Result<WebviewWindow, String> {
    if let Some(win) = app.get_webview_window("float") {
        win.show().ok();
        win.set_focus().ok();
        return Ok(win);
    }

    let saved_bounds = store.get_float_bounds();
    let settings = store.get_settings();

    let default_x = 1920 - 380 - 40;
    let default_y = (1080 - 560) / 2;
    let x = saved_bounds.x.unwrap_or(default_x);
    let y = saved_bounds.y.unwrap_or(default_y);

    let win = WebviewWindowBuilder::new(app, "float", WebviewUrl::App("float.html".into()))
        .title("FlyMD Hub")
        .inner_size(380.0, 560.0)
        .position(x as f64, y as f64)
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .resizable(false)
        .always_on_top(settings.float_always_on_top)
        .initialization_script(BRIDGE_SCRIPT)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(win)
}

pub fn get_or_create_preview_window(app: &AppHandle, store: &SharedStore) -> Result<WebviewWindow, String> {
    if let Some(win) = app.get_webview_window("preview") {
        return Ok(win);
    }

    let settings = store.get_settings();
    let bounds = {
        let guard = store.data.lock().unwrap();
        guard.preview_bounds.clone()
    };

    let w = bounds.width.unwrap_or(1150) as f64;
    let h = bounds.height.unwrap_or(780) as f64;

    let mut builder = WebviewWindowBuilder::new(app, "preview", WebviewUrl::App("index.html".into()))
        .title("FlyMD - Preview & Editor")
        .inner_size(w, h)
        .min_inner_size(700.0, 500.0)
        .decorations(false)
        .visible(false)
        .always_on_top(settings.preview_always_on_top)
        .initialization_script(BRIDGE_SCRIPT);

    if let (Some(x), Some(y)) = (bounds.x, bounds.y) {
        builder = builder.position(x as f64, y as f64);
    }

    let win = builder.build().map_err(|e| e.to_string())?;

    if bounds.is_maximized {
        win.maximize().ok();
    }

    Ok(win)
}

#[cfg(windows)]
pub fn set_webview_memory_level(_window: &WebviewWindow, _low: bool) {}

#[cfg(not(windows))]
pub fn set_webview_memory_level(_window: &WebviewWindow, _low: bool) {}

#[tauri::command]
pub async fn cmd_toggle_float_pin(app: AppHandle, store: tauri::State<'_, SharedStore>) -> Result<bool, String> {
    let current = store.get_settings().float_always_on_top;
    let next = !current;
    store.save_settings(serde_json::json!({ "floatAlwaysOnTop": next }));
    if let Some(win) = app.get_webview_window("float") {
        win.set_always_on_top(next).map_err(|e| e.to_string())?;
    }
    Ok(next)
}

#[tauri::command]
pub async fn cmd_get_float_pin(store: tauri::State<'_, SharedStore>) -> Result<bool, String> {
    Ok(store.get_settings().float_always_on_top)
}

#[tauri::command]
pub async fn cmd_toggle_preview_pin(app: AppHandle, store: tauri::State<'_, SharedStore>) -> Result<bool, String> {
    let current = store.get_settings().preview_always_on_top;
    let next = !current;
    store.save_settings(serde_json::json!({ "previewAlwaysOnTop": next }));
    if let Some(win) = app.get_webview_window("preview") {
        win.set_always_on_top(next).map_err(|e| e.to_string())?;
    }
    Ok(next)
}

#[tauri::command]
pub async fn cmd_get_preview_pin(store: tauri::State<'_, SharedStore>) -> Result<bool, String> {
    Ok(store.get_settings().preview_always_on_top)
}

#[tauri::command]
pub async fn cmd_minimize_window(window: WebviewWindow) -> Result<(), String> {
    if window.label() == "preview" {
        set_webview_memory_level(&window, true);
    }
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_maximize_window(window: WebviewWindow) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn cmd_close_window(window: WebviewWindow) -> Result<(), String> {
    if window.label() == "preview" {
        set_webview_memory_level(&window, true);
        window.hide().map_err(|e| e.to_string())
    } else {
        window.close().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn cmd_move_float_window(
    window: WebviewWindow,
    store: tauri::State<'_, SharedStore>,
    delta_x: f64,
    delta_y: f64,
) -> Result<(), String> {
    if let Ok(pos) = window.outer_position() {
        let new_x = pos.x + delta_x as i32;
        let new_y = pos.y + delta_y as i32;
        window.set_position(PhysicalPosition::new(new_x, new_y)).ok();
        store.set_float_bounds(new_x, new_y);
    }
    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct PositionResult {
    pub x: i32,
    pub y: i32,
}

#[tauri::command]
pub async fn cmd_get_float_position(window: WebviewWindow) -> Result<PositionResult, String> {
    let pos = window.outer_position().unwrap_or(PhysicalPosition::new(0, 0));
    Ok(PositionResult { x: pos.x, y: pos.y })
}

#[tauri::command]
pub async fn cmd_set_float_position(
    window: WebviewWindow,
    store: tauri::State<'_, SharedStore>,
    x: i32,
    y: i32,
) -> Result<(), String> {
    window.set_position(PhysicalPosition::new(x, y)).ok();
    store.update_float_bounds(x, y);
    Ok(())
}

#[tauri::command]
pub async fn cmd_save_float_position(store: tauri::State<'_, SharedStore>) -> Result<(), String> {
    store.save();
    Ok(())
}

#[tauri::command]
pub async fn cmd_hide_float_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("float") {
        win.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn cmd_set_float_expanded(_window: WebviewWindow, _expanded: bool) -> Result<(), String> {
    Ok(())
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FolderLoadedEvent {
    #[serde(rename = "folderPath")]
    pub path: String,
    #[serde(rename = "folderName")]
    pub name: String,
    pub files: Vec<crate::workspace::ScannedMdFile>,
}

#[tauri::command]
pub async fn cmd_open_in_preview(
    app: AppHandle,
    store: tauri::State<'_, SharedStore>,
    workspace: tauri::State<'_, SharedWorkspaceManager>,
    file_path: String,
) -> Result<(), String> {
    let preview_win = get_or_create_preview_window(&app, &store)?;
    set_webview_memory_level(&preview_win, false);
    preview_win.show().ok();
    preview_win.set_focus().ok();

    if file_path.is_empty() {
        return Ok(());
    }

    let p = Path::new(&file_path);
    if p.is_dir() {
        let files = workspace.scan_directory(&file_path, "full-tree");
        let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("folder").to_string();

        let config = crate::store::FolderSupervisionConfig {
            path: file_path.clone(),
            name: name.clone(),
            enabled: true,
            auto_open_new: true,
            scan_mode: "full-tree".to_string(),
        };
        workspace.set_supervision(config);

        let payload = FolderLoadedEvent {
            path: file_path.clone(),
            name,
            files,
        };
        std::thread::sleep(std::time::Duration::from_millis(150));
        preview_win.emit("preview:folder-loaded", payload).ok();
    } else {
        if let Ok(file_entry) = read_file_entry(&file_path) {
            let item = crate::store::HistoryItem {
                id: format!("hist_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()),
                path: file_path.clone(),
                name: file_entry.name.clone(),
                last_opened: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64,
                preview: file_entry.content.chars().take(150).collect(),
                size: file_entry.content.len() as u64,
            };
            let updated_hist = store.add_history(item);
            app.emit("history:updated", updated_hist).ok();

            std::thread::sleep(std::time::Duration::from_millis(150));
            preview_win.emit("preview:file-loaded", file_entry).ok();
        }
    }

    Ok(())
}
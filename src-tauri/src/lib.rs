pub mod agents;
pub mod files;
pub mod llm;
pub mod pdf;
pub mod store;
pub mod windows;
pub mod workspace;

use agents::*;
use files::*;
use llm::*;
use pdf::*;
use store::*;
use windows::*;
use workspace::*;

use std::path::Path;
use std::sync::Arc;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
fn cmd_get_history(store: tauri::State<'_, SharedStore>) -> Vec<HistoryItem> {
    store.get_history()
}

#[tauri::command]
fn cmd_add_history(
    app: AppHandle,
    store: tauri::State<'_, SharedStore>,
    item: HistoryItem,
) -> Vec<HistoryItem> {
    let updated = store.add_history(item);
    app.emit("history:updated", &updated).ok();
    updated
}

#[tauri::command]
fn cmd_remove_history(
    app: AppHandle,
    store: tauri::State<'_, SharedStore>,
    id: String,
) -> Vec<HistoryItem> {
    let updated = store.remove_history(&id);
    app.emit("history:updated", &updated).ok();
    updated
}

#[tauri::command]
fn cmd_clear_history(app: AppHandle, store: tauri::State<'_, SharedStore>) {
    store.clear_history();
    app.emit("history:updated", Vec::<HistoryItem>::new()).ok();
}

#[tauri::command]
fn cmd_get_settings(store: tauri::State<'_, SharedStore>) -> AppSettings {
    store.get_settings()
}

#[tauri::command]
fn cmd_save_settings(
    app: AppHandle,
    store: tauri::State<'_, SharedStore>,
    settings: serde_json::Value,
) -> AppSettings {
    let updated = store.save_settings(settings);
    app.emit("settings:changed", &updated).ok();
    updated
}

#[tauri::command]
fn cmd_scan_folder(
    workspace: tauri::State<'_, SharedWorkspaceManager>,
    dir_path: String,
    scan_mode: Option<String>,
) -> Vec<ScannedMdFile> {
    let mode = scan_mode.unwrap_or_else(|| "full-tree".to_string());
    workspace.scan_directory(&dir_path, &mode)
}

#[tauri::command]
fn cmd_set_supervision(
    workspace: tauri::State<'_, SharedWorkspaceManager>,
    config: FolderSupervisionConfig,
) -> bool {
    workspace.set_supervision(config)
}

#[tauri::command]
fn cmd_get_supervision(store: tauri::State<'_, SharedStore>) -> Option<FolderSupervisionConfig> {
    store.get_supervision_config()
}

fn open_file_in_preview_helper(app: &AppHandle, path_str: &str) {
    let app_handle = app.clone();
    let p_str = path_str.to_string();
    tauri::async_runtime::spawn(async move {
        let store = app_handle.state::<SharedStore>();
        let workspace = app_handle.state::<SharedWorkspaceManager>();
        cmd_open_in_preview(app_handle.clone(), store, workspace, p_str)
            .await
            .ok();
    });
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            for arg in &argv[1..] {
                if !arg.starts_with('-') && (arg.ends_with(".md") || arg.ends_with(".markdown") || arg.ends_with(".txt")) {
                    if Path::new(arg).exists() {
                        open_file_in_preview_helper(app, arg);
                        return;
                    }
                }
            }
            if let Some(win) = app.get_webview_window("float") {
                win.show().ok();
                win.set_focus().ok();
            }
        }))
        .setup(|app| {
            let config_dir = app
                .path()
                .app_config_dir()
                .unwrap_or_else(|_| Path::new(".").to_path_buf());
            let store = AppStore::new(config_dir);
            let workspace = WorkspaceManager::new(app.handle().clone(), Arc::clone(&store));
            let llm = Arc::new(LlmManager::new());
            let agents_orch = AgentOrchestrator::new(app.handle().clone(), Arc::clone(&store));

            if let Some(sup) = store.get_supervision_config() {
                if sup.enabled {
                    workspace.set_supervision(sup);
                }
            }

            app.manage(Arc::clone(&store));
            app.manage(Arc::clone(&workspace));
            app.manage(Arc::clone(&llm));
            app.manage(Arc::clone(&agents_orch));

            let show_float = MenuItem::with_id(app, "show_float", "Show Float Hub", true, None::<&str>)?;
            let new_editor = MenuItem::with_id(app, "new_editor", "New Markdown Editor", true, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit FlyMD", true, None::<&str>)?;

            let tray_menu = Menu::with_items(app, &[
                &show_float,
                &new_editor,
                &sep1,
                &quit_item,
            ])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&tray_menu)
                .tooltip("FlyMD - On-the-fly Markdown");

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let app_handle_for_tray = app.handle().clone();
            tray_builder
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show_float" => {
                        let store = app.state::<SharedStore>();
                        get_or_create_float_window(app, &store).ok();
                    }
                    "new_editor" => {
                        open_file_in_preview_helper(app, "");
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(move |_tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let store = app_handle_for_tray.state::<SharedStore>();
                        get_or_create_float_window(&app_handle_for_tray, &store).ok();
                    }
                })
                .build(app)?;

            get_or_create_float_window(app.handle(), &store)?;

            let args: Vec<String> = std::env::args().collect();
            for arg in &args[1..] {
                if !arg.starts_with('-') && (arg.ends_with(".md") || arg.ends_with(".markdown") || arg.ends_with(".txt")) {
                    if Path::new(arg).exists() {
                        open_file_in_preview_helper(app.handle(), arg);
                        break;
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd_open_file_dialog,
            cmd_open_folder_dialog,
            cmd_read_file,
            cmd_save_file,
            cmd_save_file_dialog,
            cmd_export_pdf,
            cmd_get_history,
            cmd_add_history,
            cmd_remove_history,
            cmd_clear_history,
            cmd_get_settings,
            cmd_save_settings,
            cmd_scan_folder,
            cmd_set_supervision,
            cmd_get_supervision,
            cmd_toggle_float_pin,
            cmd_get_float_pin,
            cmd_toggle_preview_pin,
            cmd_get_preview_pin,
            cmd_minimize_window,
            cmd_maximize_window,
            cmd_close_window,
            cmd_move_float_window,
            cmd_get_float_position,
            cmd_set_float_position,
            cmd_save_float_position,
            cmd_hide_float_window,
            cmd_set_float_expanded,
            cmd_open_in_preview,
            cmd_llm_test_connection,
            cmd_llm_get_models,
            cmd_llm_start_translation,
            cmd_llm_abort_translation,
            cmd_discover_agents,
            cmd_save_agent_credential,
            cmd_get_agent_credentials,
            cmd_launch_agent_login,
            cmd_launch_agent_web_auth,
            cmd_dispatch_agent_task,
            cmd_get_agent_tasks,
            cmd_cancel_agent_task,
            cmd_clear_agent_tasks,
            cmd_get_agent_checkpoints,
            cmd_restore_agent_checkpoint,
            cmd_remove_agent_profile,
            cmd_complete_web_task_with_reply,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

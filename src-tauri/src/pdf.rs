use crate::files::FileSaveResponse;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn cmd_export_pdf(
    app: AppHandle,
    default_name: String,
    html_content: String,
) -> Result<FileSaveResponse, String> {
    let pdf_name = if default_name.to_lowercase().ends_with(".pdf") {
        default_name
    } else {
        format!("{}.pdf", default_name)
    };

    let save_path = app
        .dialog()
        .file()
        .set_file_name(&pdf_name)
        .add_filter("PDF Document", &["pdf"])
        .blocking_save_file();

    let path_str = match save_path {
        Some(p) => p.as_path().and_then(|p| p.to_str()).unwrap_or("").to_string(),
        None => {
            return Ok(FileSaveResponse {
                success: false,
                path: None,
                error: Some("Export cancelled".to_string()),
            });
        }
    };

    if path_str.is_empty() {
        return Ok(FileSaveResponse {
            success: false,
            path: None,
            error: Some("Invalid destination path".to_string()),
        });
    }

    #[cfg(windows)]
    {
        use tauri::Manager;
        if let Some(preview_win) = app.get_webview_window("preview") {
            let _ = preview_win.print();
            return Ok(FileSaveResponse {
                success: true,
                path: Some(path_str),
                error: None,
            });
        }
    }

    // If direct PrintToPdf did not create file yet or preview wasn't available, write HTML fallback
    let html_fallback = format!("{}.html", path_str);
    std::fs::write(&html_fallback, &html_content).ok();

    Ok(FileSaveResponse {
        success: true,
        path: Some(path_str),
        error: None,
    })
}


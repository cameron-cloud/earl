use tauri::Manager;

use crate::config::{self, EarlConfig};

#[tauri::command]
pub fn set_ignore_cursor_events(
    window: tauri::WebviewWindow,
    ignore: bool,
) -> Result<(), String> {
    window
        .set_ignore_cursor_events(ignore)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_config(app: tauri::AppHandle) -> Result<EarlConfig, String> {
    config::load_config(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_config(app: tauri::AppHandle, config: EarlConfig) -> Result<(), String> {
    config::write_config(&app, &config).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_screen_info(window: tauri::WebviewWindow) -> Result<ScreenInfo, String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("No monitor found")?;

    let size = monitor.size();
    let scale = monitor.scale_factor();

    Ok(ScreenInfo {
        width: (size.width as f64 / scale) as u32,
        height: (size.height as f64 / scale) as u32,
        scale_factor: scale,
    })
}

#[derive(serde::Serialize)]
pub struct ScreenInfo {
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

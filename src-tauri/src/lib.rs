mod commands;
mod config;
mod tray;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            // Initialize config on first launch
            let app_handle = app.handle().clone();
            config::init_config(&app_handle)?;

            // Set up system tray
            tray::create_tray(&app_handle)?;

            // Position main window at bottom of screen
            if let Some(window) = app.get_webview_window("main") {
                if let Some(monitor) = window.current_monitor().ok().flatten() {
                    let screen_size = monitor.size();
                    let screen_pos = monitor.position();
                    let scale = monitor.scale_factor();
                    let logical_height = screen_size.height as f64 / scale;
                    let logical_width = screen_size.width as f64 / scale;

                    // Position at bottom of screen, above taskbar (~48px)
                    let y = logical_height - 200.0 - 48.0;
                    window
                        .set_position(tauri::Position::Logical(tauri::LogicalPosition {
                            x: screen_pos.x as f64,
                            y,
                        }))
                        .ok();
                    window
                        .set_size(tauri::Size::Logical(tauri::LogicalSize {
                            width: logical_width,
                            height: 200.0,
                        }))
                        .ok();
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::set_ignore_cursor_events,
            commands::get_config,
            commands::save_config,
            commands::get_screen_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Earl");
}

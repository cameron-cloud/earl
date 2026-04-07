mod commands;
mod config;
mod tray;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let app_handle = app.handle().clone();
            config::init_config(&app_handle)?;
            tray::create_tray(&app_handle)?;

            if let Some(window) = app.get_webview_window("main") {
                // Ensure hidden until frontend signals ready
                window.hide().ok();

                // Transparent WebView2 background
                window
                    .set_background_color(Some(tauri::window::Color(0, 0, 0, 0)))
                    .ok();

                if let Some(monitor) = window.current_monitor().ok().flatten() {
                    let screen_size = monitor.size();
                    let screen_pos = monitor.position();
                    let scale = monitor.scale_factor();
                    let logical_height = screen_size.height as f64 / scale;
                    let logical_width = screen_size.width as f64 / scale;

                    // 200px strip at bottom, overlapping taskbar with 4px offset
                    let y = logical_height - 200.0 - 4.0;

                    // Enable click-through by default; frontend toggles off on hover
                    window.set_ignore_cursor_events(true).ok();
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
            commands::show_window,
            commands::set_ignore_cursor_events,
            commands::get_config,
            commands::save_config,
            commands::get_screen_info,
            commands::get_taskbar_state,
            commands::expand_window,
            commands::shrink_window,
            commands::update_hit_test,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Earl");
}

mod commands;
mod config;
mod tray;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // D30: single-instance is registered first, so a second launch hands
        // over to the running instance before any other plugin starts. The
        // running instance shows Earl and opens Settings, queued onto the
        // event loop (see queue_second_launch).
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            queue_second_launch(app.clone());
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(commands::FrontendReady::default())
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

/// Queues the D30 second-launch handling (show Earl, open Settings) onto the
/// event loop instead of running it inside the single-instance callback.
///
/// On Windows the plugin calls its callback from the window procedure of its
/// hidden message window, on the main thread, while the second process waits
/// in SendMessageW. `run_on_main_thread` called from the main thread runs the
/// closure inline (tauri-runtime-wry `send_user_message`), so calling it there
/// would build Settings inside that window procedure. Called from another
/// thread it posts the task through the event loop proxy, the same queue that
/// tray menu and tray icon events go through. The callback returns at once,
/// the second process can exit, and Settings is built on a later turn of the
/// event loop.
fn queue_second_launch(app: tauri::AppHandle) {
    let spawned = std::thread::Builder::new()
        .name("earl-second-launch".into())
        .spawn(move || {
            let handle = app.clone();
            if let Err(err) = app.run_on_main_thread(move || tray::on_second_launch(&handle)) {
                eprintln!("second launch: could not queue on the event loop: {err}");
            }
        });
    if let Err(err) = spawned {
        eprintln!("second launch: could not start the queueing thread: {err}");
    }
}

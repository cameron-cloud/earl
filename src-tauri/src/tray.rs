use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    webview::WebviewWindowBuilder,
    Manager,
};

pub fn create_tray(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Load current config for initial sound state
    let config = crate::config::load_config(app).unwrap_or_default();
    let sound_label = if config.sound.enabled {
        "Sound: ON"
    } else {
        "Sound: OFF"
    };

    let show_hide = MenuItem::with_id(app, "show_hide", "Hide Earl", true, None::<&str>)?;
    let sound_toggle =
        MenuItem::with_id(app, "sound_toggle", sound_label, true, None::<&str>)?;
    let separator1 = PredefinedMenuItem::separator(app)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings...", true, None::<&str>)?;
    let about_item = MenuItem::with_id(app, "about", "About Earl", true, None::<&str>)?;
    let reset_pos_item = MenuItem::with_id(app, "reset_position", "Reset Position", true, None::<&str>)?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let restart_item = MenuItem::with_id(app, "restart", "Restart Earl", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show_hide,
            &sound_toggle,
            &separator1,
            &settings_item,
            &about_item,
            &reset_pos_item,
            &separator2,
            &restart_item,
            &quit_item,
        ],
    )?;

    let tray_icon = Image::from_bytes(include_bytes!("../../assets/icons/tray_icon_32.png"))?;

    // Clone menu items so we can update their text from within the closure
    let show_hide_ref = show_hide.clone();
    let sound_toggle_ref = sound_toggle.clone();

    let _tray = TrayIconBuilder::new()
        .icon(tray_icon)
        .menu(&menu)
        .tooltip("Earl — Desktop Duckling")
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "show_hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let visible = window.is_visible().unwrap_or(false);
                    if visible {
                        window.hide().ok();
                        show_hide_ref.set_text("Show Earl").ok();
                    } else {
                        window.show().ok();
                        show_hide_ref.set_text("Hide Earl").ok();
                    }
                }
            }
            "sound_toggle" => {
                // Toggle sound in config and update menu label
                if let Ok(mut config) = crate::config::load_config(app) {
                    config.sound.enabled = !config.sound.enabled;
                    crate::config::write_config(app, &config).ok();
                    let label = if config.sound.enabled {
                        "Sound: ON"
                    } else {
                        "Sound: OFF"
                    };
                    sound_toggle_ref.set_text(label).ok();
                    // Notify frontend
                    if let Some(window) = app.get_webview_window("main") {
                        use tauri::Emitter;
                        window.emit("config-changed", &config).ok();
                    }
                }
            }
            "reset_position" => {
                if let Some(window) = app.get_webview_window("main") {
                    use tauri::Emitter;
                    window.emit("reset-position", ()).ok();
                }
            }
            "settings" => {
                open_panel_window(app, "settings", "Earl Settings", 320, 420);
            }
            "about" => {
                open_panel_window(app, "about", "About Earl", 300, 380);
            }
            "restart" => {
                app.restart();
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

fn open_panel_window(app: &tauri::AppHandle, label: &str, title: &str, width: u32, height: u32) {
    // If window already exists, just focus it
    if let Some(window) = app.get_webview_window(label) {
        window.show().ok();
        window.set_focus().ok();
        return;
    }

    // Use App URL — Tauri proxies to Vite in dev, serves dist in prod.
    // This ensures the IPC bridge is injected. Routing is by window label.
    let builder = WebviewWindowBuilder::new(
        app,
        label,
        tauri::WebviewUrl::App("index.html".into()),
    )
        .title(title)
        .inner_size(width as f64, height as f64)
        .resizable(false)
        .always_on_top(true)
        .decorations(true)
        .transparent(false)
        .center();

    if let Ok(window) = builder.build() {
        window.set_focus().ok();
    }
}

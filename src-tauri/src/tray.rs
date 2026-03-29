use tauri::{
    image::Image,
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    webview::WebviewWindowBuilder,
    Manager,
};

pub fn create_tray(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = CheckMenuItem::with_id(app, "show", "Show Earl", true, true, None::<&str>)?;
    let sound_item = CheckMenuItem::with_id(app, "sound", "Sound", true, false, None::<&str>)?;
    let separator1 = PredefinedMenuItem::separator(app)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings...", true, None::<&str>)?;
    let about_item = MenuItem::with_id(app, "about", "About Earl", true, None::<&str>)?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show_item,
            &sound_item,
            &separator1,
            &settings_item,
            &about_item,
            &separator2,
            &quit_item,
        ],
    )?;

    let tray_icon = Image::from_bytes(include_bytes!("../../assets/icons/tray_icon_32.png"))?;

    let _tray = TrayIconBuilder::new()
        .icon(tray_icon)
        .menu(&menu)
        .tooltip("Earl — Desktop Duckling")
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        window.hide().ok();
                    } else {
                        window.show().ok();
                    }
                }
            }
            "sound" => {
                if let Some(window) = app.get_webview_window("main") {
                    window.emit("toggle-sound", ()).ok();
                }
            }
            "settings" => {
                open_panel_window(app, "settings", "Earl Settings", 320, 420);
            }
            "about" => {
                open_panel_window(app, "about", "About Earl", 300, 380);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click { .. } = event {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        window.hide().ok();
                    } else {
                        window.show().ok();
                        window.set_focus().ok();
                    }
                }
            }
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

    let url = format!("index.html?view={}", label);
    let builder = WebviewWindowBuilder::new(app, label, tauri::WebviewUrl::App(url.into()))
        .title(title)
        .inner_size(width as f64, height as f64)
        .resizable(false)
        .center();

    if let Ok(window) = builder.build() {
        window.set_focus().ok();
    }
}

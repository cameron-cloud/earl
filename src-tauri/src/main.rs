//! Earl v2 M0.4 Windows platform spike. THROWAWAY, never merged.
//!
//! One full-monitor transparent overlay (plan 4.1) with a walking 96 px Earl,
//! rendered either as a small translate3d layer canvas or as a full-monitor
//! dirty-rect canvas, so Cameron can measure W0 and settle D13 and D14.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod spike;
#[cfg(windows)]
mod win;

use serde::{Deserialize, Serialize};
use spike::{Flags, RegionIn, RenderMode, Shared, Stats, StatsSnapshot, BROWSER_ARGS, STATS};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

const OVERLAY: &str = "overlay";
const KEYLOG: &str = "keylog";

struct AppState {
    shared: Arc<Shared>,
    flags: Flags,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InitInfo {
    inner_width: f64,
    inner_height: f64,
    device_pixel_ratio: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InitReply {
    mode: RenderMode,
    still: bool,
    hud: bool,
    ground_y: f64,
    taskbar_edge: &'static str,
    /// Physical px per CSS px, derived as physWidth / innerWidth (plan 4.2).
    scale: f64,
    /// GetDpiForWindow / 96, for comparison (0 when unknown).
    dpi_scale: f64,
    overlay_phys: (i32, i32, i32, i32),
    platform: &'static str,
}

#[tauri::command]
fn platform_init(state: State<'_, AppState>, window: tauri::WebviewWindow, info: InitInfo) -> InitReply {
    let shared = &state.shared;
    let (_, _, pw, _) = shared.overlay.lock().map(|g| *g).unwrap_or((0, 0, 0, 0));
    let scale = if pw > 0 && info.inner_width > 0.0 {
        pw as f64 / info.inner_width
    } else {
        info.device_pixel_ratio
    };
    shared.set_scale(scale);
    shared.set_regions(Vec::new());

    #[cfg(windows)]
    let (ground_y, taskbar_edge, dpi_scale) = {
        let (g, tb) = win::ground_now(shared);
        // Overlay rect not recorded yet (height 0): fall back to the WebView's own height.
        let g = if g > 0.0 { g } else { info.inner_height };
        let dpi = window
            .hwnd()
            .map(|h| f64::from(unsafe { windows::Win32::UI::HiDpi::GetDpiForWindow(h) }) / 96.0)
            .unwrap_or(0.0);
        (g, tb.map_or("none", |t| spike::edge_name(t.edge)), dpi)
    };
    #[cfg(not(windows))]
    let (ground_y, taskbar_edge, dpi_scale) = {
        let _ = &window;
        (info.inner_height, "none", 0.0)
    };

    InitReply {
        mode: shared.mode(),
        still: state.flags.still,
        hud: !state.flags.no_hud,
        ground_y,
        taskbar_edge,
        scale,
        dpi_scale,
        overlay_phys: shared.overlay.lock().map(|g| *g).unwrap_or((0, 0, 0, 0)),
        platform: std::env::consts::OS,
    }
}

/// Hit regions in overlay-local CSS px (the spike sends Earl's opaque bbox).
#[tauri::command]
fn hit_set_regions(state: State<'_, AppState>, regions: Vec<RegionIn>) {
    let shared = &state.shared;
    shared.set_regions(spike::regions_from_css(&regions, shared.scale()));
    Stats::bump(&STATS.region_pushes);
    #[cfg(windows)]
    win::wake(shared);
}

/// Extends (true) or ends (false) the pointer thread's capture latch.
#[tauri::command]
fn hit_capture(state: State<'_, AppState>, on: bool) {
    if let Ok(mut latch) = state.shared.latch.lock() {
        latch.set_js_capture(on);
    }
    #[cfg(windows)]
    win::wake(&state.shared);
}

#[tauri::command]
fn spike_stats() -> StatsSnapshot {
    STATS.snapshot()
}

fn open_keylog(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(KEYLOG) {
        let _ = w.unminimize();
        let _ = w.set_focus();
        return;
    }
    // A normal, activatable window: the focus test types here.
    let _ = WebviewWindowBuilder::new(app, KEYLOG, WebviewUrl::App("keylog.html".into()))
        .title("Earl spike - focus test")
        .inner_size(620.0, 700.0)
        .additional_browser_args(BROWSER_ARGS)
        .build();
}

fn set_mode(app: &AppHandle, mode: RenderMode) {
    let state = app.state::<AppState>();
    state.shared.mode.store(mode.as_u8(), Ordering::Relaxed);
    state.shared.set_regions(Vec::new());
    let _ = app.emit_to(OVERLAY, "spike://reload", ());
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let layers = MenuItem::with_id(app, "mode-layers", "Renderer: layers (small canvas, translate3d)", true, None::<&str>)?;
    let canvas = MenuItem::with_id(app, "mode-canvas", "Renderer: canvas (full-monitor, dirty rects)", true, None::<&str>)?;
    let walk = MenuItem::with_id(app, "toggle-walk", "Walk / stand still", true, None::<&str>)?;
    let hud = MenuItem::with_id(app, "toggle-hud", "Show / hide stats panel", true, None::<&str>)?;
    let vis = MenuItem::with_id(app, "toggle-visible", "Hide / show Earl (window hidden)", true, None::<&str>)?;
    let keylog = MenuItem::with_id(app, "keylog", "Open focus test page", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Earl spike", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&layers, &canvas, &sep1, &walk, &hud, &vis, &keylog, &sep2, &quit])?;

    let mut builder = TrayIconBuilder::with_id("earl-spike")
        .tooltip("Earl spike (M0.4)")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "mode-layers" => set_mode(app, RenderMode::Layers),
            "mode-canvas" => set_mode(app, RenderMode::Canvas),
            "toggle-walk" => {
                let _ = app.emit_to(OVERLAY, "spike://toggle", "walk");
            }
            "toggle-hud" => {
                let _ = app.emit_to(OVERLAY, "spike://toggle", "hud");
            }
            "toggle-visible" => {
                let shared = &app.state::<AppState>().shared;
                let on = !shared.visible.load(Ordering::Relaxed);
                shared.visible.store(on, Ordering::Relaxed);
                #[cfg(windows)]
                win::post_show(on);
                let _ = app.emit_to(OVERLAY, "spike://visible", on);
            }
            "keylog" => {
                // Create windows off the event-loop thread (avoids a Windows deadlock).
                let app = app.clone();
                std::thread::spawn(move || open_keylog(&app));
            }
            "quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

fn main() {
    #[cfg(windows)]
    win::disable_ghosting();

    let flags = spike::parse_flags(std::env::args().skip(1));
    let shared = Arc::new(Shared::new(flags.mode));

    tauri::Builder::default()
        .manage(AppState { shared: Arc::clone(&shared), flags })
        .invoke_handler(tauri::generate_handler![platform_init, hit_set_regions, hit_capture, spike_stats])
        .setup(move |app| {
            let handle = app.handle().clone();
            // Plan 4.1 window config, built in Rust so the one BROWSER_ARGS constant applies.
            let overlay = WebviewWindowBuilder::new(app, OVERLAY, WebviewUrl::App("index.html".into()))
                .title("Earl spike overlay")
                .visible(false)
                .transparent(true)
                .decorations(false)
                .shadow(false)
                .resizable(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .focused(false)
                .disable_drag_drop_handler()
                .additional_browser_args(BROWSER_ARGS)
                .inner_size(800.0, 600.0)
                .build()?;

            #[cfg(windows)]
            {
                let hwnd = overlay.hwnd()?;
                win::setup_overlay(hwnd, flags.layered_alpha, &shared);
                win::spawn_pointer_thread(Arc::clone(&shared), handle.clone());
            }
            #[cfg(not(windows))]
            {
                // Dev convenience only; the spike is measured on Windows.
                overlay.show()?;
            }

            build_tray(&handle)?;
            if flags.keylog {
                let app = handle.clone();
                std::thread::spawn(move || open_keylog(&app));
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the Earl spike");
}

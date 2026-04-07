use crate::config::{self, EarlConfig};

#[cfg(windows)]
#[repr(C)]
struct POINT {
    x: i32,
    y: i32,
}

#[cfg(windows)]
#[repr(C)]
struct RECT {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[cfg(windows)]
extern "system" {
    fn GetCursorPos(lp_point: *mut POINT) -> i32;
    fn FindWindowW(class_name: *const u16, window_name: *const u16) -> isize;
    fn GetWindowRect(hwnd: isize, rect: *mut RECT) -> i32;
}

#[tauri::command]
pub fn show_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())
}

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

/// Expand window to full screen for drag mode. Returns the Y offset
/// (how far the window top moved up) so frontend can adjust Earl's position.
#[tauri::command]
pub fn expand_window(window: tauri::WebviewWindow) -> Result<f64, String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("No monitor found")?;

    let size = monitor.size();
    let pos = monitor.position();
    let scale = monitor.scale_factor();
    let logical_height = size.height as f64 / scale;
    let logical_width = size.width as f64 / scale;

    // Current window position
    let win_pos = window.outer_position().map_err(|e| e.to_string())?;
    let win_y = win_pos.y as f64 / scale;

    // Expand to full screen
    window
        .set_position(tauri::Position::Logical(tauri::LogicalPosition {
            x: pos.x as f64,
            y: pos.y as f64,
        }))
        .map_err(|e| e.to_string())?;
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: logical_width,
            height: logical_height,
        }))
        .map_err(|e| e.to_string())?;

    // Return how far down the old window top was from screen top
    Ok(win_y - pos.y as f64)
}

/// Shrink window back to 200px strip at bottom.
/// If taskbar_visible is true, positions with 4px offset; if false, flush to bottom.
#[tauri::command]
pub fn shrink_window(window: tauri::WebviewWindow, taskbar_visible: bool) -> Result<(), String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("No monitor found")?;

    let size = monitor.size();
    let pos = monitor.position();
    let scale = monitor.scale_factor();
    let logical_height = size.height as f64 / scale;
    let logical_width = size.width as f64 / scale;

    // 4px offset when taskbar visible (window overlaps taskbar slightly),
    // 0px when taskbar hidden (window flush to screen bottom)
    let offset = if taskbar_visible { 4.0 } else { 0.0 };
    let y = logical_height - 200.0 - offset;
    window
        .set_position(tauri::Position::Logical(tauri::LogicalPosition {
            x: pos.x as f64,
            y,
        }))
        .map_err(|e| e.to_string())?;
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: logical_width,
            height: 200.0,
        }))
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Check if the Windows taskbar is currently visible on screen.
/// Uses FindWindowW to find Shell_TrayWnd and checks if its top edge
/// is within the screen bounds (when hidden/auto-hidden, it slides off-screen).
#[tauri::command]
pub fn get_taskbar_state(window: tauri::WebviewWindow) -> Result<TaskbarState, String> {
    #[cfg(windows)]
    {
        let monitor = window
            .current_monitor()
            .map_err(|e| e.to_string())?
            .ok_or("No monitor found")?;
        let size = monitor.size();
        let physical_screen_height = size.height as i32;

        // Find the taskbar window
        let class: Vec<u16> = "Shell_TrayWnd\0".encode_utf16().collect();
        let hwnd = unsafe { FindWindowW(class.as_ptr(), std::ptr::null()) };
        if hwnd == 0 {
            return Ok(TaskbarState { visible: true }); // assume visible if can't find
        }

        let mut rect = RECT { left: 0, top: 0, right: 0, bottom: 0 };
        let ok = unsafe { GetWindowRect(hwnd, &mut rect) };
        if ok == 0 {
            return Ok(TaskbarState { visible: true });
        }

        // Taskbar is visible if its top edge is within the screen
        // (when hidden, top >= screen height or very close to it)
        let visible = rect.top < physical_screen_height - 2;

        Ok(TaskbarState { visible })
    }

    #[cfg(not(windows))]
    {
        let _ = window;
        Ok(TaskbarState { visible: true })
    }
}

#[derive(serde::Serialize)]
pub struct TaskbarState {
    pub visible: bool,
}

/// Poll cursor position and toggle click-through based on whether cursor is over Earl.
/// Called from frontend every ~50ms. Returns true if cursor is over Earl.
#[tauri::command]
pub fn update_hit_test(
    window: tauri::WebviewWindow,
    earl_x: f64,
    earl_y: f64,
    earl_size: f64,
) -> Result<bool, String> {
    #[cfg(windows)]
    {
        let mut cursor = POINT { x: 0, y: 0 };
        let ok = unsafe { GetCursorPos(&mut cursor) };
        if ok == 0 {
            return Err("GetCursorPos failed".into());
        }

        // Get window position in physical pixels
        let win_pos = window.outer_position().map_err(|e| e.to_string())?;
        let scale = window
            .scale_factor()
            .map_err(|e| e.to_string())?;

        // Convert cursor to logical coordinates relative to window
        let cx = (cursor.x - win_pos.x) as f64 / scale;
        let cy = (cursor.y - win_pos.y) as f64 / scale;

        let over_earl = cx >= earl_x
            && cx <= earl_x + earl_size
            && cy >= earl_y
            && cy <= earl_y + earl_size;

        window
            .set_ignore_cursor_events(!over_earl)
            .map_err(|e| e.to_string())?;

        Ok(over_earl)
    }

    #[cfg(not(windows))]
    {
        let _ = (window, earl_x, earl_y, earl_size);
        Ok(false)
    }
}

//! Win32 glue for the M0.4 spike (plan 4.1 and 4.3). Windows only; built in CI.
//!
//! - The overlay subclass: permanent WS_EX_LAYERED | TOOLWINDOW | NOACTIVATE,
//!   WM_APP_SETHIT toggling only WS_EX_TRANSPARENT, MA_NOACTIVATE, the
//!   WM_ACTIVATE hand-back, a forced window rect and WM_APP_SHOW.
//! - The pointer thread: high-resolution waitable timer, transitions-only
//!   click-through, the capture latch, SM_SWAPBUTTON, hover events.
//! - Ground from ABM_GETTASKBARPOS.
//!
//! After init nothing here calls tao/Tauri style APIs on the overlay
//! (set_ignore_cursor_events, show, hide, set_always_on_top): tao would rewrite
//! the whole ex-style, drop WS_EX_LAYERED and call ShowWindow (plan 4.1).

use crate::spike::{self, PointerInput, Shared, Stats, TaskbarInfo, STATS};
use serde::Serialize;
use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, AtomicI32, AtomicIsize, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use windows::core::PCWSTR;
use windows::Win32::Foundation::{COLORREF, HANDLE, HWND, LPARAM, LRESULT, POINT, WPARAM};
use windows::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTOPRIMARY};
use windows::Win32::System::Threading::{
    CreateEventW, CreateWaitableTimerExW, GetCurrentProcess, SetEvent, SetWaitableTimer, TerminateProcess,
    WaitForMultipleObjects, CREATE_WAITABLE_TIMER_HIGH_RESOLUTION, INFINITE, TIMER_ALL_ACCESS,
};
use windows::Win32::UI::HiDpi::GetDpiForWindow;
use windows::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON, VK_RBUTTON};
use windows::Win32::UI::Shell::{
    DefSubclassProc, SHAppBarMessage, SetWindowSubclass, ABM_GETSTATE, ABM_GETTASKBARPOS, ABS_AUTOHIDE, APPBARDATA,
};
use windows::Win32::UI::WindowsAndMessaging::{
    DisableProcessWindowsGhosting, GetCursorPos, GetForegroundWindow, GetSystemMetrics, GetWindowLongPtrW, IsWindow,
    PostMessageW, SendMessageTimeoutW, SetForegroundWindow, SetLayeredWindowAttributes, SetWindowLongPtrW,
    SetWindowPos, ShowWindow, GWL_EXSTYLE, LWA_ALPHA, MA_NOACTIVATE, SMTO_ABORTIFHUNG, SM_SWAPBUTTON, STYLESTRUCT,
    SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOOWNERZORDER, SWP_NOSIZE, SWP_NOZORDER, SW_HIDE, SW_SHOWNOACTIVATE, WA_ACTIVE,
    WA_CLICKACTIVE, WINDOWPOS, WM_ACTIVATE, WM_APP, WM_MOUSEACTIVATE, WM_NULL, WM_STYLECHANGING,
    WM_WINDOWPOSCHANGING,
};

/// Posted by the pointer thread: wParam 1 = take input, 0 = click-through.
pub const WM_APP_SETHIT: u32 = WM_APP + 1;
/// wParam 1 = ShowWindow(SW_SHOWNOACTIVATE), 0 = SW_HIDE.
pub const WM_APP_SHOW: u32 = WM_APP + 2;

const SUBCLASS_ID: usize = 0x0EA7_0004;

static OVERLAY_HWND: AtomicIsize = AtomicIsize::new(0);
/// The last foreground window that was not the overlay (pointer thread), the
/// fallback hand-back target when WM_ACTIVATE carries no previous window.
static LAST_OTHER_FG: AtomicIsize = AtomicIsize::new(0);
static HITTABLE: AtomicBool = AtomicBool::new(false);
static DESIRED_SET: AtomicBool = AtomicBool::new(false);
static DESIRED_X: AtomicI32 = AtomicI32::new(0);
static DESIRED_Y: AtomicI32 = AtomicI32::new(0);
static DESIRED_W: AtomicI32 = AtomicI32::new(0);
static DESIRED_H: AtomicI32 = AtomicI32::new(0);

fn overlay_hwnd() -> Option<HWND> {
    let raw = OVERLAY_HWND.load(Ordering::Acquire);
    (raw != 0).then(|| HWND(raw as *mut c_void))
}

/// Must run first in main(): Windows then never swaps a hung monitor-sized
/// overlay for a desktop-blocking "Not Responding" ghost (plan 4.1).
pub fn disable_ghosting() {
    unsafe { DisableProcessWindowsGhosting() };
}

unsafe extern "system" fn overlay_subclass(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _id: usize,
    _data: usize,
) -> LRESULT {
    match msg {
        WM_STYLECHANGING if wparam.0 as i32 == GWL_EXSTYLE.0 => {
            // Let tao see it first, then make the result ours whoever wrote it.
            let r = DefSubclassProc(hwnd, msg, wparam, lparam);
            let ss = lparam.0 as *mut STYLESTRUCT;
            if !ss.is_null() {
                let want = spike::overlay_ex_style((*ss).styleNew, HITTABLE.load(Ordering::Acquire));
                if want != (*ss).styleNew {
                    (*ss).styleNew = want;
                    Stats::bump(&STATS.style_rewrites);
                }
            }
            r
        }
        WM_APP_SETHIT => {
            let on = wparam.0 != 0;
            HITTABLE.store(on, Ordering::Release);
            let cur = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
            let want = spike::overlay_ex_style(cur, on);
            if want != cur {
                // Only WS_EX_TRANSPARENT changes: no SWP_FRAMECHANGED, no ShowWindow.
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, want as isize);
            }
            LRESULT(0)
        }
        WM_APP_SHOW => {
            let cmd = if wparam.0 != 0 { SW_SHOWNOACTIVATE } else { SW_HIDE };
            let _ = ShowWindow(hwnd, cmd);
            LRESULT(0)
        }
        WM_MOUSEACTIVATE => LRESULT(MA_NOACTIVATE as isize),
        WM_ACTIVATE => {
            let state = (wparam.0 & 0xFFFF) as u32;
            if state == WA_ACTIVE || state == WA_CLICKACTIVE {
                // WebView2's cross-process child HWNDs can SetFocus on their own.
                // We are foreground at this instant, so handing foreground back
                // to the window being deactivated is allowed.
                Stats::bump(&STATS.activations);
                // lParam may be NULL (MSDN): fall back to the last other foreground window.
                let mut prev = HWND(lparam.0 as *mut c_void);
                if prev.is_invalid() || prev == hwnd {
                    prev = HWND(LAST_OTHER_FG.load(Ordering::Acquire) as *mut c_void);
                }
                if !prev.is_invalid() && prev != hwnd && IsWindow(Some(prev)).as_bool() {
                    let _ = SetForegroundWindow(prev);
                }
                return LRESULT(0);
            }
            DefSubclassProc(hwnd, msg, wparam, lparam)
        }
        WM_WINDOWPOSCHANGING => {
            let r = DefSubclassProc(hwnd, msg, wparam, lparam);
            let wp = lparam.0 as *mut WINDOWPOS;
            if !wp.is_null() && DESIRED_SET.load(Ordering::Acquire) {
                if ((*wp).flags & SWP_NOMOVE).0 == 0 {
                    (*wp).x = DESIRED_X.load(Ordering::Relaxed);
                    (*wp).y = DESIRED_Y.load(Ordering::Relaxed);
                }
                if ((*wp).flags & SWP_NOSIZE).0 == 0 {
                    (*wp).cx = DESIRED_W.load(Ordering::Relaxed);
                    (*wp).cy = DESIRED_H.load(Ordering::Relaxed);
                }
            }
            r
        }
        _ => DefSubclassProc(hwnd, msg, wparam, lparam),
    }
}

/// Plan 4.1 "Setup before show()". `hwnd` is the overlay, still hidden.
/// Returns the overlay rect (x, y, w, h) in screen physical px and its DPI.
pub fn setup_overlay(hwnd: HWND, layered_alpha: bool, shared: &Shared) -> ((i32, i32, i32, i32), u32) {
    unsafe {
        let mon = MonitorFromPoint(POINT { x: 0, y: 0 }, MONITOR_DEFAULTTOPRIMARY);
        let mut mi = MONITORINFO { cbSize: std::mem::size_of::<MONITORINFO>() as u32, ..Default::default() };
        let _ = GetMonitorInfoW(mon, &mut mi);
        let rc = mi.rcMonitor;
        // D13: the top edge sits 1 physical px below rcMonitor.top, the bottom is exact.
        let rect = (rc.left, rc.top + 1, rc.right - rc.left, rc.bottom - rc.top - 1);

        DESIRED_X.store(rect.0, Ordering::Relaxed);
        DESIRED_Y.store(rect.1, Ordering::Relaxed);
        DESIRED_W.store(rect.2, Ordering::Relaxed);
        DESIRED_H.store(rect.3, Ordering::Relaxed);
        DESIRED_SET.store(true, Ordering::Release);
        OVERLAY_HWND.store(hwnd.0 as isize, Ordering::Release);
        if let Ok(mut g) = shared.overlay.lock() {
            *g = rect;
        }

        let _ = SetWindowSubclass(hwnd, Some(overlay_subclass), SUBCLASS_ID, 0);
        let _ = SetWindowPos(
            hwnd,
            None,
            rect.0,
            rect.1,
            rect.2,
            rect.3,
            SWP_NOACTIVATE | SWP_NOZORDER | SWP_NOOWNERZORDER,
        );

        // The permanent ex-style, set once. Click-through to start with.
        let cur = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, spike::overlay_ex_style(cur, false) as isize);
        if layered_alpha {
            let _ = SetLayeredWindowAttributes(hwnd, COLORREF(0), 255, LWA_ALPHA);
        }
        let _ = PostMessageW(Some(hwnd), WM_APP_SETHIT, WPARAM(0), LPARAM(0));
        let _ = PostMessageW(Some(hwnd), WM_APP_SHOW, WPARAM(1), LPARAM(0));

        (rect, GetDpiForWindow(hwnd))
    }
}

/// Show or hide the overlay through the subclass (never through tao).
pub fn post_show(on: bool) {
    if let Some(h) = overlay_hwnd() {
        unsafe {
            let _ = PostMessageW(Some(h), WM_APP_SHOW, WPARAM(on as usize), LPARAM(0));
        }
    }
}

pub fn taskbar() -> Option<TaskbarInfo> {
    unsafe {
        let mut abd = APPBARDATA { cbSize: std::mem::size_of::<APPBARDATA>() as u32, ..Default::default() };
        if SHAppBarMessage(ABM_GETTASKBARPOS, &mut abd) == 0 {
            return None;
        }
        let mut st = APPBARDATA { cbSize: std::mem::size_of::<APPBARDATA>() as u32, ..Default::default() };
        let state = SHAppBarMessage(ABM_GETSTATE, &mut st) as u32;
        Some(TaskbarInfo {
            edge: abd.uEdge,
            rect: spike::PhysRect { l: abd.rc.left, t: abd.rc.top, r: abd.rc.right, b: abd.rc.bottom },
            autohide: state & ABS_AUTOHIDE != 0,
        })
    }
}

/// Current ground in overlay-local CSS px, plus the taskbar it came from.
pub fn ground_now(shared: &Shared) -> (f64, Option<TaskbarInfo>) {
    let (_, top, _, h) = shared.overlay.lock().map(|g| *g).unwrap_or((0, 0, 0, 0));
    let tb = taskbar();
    (spike::ground_css(tb, top, h, shared.scale()), tb)
}

/// Wake the pointer thread (a region push arrived).
pub fn wake(shared: &Shared) {
    let raw = shared.wake.load(Ordering::Acquire);
    if raw != 0 {
        unsafe {
            let _ = SetEvent(HANDLE(raw as *mut c_void));
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct HoverPayload {
    region_id: Option<u32>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GroundPayload {
    ground_y: f64,
    taskbar_edge: &'static str,
}

/// Hang watchdog: ping the overlay this often while it is hittable.
const HANG_PING_MS: u64 = 250;
/// Hang watchdog: how long the overlay's thread may take to answer (plan 4.3).
const HANG_TIMEOUT_MS: u32 = 1500;

/// Start a fresh copy with `--recovered` and end this one at once. The hung
/// main thread cannot run a clean shutdown, so terminate instead of exiting.
fn restart_after_hang() -> ! {
    if let Ok(exe) = std::env::current_exe() {
        let mut args: Vec<std::ffi::OsString> = std::env::args_os().skip(1).filter(|a| a != "--recovered").collect();
        args.push("--recovered".into());
        let _ = std::process::Command::new(exe).args(args).spawn();
    }
    unsafe {
        let _ = TerminateProcess(GetCurrentProcess(), 3);
    }
    std::process::abort()
}

pub fn spawn_pointer_thread(shared: Arc<Shared>, app: AppHandle) {
    let _ = std::thread::Builder::new()
        .name("earl-pointer".into())
        .spawn(move || unsafe { pointer_loop(&shared, &app) });
}

unsafe fn pointer_loop(shared: &Shared, app: &AppHandle) {
    // High-resolution timer (Windows 10 1803+), so 8 ms really is 8 ms.
    let timer = CreateWaitableTimerExW(None, PCWSTR::null(), CREATE_WAITABLE_TIMER_HIGH_RESOLUTION, TIMER_ALL_ACCESS.0)
        .or_else(|_| CreateWaitableTimerExW(None, PCWSTR::null(), 0, TIMER_ALL_ACCESS.0));
    let Ok(timer) = timer else { return };
    let Ok(wake_event) = CreateEventW(None, false, false, PCWSTR::null()) else { return };
    shared.wake.store(wake_event.0 as isize, Ordering::Release);

    let mut posted: Option<bool> = None;
    let mut last_hover: Option<u32> = None;
    let mut was_foreground = false;
    let mut last_ground_check: u64 = 0;
    let mut last_ground: f64 = f64::NAN;
    let mut last_hang_ping: u64 = 0;

    loop {
        let now_ms = shared.now_ms();
        let Some(hwnd) = overlay_hwnd() else { return };
        // Plan 4.3 dead-man switch: silent JS for 2 s empties the regions.
        shared.deadman_check(now_ms);
        let regions = shared.regions();
        let (ox, oy, _, _) = shared.overlay.lock().map(|g| *g).unwrap_or((0, 0, 0, 0));

        let mut pt = POINT::default();
        let over_screen = GetCursorPos(&mut pt).is_ok();
        let (lx, ly) = (pt.x - ox, pt.y - oy);
        let visible = shared.visible.load(Ordering::Relaxed);
        let over = if over_screen && visible { spike::hit_test(&regions, lx, ly) } else { None };

        // GetAsyncKeyState reads PHYSICAL buttons; map them to logical ones.
        let swapped = GetSystemMetrics(SM_SWAPBUTTON) != 0;
        let l = GetAsyncKeyState(VK_LBUTTON.0 as i32) < 0;
        let r = GetAsyncKeyState(VK_RBUTTON.0 as i32) < 0;
        let (primary, secondary) = if swapped { (r, l) } else { (l, r) };

        let (hittable, captured) = match shared.latch.lock() {
            Ok(mut latch) => {
                let h = latch.step(PointerInput { over, primary, secondary, now_ms });
                (h && visible, latch.captured())
            }
            Err(_) => (over.is_some(), false),
        };
        Stats::bump(&STATS.pointer_polls);

        // Transitions only: post just when the hit state changes.
        if posted != Some(hittable) {
            let _ = PostMessageW(Some(hwnd), WM_APP_SETHIT, WPARAM(hittable as usize), LPARAM(0));
            posted = Some(hittable);
            Stats::bump(&STATS.sethit_posts);
        }

        // Plan 4.3 hang watchdog: while the overlay takes input, its thread
        // must answer, or a stalled main thread could leave it hittable.
        if hittable && now_ms.saturating_sub(last_hang_ping) >= HANG_PING_MS {
            last_hang_ping = now_ms;
            let mut result = 0usize;
            let out: *mut usize = &mut result;
            let answered = SendMessageTimeoutW(hwnd, WM_NULL, WPARAM(0), LPARAM(0), SMTO_ABORTIFHUNG, HANG_TIMEOUT_MS, Some(out));
            if answered.0 == 0 {
                if !IsWindow(Some(hwnd)).as_bool() {
                    return; // the overlay is gone (quitting), not hung
                }
                restart_after_hang();
            }
        }
        if over != last_hover {
            last_hover = over;
            Stats::bump(&STATS.hover_events);
            let _ = app.emit_to("overlay", "pointer://hover", HoverPayload { region_id: over });
        }

        // Diagnostics for W0: did the overlay ever become the foreground window?
        let fg_hwnd = GetForegroundWindow();
        let fg = fg_hwnd == hwnd;
        if !fg && !fg_hwnd.is_invalid() {
            LAST_OTHER_FG.store(fg_hwnd.0 as isize, Ordering::Release);
        }
        if fg && !was_foreground {
            Stats::bump(&STATS.foreground_hits);
        }
        was_foreground = fg;

        if now_ms.saturating_sub(last_ground_check) >= 1000 {
            last_ground_check = now_ms;
            let (g, tb) = ground_now(shared);
            if (g - last_ground).abs() > 0.25 || last_ground.is_nan() {
                last_ground = g;
                let edge = tb.map_or("none", |t| spike::edge_name(t.edge));
                let _ = app.emit_to("overlay", "platform://ground", GroundPayload { ground_y: g, taskbar_edge: edge });
            }
        }

        let dist = if over_screen { spike::distance_to_nearest(&regions, lx, ly) } else { None };
        let ms = spike::poll_interval_ms(dist, captured);
        let due: i64 = -(ms as i64) * 10_000; // relative, in 100 ns units
        if SetWaitableTimer(timer, &due, 0, None, None, false).is_err() {
            std::thread::sleep(std::time::Duration::from_millis(ms));
            continue;
        }
        let _ = WaitForMultipleObjects(&[timer, wake_event], false, INFINITE);
    }
}

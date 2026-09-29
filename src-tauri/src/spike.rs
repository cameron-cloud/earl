//! Portable pieces of the M0.4 Windows platform spike.
//!
//! Everything here is plain Rust with no Win32 calls, so it compiles and is
//! unit tested on the Linux dev server. The Win32 glue lives in `win.rs` and
//! only builds on Windows (in CI).
//!
//! THROWAWAY: this branch (`spike/overlay`) is never merged. It exists so
//! Cameron can measure W0 (plan section 12) and settle D13 and D14.

// Some items are used only by the Windows module (win.rs).
#![cfg_attr(not(windows), allow(dead_code))]

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicIsize, AtomicU64, AtomicU8, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

/// WebView2 arguments shared by EVERY webview in the app (plan 4.1).
///
/// All webviews that share a user-data folder must be created with identical
/// arguments, and Chromium honours only the last `--disable-features`, so this
/// restates wry's defaults instead of relying on them. `CalculateNativeWinOcclusion`
/// is deliberately NOT disabled here: it is added only if W13 shows throttling.
pub const BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection \
--autoplay-policy=no-user-gesture-required";

// Extended window styles, as plain numbers so the style rule is testable here.
pub const WS_EX_TRANSPARENT: u32 = 0x0000_0020;
pub const WS_EX_TOOLWINDOW: u32 = 0x0000_0080;
pub const WS_EX_APPWINDOW: u32 = 0x0004_0000;
pub const WS_EX_LAYERED: u32 = 0x0008_0000;
pub const WS_EX_NOACTIVATE: u32 = 0x0800_0000;

/// The overlay's ex-style rule (plan 4.1): LAYERED, TOOLWINDOW and NOACTIVATE
/// are always on, APPWINDOW is always off, and TRANSPARENT (click-through)
/// follows the `hittable` flag. Every other bit (TOPMOST included) is kept.
pub fn overlay_ex_style(current: u32, hittable: bool) -> u32 {
    let mut s = (current | WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE) & !WS_EX_APPWINDOW;
    if hittable {
        s &= !WS_EX_TRANSPARENT;
    } else {
        s |= WS_EX_TRANSPARENT;
    }
    s
}

/// Which renderer the overlay page runs (D14 is decided by comparing these).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RenderMode {
    Layers,
    Canvas,
}

impl RenderMode {
    pub fn as_u8(self) -> u8 {
        match self {
            RenderMode::Layers => 0,
            RenderMode::Canvas => 1,
        }
    }
    pub fn from_u8(v: u8) -> Self {
        if v == 1 {
            RenderMode::Canvas
        } else {
            RenderMode::Layers
        }
    }
}

/// Command-line flags. Unknown flags are ignored so a stray argument never
/// stops the spike from starting.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Flags {
    /// `--mode=layers` (default) or `--mode=canvas`.
    pub mode: RenderMode,
    /// `--still`: start with Earl standing still (nothing animates).
    pub still: bool,
    /// `--no-hud`: start with the stats panel hidden.
    pub no_hud: bool,
    /// `--keylog`: open the focus test page at startup.
    pub keylog: bool,
    /// `--layered-alpha`: also call SetLayeredWindowAttributes(255, LWA_ALPHA).
    /// Fallback only, in case the overlay is invisible without it.
    pub layered_alpha: bool,
}

impl Default for Flags {
    fn default() -> Self {
        Flags { mode: RenderMode::Layers, still: false, no_hud: false, keylog: false, layered_alpha: false }
    }
}

pub fn parse_flags<I: IntoIterator<Item = String>>(args: I) -> Flags {
    let mut f = Flags::default();
    for a in args {
        match a.trim().to_ascii_lowercase().as_str() {
            "--mode=canvas" | "--canvas" => f.mode = RenderMode::Canvas,
            "--mode=layers" | "--layers" => f.mode = RenderMode::Layers,
            "--still" => f.still = true,
            "--no-hud" => f.no_hud = true,
            "--keylog" => f.keylog = true,
            "--layered-alpha" => f.layered_alpha = true,
            _ => {}
        }
    }
    f
}

/// A rectangle in overlay-local CSS px, as JS sends it.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct CssRect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

/// One hit region from JS (the spike has rects only, no masks or clips).
#[derive(Clone, Copy, Debug, PartialEq, Deserialize)]
pub struct RegionIn {
    pub id: u32,
    pub rect: CssRect,
}

/// A rectangle in overlay-local physical px, right and bottom exclusive.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PhysRect {
    pub l: i32,
    pub t: i32,
    pub r: i32,
    pub b: i32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Region {
    pub id: u32,
    pub rect: PhysRect,
}

/// CSS px to physical px, rounding outward so the region never shrinks.
pub fn to_phys(r: CssRect, scale: f64) -> PhysRect {
    PhysRect {
        l: (r.x * scale).floor() as i32,
        t: (r.y * scale).floor() as i32,
        r: ((r.x + r.w) * scale).ceil() as i32,
        b: ((r.y + r.h) * scale).ceil() as i32,
    }
}

pub fn regions_from_css(input: &[RegionIn], scale: f64) -> Vec<Region> {
    input
        .iter()
        .filter(|r| r.rect.w > 0.0 && r.rect.h > 0.0 && r.rect.x.is_finite() && r.rect.y.is_finite())
        .map(|r| Region { id: r.id, rect: to_phys(r.rect, scale) })
        .collect()
}

/// The region under the point, if any. Later regions are on top.
pub fn hit_test(regions: &[Region], x: i32, y: i32) -> Option<u32> {
    regions
        .iter()
        .rev()
        .find(|g| x >= g.rect.l && x < g.rect.r && y >= g.rect.t && y < g.rect.b)
        .map(|g| g.id)
}

/// Distance in physical px from the point to the nearest region (0 inside).
pub fn distance_to_nearest(regions: &[Region], x: i32, y: i32) -> Option<f64> {
    regions
        .iter()
        .map(|g| {
            let dx = (g.rect.l - x).max(0).max(x - (g.rect.r - 1)) as f64;
            let dy = (g.rect.t - y).max(0).max(y - (g.rect.b - 1)) as f64;
            (dx * dx + dy * dy).sqrt()
        })
        .fold(None, |acc: Option<f64>, d| Some(acc.map_or(d, |a| a.min(d))))
}

/// Pointer poll interval (plan 4.3): clamp(distance / 6 px per ms, 8, 100) ms,
/// 8 ms during a capture, 100 ms when there is nothing to hit.
pub fn poll_interval_ms(dist: Option<f64>, captured: bool) -> u64 {
    if captured {
        return 8;
    }
    match dist {
        None => 100,
        Some(d) => ((d / 6.0).floor() as u64).clamp(8, 100),
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Button {
    Primary,
    Secondary,
}

/// One pointer-thread sample.
#[derive(Clone, Copy, Debug)]
pub struct PointerInput {
    /// The region under the cursor, if any.
    pub over: Option<u32>,
    /// Logical buttons (already mapped through SM_SWAPBUTTON).
    pub primary: bool,
    pub secondary: bool,
    pub now_ms: u64,
}

/// The capture latch (plan 4.3). A button-down edge over a region latches the
/// overlay hittable until that button's up edge, however fast the cursor leaves
/// the region, with no JS round trip. `hit_capture(bool)` from JS can only
/// extend the latch past the up edge or end it; that extension is dropped by a
/// 300 ms watchdog once no button is physically down.
#[derive(Debug, Default)]
pub struct Latch {
    held: Option<Button>,
    js_hold: bool,
    idle_since_ms: Option<u64>,
    prev_primary: bool,
    prev_secondary: bool,
}

pub const CAPTURE_WATCHDOG_MS: u64 = 300;

impl Latch {
    pub fn captured(&self) -> bool {
        self.held.is_some() || self.js_hold
    }

    pub fn set_js_capture(&mut self, on: bool) {
        if on {
            self.js_hold = true;
            self.idle_since_ms = None;
        } else {
            self.js_hold = false;
            self.held = None;
            self.idle_since_ms = None;
        }
    }

    /// Advance one sample. Returns whether the overlay should take input.
    pub fn step(&mut self, i: PointerInput) -> bool {
        let primary_down_edge = i.primary && !self.prev_primary;
        let secondary_down_edge = i.secondary && !self.prev_secondary;

        match self.held {
            None if i.over.is_some() && primary_down_edge => self.held = Some(Button::Primary),
            None if i.over.is_some() && secondary_down_edge => self.held = Some(Button::Secondary),
            Some(Button::Primary) if !i.primary => self.held = None,
            Some(Button::Secondary) if !i.secondary => self.held = None,
            _ => {}
        }

        if self.js_hold {
            if i.primary || i.secondary {
                self.idle_since_ms = None;
            } else {
                let since = *self.idle_since_ms.get_or_insert(i.now_ms);
                if i.now_ms.saturating_sub(since) >= CAPTURE_WATCHDOG_MS {
                    self.js_hold = false;
                    self.idle_since_ms = None;
                }
            }
        }

        self.prev_primary = i.primary;
        self.prev_secondary = i.secondary;
        i.over.is_some() || self.captured()
    }
}

/// Taskbar geometry from ABM_GETTASKBARPOS, in screen physical px.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TaskbarInfo {
    /// ABE_LEFT 0, ABE_TOP 1, ABE_RIGHT 2, ABE_BOTTOM 3.
    pub edge: u32,
    pub rect: PhysRect,
    pub autohide: bool,
}

pub const ABE_BOTTOM: u32 = 3;

pub fn edge_name(edge: u32) -> &'static str {
    match edge {
        0 => "left",
        1 => "top",
        2 => "right",
        3 => "bottom",
        _ => "unknown",
    }
}

/// Earl's floor in overlay-local CSS px: the top edge of a visible bottom
/// taskbar, otherwise the bottom of the overlay (plan D1 and 4.5, simplified:
/// the spike ignores fullscreen state and secondary monitors).
pub fn ground_css(taskbar: Option<TaskbarInfo>, overlay_top: i32, overlay_h: i32, scale: f64) -> f64 {
    let bottom = overlay_h as f64 / scale;
    let Some(tb) = taskbar else { return bottom };
    if tb.edge != ABE_BOTTOM || tb.autohide {
        return bottom;
    }
    let local_top = tb.rect.t - overlay_top;
    let visible_thickness = overlay_h - local_top;
    if local_top <= 0 || visible_thickness < 8 {
        return bottom;
    }
    local_top as f64 / scale
}

/// Counters shown in the HUD and on the focus test page.
#[derive(Debug)]
pub struct Stats {
    /// WM_APP_SETHIT posts (click-through transitions).
    pub sethit_posts: AtomicU64,
    /// WM_ACTIVATE (active or click-active) seen by the overlay and handed back.
    pub activations: AtomicU64,
    /// Times the pointer thread saw the overlay as the foreground window.
    pub foreground_hits: AtomicU64,
    /// WM_STYLECHANGING (ex-style) that the subclass rewrote.
    pub style_rewrites: AtomicU64,
    /// Pointer thread samples.
    pub pointer_polls: AtomicU64,
    /// Region pushes from JS.
    pub region_pushes: AtomicU64,
    /// `pointer://hover` events emitted.
    pub hover_events: AtomicU64,
}

impl Stats {
    pub const fn new() -> Self {
        Stats {
            sethit_posts: AtomicU64::new(0),
            activations: AtomicU64::new(0),
            foreground_hits: AtomicU64::new(0),
            style_rewrites: AtomicU64::new(0),
            pointer_polls: AtomicU64::new(0),
            region_pushes: AtomicU64::new(0),
            hover_events: AtomicU64::new(0),
        }
    }

    pub fn bump(counter: &AtomicU64) {
        counter.fetch_add(1, Ordering::Relaxed);
    }

    pub fn snapshot(&self) -> StatsSnapshot {
        let g = |c: &AtomicU64| c.load(Ordering::Relaxed);
        StatsSnapshot {
            sethit_posts: g(&self.sethit_posts),
            activations: g(&self.activations),
            foreground_hits: g(&self.foreground_hits),
            style_rewrites: g(&self.style_rewrites),
            pointer_polls: g(&self.pointer_polls),
            region_pushes: g(&self.region_pushes),
            hover_events: g(&self.hover_events),
        }
    }
}

impl Default for Stats {
    fn default() -> Self {
        Self::new()
    }
}

pub static STATS: Stats = Stats::new();

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsSnapshot {
    pub sethit_posts: u64,
    pub activations: u64,
    pub foreground_hits: u64,
    pub style_rewrites: u64,
    pub pointer_polls: u64,
    pub region_pushes: u64,
    pub hover_events: u64,
}

/// State shared between Tauri commands, the tray and the pointer thread.
#[derive(Debug)]
pub struct Shared {
    pub start: Instant,
    pub mode: AtomicU8,
    pub regions: Mutex<Arc<Vec<Region>>>,
    pub latch: Mutex<Latch>,
    /// f64 bits of physical px per CSS px.
    scale_bits: AtomicU64,
    /// Overlay window rect in screen physical px (x, y, w, h).
    pub overlay: Mutex<(i32, i32, i32, i32)>,
    /// Raw HANDLE of the pointer thread's wake event (0 until created).
    pub wake: AtomicIsize,
    pub visible: AtomicBool,
}

impl Shared {
    pub fn new(mode: RenderMode) -> Self {
        Shared {
            start: Instant::now(),
            mode: AtomicU8::new(mode.as_u8()),
            regions: Mutex::new(Arc::new(Vec::new())),
            latch: Mutex::new(Latch::default()),
            scale_bits: AtomicU64::new(1.0f64.to_bits()),
            overlay: Mutex::new((0, 0, 0, 0)),
            wake: AtomicIsize::new(0),
            visible: AtomicBool::new(true),
        }
    }
    pub fn now_ms(&self) -> u64 {
        self.start.elapsed().as_millis() as u64
    }
    pub fn scale(&self) -> f64 {
        f64::from_bits(self.scale_bits.load(Ordering::Relaxed))
    }
    pub fn set_scale(&self, s: f64) {
        if s.is_finite() && s > 0.0 {
            self.scale_bits.store(s.to_bits(), Ordering::Relaxed);
        }
    }
    pub fn mode(&self) -> RenderMode {
        RenderMode::from_u8(self.mode.load(Ordering::Relaxed))
    }
    pub fn set_regions(&self, r: Vec<Region>) {
        if let Ok(mut g) = self.regions.lock() {
            *g = Arc::new(r);
        }
    }
    pub fn regions(&self) -> Arc<Vec<Region>> {
        self.regions.lock().map(|g| Arc::clone(&g)).unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn inp(over: Option<u32>, primary: bool, now_ms: u64) -> PointerInput {
        PointerInput { over, primary, secondary: false, now_ms }
    }

    #[test]
    fn browser_args_restate_wry_defaults_and_autoplay() {
        assert!(BROWSER_ARGS.starts_with("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection "));
        assert!(BROWSER_ARGS.contains("--autoplay-policy=no-user-gesture-required"));
        assert_eq!(BROWSER_ARGS.matches("--disable-features").count(), 1);
        assert!(!BROWSER_ARGS.contains("CalculateNativeWinOcclusion"));
    }

    #[test]
    fn ex_style_keeps_layered_and_toggles_only_transparent() {
        let topmost = 0x8;
        let base = overlay_ex_style(WS_EX_APPWINDOW | topmost, false);
        assert_eq!(base & WS_EX_LAYERED, WS_EX_LAYERED);
        assert_eq!(base & WS_EX_TOOLWINDOW, WS_EX_TOOLWINDOW);
        assert_eq!(base & WS_EX_NOACTIVATE, WS_EX_NOACTIVATE);
        assert_eq!(base & WS_EX_APPWINDOW, 0);
        assert_eq!(base & topmost, topmost);
        assert_eq!(base & WS_EX_TRANSPARENT, WS_EX_TRANSPARENT);
        let hit = overlay_ex_style(base, true);
        assert_eq!(hit ^ base, WS_EX_TRANSPARENT, "only TRANSPARENT differs");
        // Someone (tao) strips LAYERED while hittable: the rule puts it back.
        assert_eq!(overlay_ex_style(hit & !WS_EX_LAYERED, true), hit);
    }

    #[test]
    fn flags_parse() {
        let f = parse_flags(["--mode=canvas", "--still", "--keylog", "--bogus"].map(String::from));
        assert_eq!(f.mode, RenderMode::Canvas);
        assert!(f.still && f.keylog && !f.no_hud && !f.layered_alpha);
        assert_eq!(parse_flags(Vec::<String>::new()), Flags::default());
        assert_eq!(parse_flags(["--LAYERED-ALPHA".to_string()]).layered_alpha, true);
    }

    #[test]
    fn phys_rounds_outward_and_hit_test_uses_topmost() {
        let r = to_phys(CssRect { x: 10.2, y: 20.7, w: 96.0, h: 96.0 }, 1.5);
        assert_eq!(r, PhysRect { l: 15, t: 31, r: 160, b: 176 });
        let regions = regions_from_css(
            &[
                RegionIn { id: 1, rect: CssRect { x: 0.0, y: 0.0, w: 10.0, h: 10.0 } },
                RegionIn { id: 2, rect: CssRect { x: 5.0, y: 5.0, w: 10.0, h: 10.0 } },
                RegionIn { id: 3, rect: CssRect { x: 50.0, y: 50.0, w: 0.0, h: 10.0 } },
            ],
            1.0,
        );
        assert_eq!(regions.len(), 2, "empty rects are dropped");
        assert_eq!(hit_test(&regions, 7, 7), Some(2));
        assert_eq!(hit_test(&regions, 1, 1), Some(1));
        assert_eq!(hit_test(&regions, 10, 3), None, "right edge is exclusive");
        assert_eq!(hit_test(&regions, 100, 100), None);
    }

    #[test]
    fn distance_and_poll_interval() {
        let regions = vec![Region { id: 1, rect: PhysRect { l: 100, t: 100, r: 200, b: 200 } }];
        assert_eq!(distance_to_nearest(&regions, 150, 150), Some(0.0));
        assert_eq!(distance_to_nearest(&regions, 40, 150), Some(60.0));
        assert_eq!(distance_to_nearest(&[], 0, 0), None);
        assert_eq!(poll_interval_ms(Some(0.0), false), 8);
        assert_eq!(poll_interval_ms(Some(300.0), false), 50);
        assert_eq!(poll_interval_ms(Some(5000.0), false), 100);
        assert_eq!(poll_interval_ms(None, false), 100);
        assert_eq!(poll_interval_ms(Some(5000.0), true), 8);
    }

    #[test]
    fn latch_holds_through_a_fast_flick_until_button_up() {
        let mut l = Latch::default();
        assert!(!l.step(inp(None, false, 0)));
        assert!(l.step(inp(Some(1), false, 8)), "hover makes it hittable");
        assert!(l.step(inp(Some(1), true, 16)), "button down over Earl latches");
        assert!(l.step(inp(None, true, 24)), "cursor left the region within a frame: still latched");
        assert!(l.step(inp(None, true, 5_000)), "held for a long drag: still latched");
        assert!(!l.step(inp(None, false, 5_008)), "button up ends it");
        assert!(!l.captured());
    }

    #[test]
    fn latch_ignores_presses_that_start_outside() {
        let mut l = Latch::default();
        l.step(inp(None, false, 0));
        assert!(!l.step(inp(None, true, 8)), "press on the desktop");
        assert!(l.step(inp(Some(1), true, 16)), "dragging across Earl: hittable only while over him");
        assert!(!l.step(inp(None, true, 24)), "no latch, the press did not start on him");
    }

    #[test]
    fn js_capture_extends_then_watchdog_drops_it() {
        let mut l = Latch::default();
        l.step(inp(Some(1), false, 0));
        l.step(inp(Some(1), true, 8));
        l.set_js_capture(true);
        assert!(l.step(inp(None, false, 16)), "JS extended the latch past the up edge");
        assert!(l.step(inp(None, false, 16 + CAPTURE_WATCHDOG_MS - 1)));
        assert!(!l.step(inp(None, false, 16 + CAPTURE_WATCHDOG_MS)), "watchdog: no button down for 300 ms");
    }

    #[test]
    fn js_capture_false_ends_the_latch_and_secondary_button_latches() {
        let mut l = Latch::default();
        l.step(inp(Some(1), false, 0));
        l.step(inp(Some(1), true, 8));
        l.set_js_capture(false);
        assert!(!l.step(inp(None, true, 16)));

        let mut r = Latch::default();
        r.step(PointerInput { over: Some(2), primary: false, secondary: false, now_ms: 0 });
        r.step(PointerInput { over: Some(2), primary: false, secondary: true, now_ms: 8 });
        assert!(r.step(PointerInput { over: None, primary: false, secondary: true, now_ms: 16 }));
        assert!(!r.step(PointerInput { over: None, primary: false, secondary: false, now_ms: 24 }));
    }

    #[test]
    fn ground_is_the_bottom_taskbar_top_edge_or_the_screen_bottom() {
        // 1080 p monitor, overlay inset 1 px from the top: y = 1, h = 1079.
        let tb = TaskbarInfo { edge: ABE_BOTTOM, rect: PhysRect { l: 0, t: 1032, r: 1920, b: 1080 }, autohide: false };
        assert_eq!(ground_css(Some(tb), 1, 1079, 1.0), 1031.0);
        assert_eq!(ground_css(Some(tb), 1, 1079, 1.25), 1031.0 / 1.25);
        assert_eq!(ground_css(Some(TaskbarInfo { autohide: true, ..tb }), 1, 1079, 1.0), 1079.0);
        assert_eq!(ground_css(Some(TaskbarInfo { edge: 0, ..tb }), 1, 1079, 1.0), 1079.0);
        assert_eq!(ground_css(None, 1, 1079, 1.0), 1079.0);
        let sliver = TaskbarInfo { rect: PhysRect { l: 0, t: 1076, r: 1920, b: 1080 }, ..tb };
        assert_eq!(ground_css(Some(sliver), 1, 1079, 1.0), 1079.0, "under 8 px is not a floor");
    }
}

# TODO — Earl Build Tasks

Work through these in order. Check off each task as you complete it.
Commit to git after each numbered section.

---

## Phase 1: Project Scaffold

- [ ] 1.1 Initialize Tauri v2 project with React + TypeScript + Vite
- [ ] 1.2 Configure `tauri.conf.json`:
  - Transparent window
  - Frameless (no decorations)
  - Always on top
  - Resizable: false
  - Skip taskbar: true (Earl shouldn't appear in the taskbar as a window)
  - Window size: 128x128 (will be adjusted dynamically)
  - Transparent: true
- [ ] 1.3 Set up Tauri v2 capabilities/permissions:
  - ALLOW: window management, system tray, local file storage (scoped to appdata), autostart
  - DENY: shell, HTTP/network, clipboard, notifications
- [ ] 1.4 Configure CSP in tauri.conf.json:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset:; connect-src 'none';`
- [ ] 1.5 Copy sprite assets into `src/assets/sprites/`
- [ ] 1.6 Copy tray icon into `src-tauri/icons/`
- [ ] 1.7 Verify TypeScript compiles with `npm run check` or equivalent
- [ ] 1.8 **Git commit: "Initial Tauri v2 scaffold"**

---

## Phase 2: Transparent Window (THE CRITICAL PATH)

- [ ] 2.1 Get a basic transparent window rendering on screen
  - In Rust: set window transparent, decorations false, always_on_top true
  - In frontend: ensure html/body background is transparent
  - Canvas element should be the only visible thing
- [ ] 2.2 Implement click-through for transparent regions
  - Transparent pixels should pass mouse events to the desktop below
  - Earl's actual sprite pixels should be clickable
  - On Windows this requires `WS_EX_LAYERED` + `WS_EX_TRANSPARENT` or Tauri's `set_ignore_cursor_events` 
  - Approach: use `set_ignore_cursor_events(true)` by default, then toggle to `false` when cursor is over Earl's sprite bounds via hit-testing in the frontend
- [ ] 2.3 Position window at bottom of screen above taskbar
  - Get screen dimensions and taskbar height
  - Window should span the full screen width OR follow Earl's position
  - Consider: small window that moves with Earl vs full-width transparent overlay
  - Recommendation: full-width overlay at the bottom, height of 200px (Earl's max jump height)
- [ ] 2.4 **Git commit: "Transparent click-through window working"**

---

## Phase 3: Sprite Renderer

- [ ] 3.1 Create Canvas component that renders a sprite PNG
  - Load images from assets
  - Render at configurable display size (default 64px from 128px source)
  - `imageSmoothingEnabled = true`, `imageSmoothingQuality = 'high'`
  - Canvas should have transparent background
- [ ] 3.2 Implement sprite animation engine
  - Read `sprites.json` for animation definitions
  - Frame stepping based on `requestAnimationFrame` + delta time
  - Support looping and non-looping animations
  - Support per-frame custom durations
- [ ] 3.3 Render Earl idle animation on screen (blink cycle)
  - Frames: idle → idle → idle → idle → blink → idle
  - Durations: 800, 800, 800, 200, 150, 200 (ms)
- [ ] 3.4 **Git commit: "Sprite renderer with idle animation"**

---

## Phase 4: Behavior State Machine

- [ ] 4.1 Implement state machine with states:
  - IDLE, WALK_RIGHT, WALK_LEFT, HOP, SLEEP, PICKED_UP, DROPPED, BIRTHDAY
- [ ] 4.2 Implement state transitions:
  - IDLE → (random 10-30s timer) → WALK_RIGHT or WALK_LEFT
  - WALK → (reach destination or random duration) → IDLE
  - IDLE → (random 60-120s timer) → SLEEP
  - SLEEP → (click or hover) → IDLE
  - IDLE → (click) → HOP → IDLE
  - Any → (drag start) → PICKED_UP
  - PICKED_UP → (drag end) → DROPPED → IDLE
- [ ] 4.3 Implement walk behavior:
  - Earl moves 1-2px per frame in walk direction
  - Stays within screen bounds
  - Turns around or stops at edges
  - Speed: ~30-50px per second
- [ ] 4.4 Implement hop behavior:
  - Vertical offset during hop animation: squat (+5px down), air (-20px up)
  - Returns to ground after animation completes
- [ ] 4.5 **Git commit: "Behavior state machine"**

---

## Phase 5: Mouse Interaction

- [ ] 5.1 Implement click detection on Earl's sprite
  - Hit-test mouse position against Earl's bounding box
  - Single click → trigger HOP state
- [ ] 5.2 Implement drag and drop
  - Mouse down on Earl → PICKED_UP state, start following cursor
  - Mouse move → Earl follows cursor position
  - Mouse up → DROPPED state at current position, play drop animation
  - After drop animation → return to IDLE
- [ ] 5.3 Implement cursor-based click-through toggling
  - When cursor enters Earl's bounds → `set_ignore_cursor_events(false)`
  - When cursor leaves Earl's bounds → `set_ignore_cursor_events(true)`
  - This allows clicking/dragging Earl while passing through empty space
- [ ] 5.4 Right-click on Earl → show context menu (same as tray menu)
- [ ] 5.5 **Git commit: "Mouse interaction — click, drag, drop"**

---

## Phase 6: System Tray

- [ ] 6.1 Create system tray icon using tray_icon_32.png
- [ ] 6.2 Implement tray menu:
  - Show/Hide Earl (toggle)
  - Sound: On/Off (toggle, default off)
  - Settings... (opens settings window)
  - About Earl (opens about window)
  - Separator
  - Quit
- [ ] 6.3 Left-click tray icon → toggle Earl visibility
- [ ] 6.4 **Git commit: "System tray with menu"**

---

## Phase 7: Sound

- [ ] 7.1 Implement Web Audio API sound synthesis
  - Sine/triangle wave oscillator
  - Short duration peeps (100-300ms)
  - Gain envelope for natural fade-out
- [ ] 7.2 Create sound events:
  - Click/hop: high peep (1000Hz, 100ms) + second peep (1200Hz, 80ms, 120ms delay)
  - Pick up: rising chirp (800Hz, 150ms)
  - Drop: lower thud (400Hz, 200ms)
  - Birthday click: happy melody (three ascending notes)
- [ ] 7.3 Sound defaults to OFF, toggled via tray menu
- [ ] 7.4 Sound state saved in config
- [ ] 7.5 **Git commit: "Sound effects"**

---

## Phase 8: Birthday Mode

- [ ] 8.1 Date check on app launch and at midnight:
  - April 4 → activate for "Juliette"
  - June 23 → activate for "Cam"
- [ ] 8.2 Birthday mode overlays:
  - Use birthday.png sprite as idle when birthday mode is active
  - Show speech bubble "Happy Birthday [name]! 🎉" on click
- [ ] 8.3 Confetti particle system
  - Small colored squares that drift down around Earl
  - Spawn occasionally during birthday mode
  - Burst on click during birthday mode
  - 6-8 particles per burst, random colors, gravity + rotation
- [ ] 8.4 **Git commit: "Birthday mode"**

---

## Phase 9: Settings & Config

- [ ] 9.1 Implement config file read/write
  - Location: platform app data dir / earl / config.json
  - Use tauri-plugin-store or manual file I/O
  - Create default config on first launch
- [ ] 9.2 Config schema:
  ```json
  {
    "version": 1,
    "display": { "size": 64, "animationSpeed": "normal" },
    "sound": { "enabled": false, "volume": 0.5 },
    "behavior": { "launchOnStartup": false },
    "stats": {
      "firstLaunchDate": null,
      "totalHops": 0,
      "totalPixelsWaddled": 0
    },
    "position": { "x": null, "y": null, "onTaskbar": true }
  }
  ```
- [ ] 9.3 Settings window (separate Tauri window, small and clean):
  - Display size slider: 48 / 64 / 80 / 96px
  - Animation speed: Chill / Normal / Hyper
  - Sound toggle + volume slider
  - Launch on startup checkbox
  - Earl Stats (read-only): total hops, distance waddled, days as companion
- [ ] 9.4 Save position on close, restore on launch
- [ ] 9.5 Track stats: increment hop counter, accumulate walk distance
- [ ] 9.6 **Git commit: "Settings and config persistence"**

---

## Phase 10: About Panel

- [ ] 10.1 About window (small Tauri window):
  - Earl's animated sprite
  - "Earl v1.0"
  - "Earl started as a real stuffed duck. He was so loved that he was brought to life digitally so he could live forever."
  - "Made with love ❤️"
  - "Earl has been your companion since [firstLaunchDate]"
- [ ] 10.2 **Git commit: "About panel"**

---

## Phase 11: Launch on Startup

- [ ] 11.1 Integrate tauri-plugin-autostart
- [ ] 11.2 Toggle via settings panel, saved in config
- [ ] 11.3 **Git commit: "Launch on startup"**

---

## Phase 12: Final Polish

- [ ] 12.1 Test all animations play smoothly
- [ ] 12.2 Test window positioning on various screen sizes
- [ ] 12.3 Test click-through works correctly
- [ ] 12.4 Test drag and drop feels good
- [ ] 12.5 Test config saves and loads correctly
- [ ] 12.6 Test birthday mode triggers on correct dates
- [ ] 12.7 Set app icon (Earl's face) for the window and .exe
- [ ] 12.8 Optimize bundle size — remove unused dependencies
- [ ] 12.9 **Git commit: "v1.0 release ready"**

---

## Phase 13: Build

- [ ] 13.1 Run `cargo tauri build` on Windows machine
- [ ] 13.2 Test the built .exe runs correctly
- [ ] 13.3 Test the .exe runs on a fresh Windows 11 machine (no dev tools)
- [ ] 13.4 Rename output to `Earl.exe` or `Earl_Setup.msi`
- [ ] 13.5 Build a portable standalone `.exe` (no installer required) for easy distribution to non-technical users

---

## Notes

- Phases 1-5 are the critical path — get these done first
- Phases 6-8 add the charm
- Phases 9-11 add polish
- Phase 12-13 must happen on the Windows machine
- If running behind schedule, ship with Phases 1-8 complete and skip 9-11

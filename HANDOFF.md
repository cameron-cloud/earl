# Earl — Windows Testing Handoff

## What This Is

Earl is a desktop pet duckling for Windows 11 built with Tauri v2 + React + TypeScript.
All code was written on a Linux server. This is the first time it will compile and run
on Windows. Expect some Rust/Tauri compilation fixes needed.

## What's Done

All 11 phases of development are code-complete:
- Transparent frameless always-on-top window (tauri.conf.json + Rust setup)
- Sprite renderer with 18 PNG sprites, animation engine using requestAnimationFrame
- Behavior state machine: IDLE, WALK, HOP, SLEEP, PICKED_UP, DROPPED, BIRTHDAY_IDLE
- Click to hop, drag to pick up, drop with bounce
- Cursor click-through (transparent regions pass events to desktop)
- System tray with show/hide, sound toggle, settings, about, quit
- Web Audio API synthesized sounds (no audio files)
- Birthday mode: April 4 (Juliette), June 23 (Cam) — confetti + speech bubble
- Settings panel: display size, animation speed, sound, autostart, stats
- About panel with animated Earl and backstory
- Config persistence in %APPDATA%/earl/config.json

TypeScript compiles clean. Vite builds clean. Rust is UNCOMPILED — written to Tauri v2
APIs but never run through cargo yet.

## Setup on Windows

### Prerequisites
1. Rust via rustup: https://rustup.rs
2. Node.js LTS: https://nodejs.org
3. Visual Studio Build Tools 2022 with "Desktop development with C++" workload
4. Tauri CLI: `cargo install tauri-cli`
5. WebView2 (ships with Windows 11, already installed)

### First Run
```powershell
cd earl  # or wherever you cloned
npm install
cargo tauri dev
```

## Known Risks / Likely Issues

### 1. Tauri v2 API mismatches
The Rust code was written against Tauri v2 docs but never compiled. Likely fixes:
- Import paths may need adjusting
- Method signatures may differ slightly
- The `WebviewWindowBuilder` API for opening settings/about windows may need tweaks

### 2. Transparent window
This is the hardest part. If the window isn't transparent:
- Check that `tauri.conf.json` has `"transparent": true` on the window
- The HTML/body/root must all have `background: transparent`
- WebView2 on Windows 11 should support this natively

### 3. Click-through
If click-through doesn't work (can't click desktop through Earl):
- `set_ignore_cursor_events(true)` should be called on startup
- Frontend toggles it false when mouse enters Earl's bounds
- The Tauri command `set_ignore_cursor_events` is in `src-tauri/src/commands.rs`

### 4. Sprite loading
If sprites don't render (yellow ellipse placeholder shows instead):
- Check browser console in the Tauri dev window (right-click > inspect)
- Vite resolves sprite paths at build time via `import.meta.url`
- CSP in tauri.conf.json allows `img-src 'self' data: asset: https://asset.localhost`

### 5. Tray icon
If tray icon fails to load:
- It's embedded at compile time via `include_bytes!("../../assets/icons/tray_icon_32.png")`
- The path is relative to `src-tauri/src/tray.rs`
- Verify the file exists at `assets/icons/tray_icon_32.png`

## File Structure

```
src/                        # React frontend (TypeScript)
├── App.tsx                 # Routes main/settings/about via URL params
├── components/
│   ├── EarlCanvas.tsx      # Canvas sprite renderer
│   ├── SpeechBubble.tsx    # Birthday/reaction bubbles
│   ├── Confetti.tsx        # Particle system
│   ├── SettingsPanel.tsx   # Settings window
│   └── AboutPanel.tsx      # About window
├── engine/
│   ├── animator.ts         # Sprite loading, frame stepping
│   ├── stateMachine.ts     # Behavior states + transitions
│   ├── physics.ts          # Position, walk speed, hop offsets
│   └── sound.ts            # Web Audio API synthesis
├── hooks/
│   ├── useEarlBehavior.ts  # Main game loop
│   ├── useDrag.ts          # Drag interaction
│   └── useBirthday.ts      # Date check
└── utils/
    ├── config.ts           # Tauri invoke wrappers
    └── constants.ts        # All magic numbers

src-tauri/                  # Rust backend
├── src/
│   ├── main.rs             # Entry point
│   ├── lib.rs              # Tauri builder, window setup
│   ├── commands.rs         # Frontend commands (cursor, config, screen)
│   ├── config.rs           # Config file I/O with serde
│   └── tray.rs             # System tray + menu + panel windows
├── capabilities/
│   └── default.json        # Permission allowlist
├── Cargo.toml
└── tauri.conf.json         # Window, CSP, bundle config
```

## Debugging Workflow

1. `cargo tauri dev` opens Earl + a devtools-enabled WebView
2. Right-click the window > Inspect to open browser console
3. Rust errors show in the terminal where you ran the command
4. Frontend errors show in the browser console
5. If Rust won't compile, paste the full error — it's usually an import or API signature fix

## Goal

Get Earl running, verify he waddles and hops, then:
```powershell
cargo tauri build
```
Output installer at: `src-tauri/target/release/bundle/nsis/Earl_1.0.0_x64-setup.exe`

Deadline: April 4th, 2026 (Juliette's birthday)

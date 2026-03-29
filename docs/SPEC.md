# Earl — Desktop Duckling Companion

## Project Specification & Claude Code Prompt

---

## The Story

Earl is a real stuffed animal duck — a plush yellow duckling that was gifted to me by Juliette. I love him so much that I want to digitize him so he can live forever. This project is a desktop pet application for Windows 11 where a pixel art version of Earl lives on your taskbar, waddles around, and reacts when you interact with him. The finished app is a personal birthday gift — first for Juliette (April 4th), and later for Cam (June 23rd).

---

## Reference Photos

Two photos of the real Earl plush are included with this project. He is:
- Pale cream-yellow, almost white, very soft and round
- Big round head, chunky round body
- Big shiny black dot eyes with white highlight reflections
- Small orange beak, slightly upturned
- Stubby orange feet that stick out in front when sitting
- Tiny wing nubs on each side
- Overall vibe: extremely cute, round, huggable, simple

These photos should guide all art generation decisions. Earl's digital version should be immediately recognizable as the same duck.

---

## Tech Stack

| Layer | Technology |
|---|---|
| App framework | Tauri v2 |
| Backend language | Rust |
| Frontend language | TypeScript |
| UI framework | React |
| Rendering | HTML5 Canvas |
| Bundler | Vite |
| Installer format | Portable .exe (no installer for V1) |
| Config storage | Local JSON in %APPDATA%/earl/ |
| Security | Tauri capabilities + CSP |

### Why Tauri v2
- Tiny installer size (under 10MB vs Electron's 150MB+)
- Uses Windows 11's built-in WebView2 (no bundled browser)
- Rust backend is memory-safe and secure by default
- Supports transparent, frameless, always-on-top, click-through windows
- System tray integration
- No runtime vulnerabilities from Node.js

### Dev Environment Requirements
- Rust (via rustup)
- Node.js v18+
- Visual Studio Build Tools (C++ workload)
- WebView2 (ships with Windows 11)
- Tauri CLI (`cargo install tauri-cli`)

---

## Art Specification

### Style
High-resolution pixel art. 128x128 pixel sprites where individual pixels are small enough to form smooth curves and subtle shading — similar to modern indie games like Celeste or Eastward. NOT chunky retro 8-bit. Think "pixel art with a lot of pixels."

### Colors (sampled from reference photos)
- Body: pale cream yellow (#FFFCE8 to #FAEDB5 range)
- Feet/beak: warm orange (#E8943A to #D4802E)
- Eyes: near-black (#0A0A0A) with white highlights (#FFFFFF)
- Cheek blush (subtle): soft pink (#F0A08C at low opacity)

### Resolution & Display
- Sprites rendered at 128x128 pixels
- Displayed on screen at user-configurable size (default 64px)
- Size options in settings: 48px, 64px, 80px, 96px
- Canvas uses `imageSmoothingEnabled = true` with `imageSmoothingQuality = 'high'` for clean downscaling

### Required Sprite Sheets (MVP)

Each animation is a horizontal strip of frames in a single PNG. All frames are 128x128 with transparent backgrounds.

| Animation | Frames | Description |
|---|---|---|
| idle_front | 4-6 | Standing facing viewer, gentle breathing + blink cycle |
| idle_side | 4-6 | Standing facing right, breathing + blink |
| walk_right | 6-8 | Waddling to the right |
| walk_left | 6-8 | Waddling to the left (can mirror walk_right) |
| hop | 4-6 | Happy little bounce in place (click reaction) |
| picked_up | 3-4 | Surprised face, feet dangling (drag reaction) |
| dropped | 4-6 | Bounces on landing, shakes it off |
| sleep | 4-6 | Eyes closed, gentle breathing, slight head nod |
| birthday | 6-8 | Wearing tiny party hat, confetti, happy wiggle |

### Sprite Sheet Format
```
sprite_idle_front.png  ->  [frame1][frame2][frame3][frame4]  (each 128x128)
sprite_walk_right.png  ->  [frame1][frame2][frame3][frame4][frame5][frame6]
```

A `sprites.json` manifest file maps animation names to file paths, frame counts, and frame durations:
```json
{
  "idle_front": { "file": "sprite_idle_front.png", "frames": 4, "frameDuration": 200 },
  "walk_right": { "file": "sprite_walk_right.png", "frames": 6, "frameDuration": 120 },
  ...
}
```

If sprite sheets are not yet available, the app should fall back to a simple colored ellipse placeholder so development can proceed without art assets.

---

## Application Behavior

### Window
- Transparent, frameless, always-on-top window
- Click-through in transparent regions (user can interact with desktop behind Earl)
- Earl's sprite area is clickable/draggable
- Window repositions to keep Earl on screen when display resolution changes

### Taskbar Roaming
- Earl's default position is on the bottom edge of the screen, just above the Windows 11 taskbar
- He periodically waddles short distances left or right along the taskbar (random intervals, 10-30 seconds idle between walks)
- He stays within screen bounds (bounces back or turns around at edges)
- Walking speed is casual — maybe 30-50 pixels per second

### Drag & Drop
- User can click and drag Earl anywhere on screen
- While being dragged: switch to `picked_up` animation (surprised face, dangling feet)
- On release: play `dropped` animation (bounce), then Earl stays at the new position
- After being dropped somewhere other than the taskbar, Earl stays in the new spot
- Option: after 60 seconds of sitting in a non-taskbar location, Earl slowly waddles back toward the taskbar (optional, could be V2)

### Click Interaction
- Single click on Earl: play `hop` animation (happy bounce)
- Right-click on Earl: show context menu (same as system tray menu)

### Idle Behavior State Machine
```
IDLE -> (random timer 10-30s) -> WALK
WALK -> (reach destination) -> IDLE
IDLE -> (random timer 60-120s) -> SLEEP
SLEEP -> (click/hover) -> IDLE
IDLE -> (click) -> HOP -> IDLE
IDLE -> (drag start) -> PICKED_UP
PICKED_UP -> (drag end) -> DROPPED -> IDLE
```

At any time, if the current date is a birthday date, overlay the birthday hat on Earl and use the birthday idle animation.

### Birthday Mode
- **April 4th**: Earl wears a tiny party hat all day. Clicking him shows a speech bubble: "Happy Birthday Juliette! 🎉"
- **June 23rd**: Earl wears a tiny party hat all day. Clicking him shows a speech bubble: "Happy Birthday Cam! 🎉"
- Small confetti particles occasionally drift around Earl on birthday days
- Birthday check runs on app launch and at midnight

### Speech Bubbles
- Small rounded rectangle that appears above Earl's head
- Fades in, stays for 3 seconds, fades out
- Used for: birthday messages, future duck facts, reactions
- Styled to look like a cute chat bubble with a small tail pointing down to Earl

---

## Sound

### Implementation
- Use Web Audio API for synthesized sounds (no external audio files needed for MVP)
- Simple sine/triangle wave peeps and chirps
- Short duration (100-300ms per sound)

### Sound Events
| Event | Sound |
|---|---|
| Click (hop) | Short happy peep (high pitch) |
| Pick up | Surprised chirp (rising pitch) |
| Drop/bounce | Soft thud + small peep |
| Birthday click | Happy double-peep melody |
| Walk start | Tiny footstep sound (very subtle) |

### Sound Settings
- Sound is **OFF by default**
- Toggle in system tray menu: "Sound: On/Off"
- Volume slider in settings (if sound is enabled)
- Sound state persists in config file

---

## System Tray

### Tray Icon
- Small 16x16 or 32x32 icon of Earl's face
- Left-click tray icon: toggle Earl visible/hidden
- Right-click tray icon: context menu

### Context Menu
```
Show Earl          (toggle visibility)
Sound              (toggle, default off)
──────────────────
  Settings...      (opens settings panel)
  About Earl       (opens about panel)
──────────────────
  Quit             (exit application)
```

---

## Settings Panel

A small, clean settings window (not a full app — just a compact panel):

- **Display Size**: slider or dropdown (48px / 64px / 80px / 96px), default 64px
- **Sound**: toggle on/off, volume slider
- **Launch on Startup**: checkbox (uses tauri-plugin-autostart)
- **Animation Speed**: dropdown (Chill / Normal / Hyper)
  - Chill: 1.5x frame duration, longer idle timers
  - Normal: default timings
  - Hyper: 0.5x frame duration, shorter idle timers, more walking
- **Earl Stats** (fun, read-only):
  - Total hops
  - Distance waddled (pixels)
  - Time as your companion (days since first launch)

---

## About Panel

A small window with:
- Earl's sprite (animated idle)
- "Earl v1.0"
- "Earl started as a real stuffed duck. He was so loved that he was brought to life digitally so he could live forever."
- "Made with love"
- First launch date displayed as "Earl has been your companion since [date]"

---

## Config File

Stored at `%APPDATA%/earl/config.json`:

```json
{
  "version": 1,
  "display": {
    "size": 64,
    "animationSpeed": "normal"
  },
  "sound": {
    "enabled": false,
    "volume": 0.5
  },
  "behavior": {
    "launchOnStartup": false
  },
  "stats": {
    "firstLaunchDate": "2026-04-04T00:00:00Z",
    "totalHops": 0,
    "totalPixelsWaddled": 0
  },
  "position": {
    "x": null,
    "y": null,
    "onTaskbar": true
  }
}
```

---

## Security

This is critical — Earl should be safe to install on anyone's machine with zero concerns.

### Tauri Capabilities (v2 permission system)
- ALLOW: window management (create, position, resize, always-on-top)
- ALLOW: system tray
- ALLOW: local file read/write (config only, scoped to %APPDATA%/earl/)
- ALLOW: autostart registration
- DENY: shell access
- DENY: broad file system access
- DENY: HTTP/network (Earl is fully offline)
- DENY: clipboard access
- DENY: notifications (not needed)

### Content Security Policy
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none';
```
No external resources. No network calls. Everything bundled.

### Additional Security Measures
- No telemetry, no analytics, no data collection
- No auto-updater (eliminates supply chain attack surface)
- Config file contains no sensitive data
- No third-party runtime dependencies at runtime (no Node.js, no Python)
- Code signing: self-signed certificate via Windows SDK signtool (prevents SmartScreen warnings)

---

## Project Structure

```
earl-project/
├── src/                    # React frontend
│   ├── App.tsx             # Root React component
│   ├── main.tsx            # Entry point
│   ├── components/
│   │   ├── EarlCanvas.tsx  # Canvas renderer for Earl
│   │   ├── SpeechBubble.tsx
│   │   ├── Confetti.tsx
│   │   ├── SettingsPanel.tsx
│   │   └── AboutPanel.tsx
│   ├── engine/
│   │   ├── animator.ts     # Sprite sheet loader, frame stepping
│   │   ├── stateMachine.ts # Behavior state machine
│   │   ├── physics.ts      # Position, velocity, screen bounds
│   │   └── sound.ts        # Web Audio API sound synthesis
│   ├── hooks/
│   │   ├── useEarlBehavior.ts
│   │   ├── useDrag.ts
│   │   └── useBirthday.ts
│   ├── utils/
│   │   ├── config.ts       # Config read/write via Tauri commands
│   │   └── constants.ts    # Colors, timing values, defaults
│   ├── assets/
│   │   └── sprites/        # All sprite PNGs (copied from assets/)
│   └── styles/
│       └── global.css
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── config.rs
│   │   ├── tray.rs
│   │   └── commands.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   └── icons/
├── assets/                 # Source art assets
│   ├── sprites/
│   └── icons/
├── docs/
│   ├── SPEC.md
│   ├── TODO.md
│   ├── ANIMATIONS.md
│   └── PROMPT.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── CLAUDE.md
└── README.md
```

---

## MVP Feature Checklist (Target: April 4th)

### Must Have (V1)
- [ ] Transparent always-on-top window
- [ ] Earl renders on screen with idle animation
- [ ] Earl waddles along bottom of screen periodically
- [ ] Click Earl -> happy hop animation
- [ ] Drag Earl -> picked up animation, drop anywhere
- [ ] System tray icon with toggle show/hide and quit
- [ ] Sound effects (default off, toggle in tray menu)
- [ ] Birthday mode for April 4th (party hat + "Happy Birthday Juliette!")
- [ ] Settings panel with display size slider
- [ ] Config persistence across sessions
- [ ] Placeholder art fallback if sprites aren't ready

### Nice to Have (V1 stretch)
- [ ] Sleep animation after long idle
- [ ] Earl Stats tracking
- [ ] About panel with backstory
- [ ] Launch on startup option
- [ ] Animation speed setting

### V2 (Post-April 4th, target June 23rd)
- [ ] Birthday mode for June 23rd (Cam)
- [ ] Weather awareness (tiny umbrella when raining)
- [ ] Duck facts in speech bubbles
- [ ] Earl wanders back to taskbar after being moved
- [ ] More animations (eating, dizzy, waving)
- [ ] Additional sound effects
- [ ] Proper .msi installer with splash screen
- [ ] Code signing certificate

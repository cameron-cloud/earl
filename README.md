# Earl — Desktop Duckling Companion

A desktop pet duckling for Windows 11. Earl lives on your taskbar, waddles around,
and reacts when you interact with him.

## The Story

Earl started as a real stuffed duck. He was so loved that he was brought to life
digitally so he could live forever.

## Features

- Lives on your Windows 11 taskbar, waddles around periodically
- Click Earl for a happy hop
- Drag Earl anywhere on screen
- System tray icon with settings
- Birthday mode with confetti (April 4th & June 23rd)
- Sound effects (peep! quack!)
- Customizable display size
- Fully offline — zero network access

## Tech Stack

- Tauri v2 (Rust + WebView2)
- React 18 + TypeScript
- HTML5 Canvas sprite rendering
- Web Audio API for sounds

## Project Structure

```
earl-project/
├── src/                    # React frontend
│   ├── App.tsx             # Root component
│   ├── main.tsx            # Entry point
│   ├── components/         # UI components (EarlCanvas, SpeechBubble, etc.)
│   ├── engine/             # Animation, state machine, physics, sound
│   ├── hooks/              # React hooks (behavior, drag, birthday)
│   ├── utils/              # Config, constants
│   ├── styles/             # Global CSS
│   └── assets/sprites/     # Sprite PNGs (copied from assets/)
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # App entry
│   │   ├── lib.rs          # Tauri setup, window positioning
│   │   ├── commands.rs     # Frontend ↔ backend commands
│   │   ├── config.rs       # Config read/write
│   │   └── tray.rs         # System tray
│   ├── capabilities/       # Tauri v2 permissions
│   ├── icons/              # Tray icon
│   ├── Cargo.toml
│   └── tauri.conf.json     # Window + security config
├── assets/                 # Source art assets
│   ├── sprites/            # 128×128 sprite PNGs + sprites.json
│   └── icons/              # Tray icon source
├── docs/                   # Specs and documentation
│   ├── SPEC.md
│   ├── TODO.md
│   ├── ANIMATIONS.md
│   └── PROMPT.md
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── CLAUDE.md
```

## Development

### Prerequisites

- Rust (via rustup)
- Node.js v18+
- Visual Studio Build Tools (C++ workload)
- Tauri CLI (`cargo install tauri-cli`)

### Setup

```bash
cd earl-project
npm install
cargo tauri dev
```

### Build

```bash
cargo tauri build
```

Output: `src-tauri/target/release/bundle/`

## License

Personal project — made with love.

# Claude Code — Kickoff Prompt

Paste this into Claude Code when you start:

---

```
I'm building "Earl" — a desktop pet duckling app for Windows 11 using Tauri v2, React, 
and TypeScript. The project has been fully planned and all art assets are ready.

Read the following files in order before writing any code:

1. CLAUDE.md — your working instructions
2. docs/SPEC.md — complete project specification
3. docs/TODO.md — task checklist (work through this in order)
4. docs/ANIMATIONS.md — animation frame definitions and timing

The sprite assets are already in assets/sprites/ (128×128 PNGs with transparency).
The sprites.json manifest defines all animation sequences.

Start with Phase 1 from the TODO: initialize the Tauri v2 project scaffold with React + 
TypeScript + Vite. Then proceed through each phase in order, committing after each section.

Important context:
- This runs on a Linux server (Hetzner) — code must compile on Windows when pulled
- Target deadline: April 4th, 2026 (8 days)
- Phases 1-8 are essential, 9-11 are nice-to-have
- The transparent click-through window (Phase 2) is the hardest part — prioritize getting it right
- If you hit a Tauri v2 API question, check the latest docs rather than guessing

Begin by reading the docs, then start Phase 1.
```

---

## If Claude Code Gets Stuck

### Transparent window not working
```
The transparent window isn't rendering correctly. Here's what I'm seeing: [describe].
Check the Tauri v2 docs for transparent windows on Windows. Key APIs:
- WebviewWindowBuilder::transparent(true)
- WebviewWindowBuilder::decorations(false) 
- WebviewWindowBuilder::always_on_top(true)
- The HTML/CSS must also have transparent backgrounds (no white default)
```

### Click-through not working
```
Click-through isn't passing events to the desktop. For Tauri v2 on Windows:
- Use window.set_ignore_cursor_events(true) as default
- In the frontend, hit-test the mouse position against Earl's sprite bounds
- When cursor is over Earl, call a Tauri command to set_ignore_cursor_events(false)
- When cursor leaves Earl, call set_ignore_cursor_events(true)
- This requires a Tauri command bridge between frontend and backend
```

### Sprites not loading
```
Sprites in assets/sprites/ aren't loading in the Tauri webview. Make sure:
- Sprites are copied to the correct location in the Tauri build (public assets)
- Use the Tauri asset protocol (asset://localhost/) or relative paths
- Check tauri.conf.json has the assets directory configured
```

### Build fails on Windows
```
The Tauri build fails on Windows with: [error message].
Common fixes:
- Ensure Visual Studio Build Tools are installed with C++ workload
- Run in "Developer Command Prompt for VS" or "x64 Native Tools Command Prompt"
- Check that WebView2 is installed (Windows 11 has it by default)
- Verify Rust target: rustup target add x86_64-pc-windows-msvc
```

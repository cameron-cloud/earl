# CLAUDE.md — Instructions for Claude Code

## Project Overview

Earl is a desktop pet duckling for Windows 11, built with Tauri v2 + React + TypeScript.
Earl lives on the taskbar, waddles around, and reacts to user interaction. This is a
personal birthday gift — the deadline is April 4th, 2026.

## Key Files

- `docs/SPEC.md` — Complete project specification (read this FIRST)
- `docs/TODO.md` — Task checklist, work through this in order
- `docs/ANIMATIONS.md` — Animation definitions and timing
- `assets/sprites/` — All 128×128 sprite PNGs (ready to use)
- `assets/sprites/sprites.json` — Animation frame manifest
- `assets/icons/tray_icon_32.png` — System tray icon

## Tech Stack

- **Tauri v2** (not v1 — use @tauri-apps/ v2 packages)
- **Rust** backend for window management, system tray, config
- **React 18** + **TypeScript** frontend
- **HTML5 Canvas** for sprite rendering
- **Vite** as bundler
- **Web Audio API** for sound (no external audio files)

## Critical Requirements

1. **Transparent frameless always-on-top window** — this is the hardest part, get it working first
2. **Click-through transparency** — transparent regions must pass mouse events to desktop below
3. **Fully offline** — zero network access, no external resources, no CDN imports
4. **Windows 11 only** — no need for macOS/Linux compat
5. **Portable .exe** — no installer for V1

## Build Note

This project is being developed on a Linux server (Hetzner). The code will be pulled
to a Windows 11 machine for compilation and testing. Write code that will compile on
Windows. Use `cargo tauri dev` for development and `cargo tauri build` for production.

## Sprite Assets

All sprites are 128×128 PNG with transparency, stored in `assets/sprites/`.
The app should display them at a user-configurable size (default 64px) using
high-quality downscaling on the Canvas. Walk-left sprites are pre-mirrored.

Some sprites may have checkerboard transparency artifacts from AI generation.
If detected during development, clean these programmatically (detect and remove
the gray/white checkerboard pattern in the semi-transparent edge pixels).

## Animation Timing

See `docs/ANIMATIONS.md` for exact frame sequences and durations.
Use `requestAnimationFrame` with delta time, NOT `setInterval`.

## Working Style

- Work through `docs/TODO.md` in order
- Commit after each major task is complete
- Test what you can on Linux (TypeScript compilation, linting)
- Flag anything that can only be verified on Windows

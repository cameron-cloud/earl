# CLAUDE.md - Instructions for Claude Code

## Project Overview

Earl is a desktop pet duckling for Windows 11, built with Tauri v2 + React + TypeScript.
Earl lives on the taskbar, waddles around, and reacts to user interaction. This is a
personal birthday gift. v1 shipped for April 4th, 2026; v2 (the rebuild on the `v2` branch)
follows `docs/V2_PLAN.md` and has no hard date.

## Key Files

- `docs/V2_PLAN.md` - The approved v2 plan, the source of truth (read your unit in section 13 FIRST)
- `docs/ROADMAP.md` - Milestones and the status of every work unit
- `docs/SPEC.md` - Short product spec, plus the v1 spec for reference
- `docs/ART.md` - The art pipeline (`npm run art:*`); `docs/ART_SHOTLIST.md` - what to draw
- `docs/TESTING.md` - Local checks, CI and the Windows checklist
- `docs/ANIMATIONS.md` - v1 animation definitions and timing
- `art/shots.json` - Shot and frame table generated from `docs/ART_SHOTLIST.md`
- `art/reference/v1/` - The v1 sprite PNGs (placeholders for v2) and the v1 tray icon
- `src/assets/sprites/` - The sprites the v1 app still loads (until M1.4)

## Tech Stack

- **Tauri v2** (not v1 - use @tauri-apps/ v2 packages)
- **Rust** backend for window management, system tray, config
- **React 18** + **TypeScript** frontend
- **HTML5 Canvas** for sprite rendering
- **Vite** as bundler
- **Web Audio API** for sound (no external audio files)

## Critical Requirements

1. **Transparent frameless always-on-top window** - this is the hardest part, get it working first
2. **Click-through transparency** - transparent regions must pass mouse events to desktop below
3. **Offline except the updater** - no external resources, no CDN imports; the only network
   access is the v2 updater check (plan 4.12)
4. **Windows 11 only** - no need for macOS/Linux compat
5. **NSIS per-user installer** for v2 (v1 was a portable .exe)

## Build Note

This project is being developed on a Linux server (Hetzner). The code will be pulled
to a Windows 11 machine for compilation and testing. Write code that will compile on
Windows. Use `cargo tauri dev` for development and `cargo tauri build` for production.

## Sprite Assets

v1 sprites are 128×128 PNG with transparency: the app loads them from `src/assets/sprites/`
and the originals live in `art/reference/v1/`. v2 art goes through the pipeline in
`docs/ART.md`: raw exports on #FF00FF are keyed, aligned and packed into atlases, and
`src/sim/anim/sprites.gen.ts` is generated at build time (never committed). Checkerboard
backgrounds are rejected by the importer, not cleaned.

## Animation Timing

See `docs/ANIMATIONS.md` for exact frame sequences and durations.
Use `requestAnimationFrame` with delta time, NOT `setInterval`.

## Working Style

- Work through the units in `docs/V2_PLAN.md` section 13, tracked in `docs/ROADMAP.md`
- Commit after each major task is complete
- Test what you can on Linux (TypeScript compilation, linting)
- Flag anything that can only be verified on Windows

## WRITING & ENGINEERING STANDARDS
- Never use em-dashes or en-dashes in any writing - docs, code comments, commit
  messages, chat replies, copy. Use a plain dash ( - ) instead.
- Technical decisions: pick the best solution on the merits. Do not give too much
  weight to project cost when weighing options.
- Bug fixes: always start by reproducing the bug end-to-end, as close as possible
  to how a real end user would trigger it. Confirm the real root cause before
  writing the fix, so the fix actually solves the reported problem.
- End-to-end testing of a product: be picky about the UI you see and obsess over
  pixel perfection. If something looks off, even if it is not directly related to
  what you are doing, try to get it fixed along the way.
- Hold the same high standard for engineering excellence: lint failures and test
  flakiness - if you see one, even if it is not caused by what you are working on
  right now, still get it fixed.
- Git commits: never auto-add an AI/agent name as co-author (no "Co-Authored-By:
  Claude ..." lines) and no "Generated with Claude Code" footers.

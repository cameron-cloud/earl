# Earl - Desktop Duckling Companion

A desktop pet duckling for Windows 11. Earl lives on your taskbar, waddles around,
and reacts when you interact with him.

## The Story

Earl started as a real stuffed duck. He was so loved that he was brought to life
digitally so he could live forever.

## Status

- **v1** (April 2026) is what `master` builds: Earl walks the taskbar, hops when clicked, can be
  dragged anywhere, has a tray icon with settings, sound effects (peep! quack!), a size setting
  and a birthday mode with confetti (April 4th and June 23rd).
- **v2** is being rebuilt on the `v2` branch: a deterministic simulation, far more behaviors and
  moods, a toolbox of items, window perching, optional chaos, a proper installer and an updater.
  The plan is [`docs/V2_PLAN.md`](docs/V2_PLAN.md) and progress is in
  [`docs/ROADMAP.md`](docs/ROADMAP.md). Until M1.4 lands, the v2 branch still runs the v1 app.

Earl makes no network calls except the v2 updater's check for a new version.

## Docs

| Doc | What it holds |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | Short product spec, plus the v1 spec |
| [`docs/V2_PLAN.md`](docs/V2_PLAN.md) | The approved v2 plan (source of truth) |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Milestones and work unit status |
| [`docs/ART_SHOTLIST.md`](docs/ART_SHOTLIST.md) | Art style guide, shot list and prompt templates |
| [`docs/ART.md`](docs/ART.md) | The art pipeline |
| [`docs/TESTING.md`](docs/TESTING.md) | Local checks, CI and the Windows checklist |

## Tech Stack

- Tauri v2 (Rust + WebView2), NSIS installer
- React 18 + TypeScript, HTML5 Canvas sprite rendering, Vite
- Web Audio API for sounds
- Vitest, Playwright, ESLint, Prettier; GitHub Actions for Linux and Windows CI

## Project Structure

```
.
├── src/                    # Web frontend (v1 app until M1.4)
│   ├── App.tsx, main.tsx
│   ├── components/ engine/ hooks/ utils/ styles/
│   ├── assets/sprites/     # Sprites the v1 app loads
│   ├── assets/atlas/       # Generated atlas pages (gitignored)
│   └── sim/anim/sprites.gen.ts   # Generated frame table (gitignored)
├── src-tauri/              # Rust backend (Tauri app, `core` crate, icons, config)
├── art/
│   ├── shots.json          # Shot and frame table, generated from docs/ART_SHOTLIST.md
│   ├── SHOTLIST.md         # Generated per-shot prompts
│   ├── reference/v1/       # v1 sprite PNGs (v2 placeholders)
│   ├── masters/            # Imported 512 px masters (as art arrives)
│   └── inbox/ out/ templates/   # Raw exports, contact sheet, templates (gitignored)
├── scripts/                # art.mjs + art/lib, check-dashes, bump-version
├── test/                   # Vitest suites and fixtures
├── e2e/                    # Playwright specs
├── docs/                   # Specs, plan, roadmap, art and testing docs; archive/
└── .github/workflows/      # ci.yml, ci-rust.yml, release.yml
```

## Development

### Prerequisites

- Node.js 24 (see `.nvmrc`)
- Rust (via rustup)
- On Windows: Visual Studio Build Tools (C++ workload); WebView2 ships with Windows 11

### Setup and run

```bash
npm ci
npm run tauri dev      # the desktop app (Windows)
npm run dev            # the web frontend only, in a browser
```

`dev`, `build` and `typecheck` regenerate the art atlases and `sprites.gen.ts` first
(`npm run art:build`), so a fresh clone needs no manual step.

### Checks

```bash
npm run lint           # ESLint, Prettier, no em or en dashes
npm run typecheck
npm test               # Vitest
npm run art:check      # art lint and shot list sync; writes art/out/contact.png
npm run e2e            # Playwright
```

See [`docs/TESTING.md`](docs/TESTING.md) for what CI runs and the Windows checklist.

### Art

```bash
npm run art:import -- --profile v1-faithful   # key and align raw exports from art/inbox/
npm run art:status                            # per-frame status and coverage
```

See [`docs/ART.md`](docs/ART.md).

### Build

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/`. CI builds a signed NSIS installer for every pull
request and push (the `windows` job of `ci-rust.yml`).

## License

Personal project - made with love.

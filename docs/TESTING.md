# Testing Earl

The test strategy is plan section 12 in [`V2_PLAN.md`](V2_PLAN.md). Everything that is not real
Win32 behavior is checked on Linux (locally and in CI); the Windows checklist at the end is for
what only a real Windows 11 desktop can show.

## Local checks (Linux)

Node 24 (`.nvmrc`). Run `npm ci` once, then:

| Command | What it checks |
|---|---|
| `npm run lint` | ESLint (`--max-warnings 0`), Prettier and `check-dashes` (no em or en dashes in tracked files). `npm run format` fixes Prettier issues. |
| `npm run typecheck` | `tsc --noEmit`. Runs `art:build` first, so the generated `sprites.gen.ts` exists. |
| `npm test` | Vitest: `src/**/*.test.ts(x)` and `test/**/*.test.ts(x)`. `npm run test:coverage` adds a coverage report under `coverage/` (gitignored). |
| `npm run art:check` | Art lint, shot list sync and project checks; writes `art/out/contact.png`. See [`ART.md`](ART.md). |
| `npm run build` | `tsc` plus `vite build` of the web app. Runs `art:build` first. |
| `npm run e2e` | Playwright against `npm run dev` (needs a local Chromium: `npx playwright install chromium`). |
| `npm run version:selftest` | The `bump-version` self test on LF and CRLF files. |
| `cargo check`, `cargo test` | The Rust workspace, run from `src-tauri/`. |

On this server clippy, rustfmt and the Windows targets are not installed (plan Q10 is still open),
so they run only in CI. Keep caches, build output and browsers off the root disk.

Rules for tests (plan 12.2): deterministic and fast, no flakes, no wall-clock sleeps. A
feature that is not merged yet gets its tests as `test.fails(...)` or `test.todo(...)` tagged
with the unit that turns them on (`// unit: M2.1`); that unit flips them to `test(...)`. Once
M2.6 lands, CI fails if a `test.fails` remains for a unit marked merged in
[`ROADMAP.md`](ROADMAP.md).

## CI

Every pull request (any base branch) and every push to `v2` or `master` runs:

| Workflow | Job | Steps |
|---|---|---|
| `ci.yml` | `web` | `npm ci`, art codegen, lint, typecheck, vitest with coverage, `art:check` (uploads the `art-contact-sheet` artifact), bump-version self test, build |
| `ci.yml` | `e2e` | Playwright on Chromium; uploads `playwright-report` |
| `ci.yml` | `audit` | `npm audit --audit-level=high`, `cargo audit` |
| `ci-rust.yml` | `rust` | Linux fmt, clippy `-D warnings`, `cargo test`, version agreement, bump-version self test |
| `ci-rust.yml` | `windows` | Windows clippy, `cargo test`, an NSIS build (unsigned for now, see below) with `EARL_BUILD=<branch>@<sha7>`; uploads `earl-windows-<run>` (setup exe and raw `earl.exe`, 14 days) |

`release.yml` runs on a `v*` tag and drafts a release (unsigned for now). A Windows run takes about 10
minutes. To test a branch on Windows, download `earl-windows-<run>` from the run's summary page.

Code signing is skipped for now (Cameron 2026-09-30; plan 4.12, Q9). Every Windows build shows
an "Unsigned build (expected)" notice in its run summary. That is not a failure. Adding the six
`AZURE_*` settings (three repository secrets, three repository variables) turns signing on with
no code change.

## Installing an unsigned build (note for Juliette; M6.1 copies it into the release notes)

1. The first time the installer runs, Windows may show **Windows protected your PC**
   (SmartScreen). Click **More info**, then **Run anyway**. This happens once, at first install.
2. Auto-updates do not show it: Earl downloads and installs them himself.
3. Smart App Control can block an unsigned app outright, with no Run anyway button. Check
   **Windows Security > App & browser control > Smart App Control**. If it says **On**, or
   **Evaluation** (which can turn itself On later), unsigned Earl can be blocked: tell Cameron,
   and signing gets revisited. If it says **Off**, nothing more is needed.

## Windows checklist (plan 12.5)

Run on the CI-built exe or setup. For each item, tick it and write down the build id
(`<branch>@<sha7>`, the `EARL_BUILD` of the CI run) and the date, so a later regression can be dated. Units name the
items they need in their "W" line in [`ROADMAP.md`](ROADMAP.md) and the plan.

- [ ] **W0 Spike (M0.4).** Idle CPU and GPU of the overlay; hover flicker; focus kept in Notepad; PresentMon "Hardware: Independent Flip" vs "Composed" for a borderless-fullscreen video with Earl visible; layers vs canvas cost. Decides D13 and D14.
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W1 Install.** NSIS per-user with no UAC; SmartScreen noted; **on a clean Win11 VM with Smart App Control On** (signed build required if it blocks); Start menu entry; uninstall. Upgrade over v1 NSIS and over v1 MSI (the pre-install hook offers to remove the MSI): settings and stats carried over, `reunion` plays, one "Installed apps" entry, autostart path updated.
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W2 Transparency.** No border or black box at 100/125/150/175%, mixed DPI, runtime scale change, text scaling 125%, after sleep/resume, HDR.
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W3 Hover.** No flicker on hover transitions (LAYERED is permanent; only TRANSPARENT toggles).
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W3b Occlusion.** YouTube playing in Chrome and a Teams call behind Earl keep rendering (`document.visibilityState` stays `visible`) while hovering and dragging him.
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W4 Focus.** Type in Notepad and Word while clicking and dragging Earl: no keystroke lost; Focus Assist does not turn on; the taskbar stays put; `platform://ground` does not change. Earl absent from Alt+Tab and the taskbar; present on every virtual desktop. Right-click shows no browser menu; F5 and Ctrl+P do nothing.
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W5 Click-through.** Desktop icons clickable beside his transparent corners and his tilted or tumbling body; the desktop works mid-throw and mid-chute; a flick-throw from his edge at more than 3000 px/s is not lost; swapped mouse buttons behave; 20 drags leave nothing blocked; killing `msedgewebview2.exe` frees the desktop within 2 s and the overlay reloads.
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W5b Hang.** A dev-only command sleeps the main thread 10 s while the cursor is over Earl: the desktop is usable within 2 s and the app restarts via `--recovered`.
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W6 Taskbar.** At default settings he lives on the taskbar top and only occasionally slips behind; feet exactly on the edge (zoomed screenshot) at every scale; roam range "Clear of the clock" keeps him off the tray and clock at every scale; peek clip pixel-exact; wade walk looks like a waddle; taskbar icons under his hidden body clickable; auto-hide slide in and out; small, tablet and top/left taskbars; `explorer.exe` restart; Start, notification centre, **jump lists, thumbnail previews, tray overflow, quick settings and taskbar context menus** drawn over him and fully clickable.
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W7 Fullscreen.** Browser F11, YouTube fullscreen (scrub bar under Earl is clickable without hovering 600 ms), a borderless game, an exclusive D3D game, a PowerPoint slideshow (hidden via the class table), maximized with auto-hide: bottom placement and back within 1 s after exit. Each of the three "When something is fullscreen" choices: stay at the bottom (items hidden), toys stay (items visible, clicks pass through), hide Earl.
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W8 Sharpness.** No blur at 125%, 150% and 200%, including size 256 (512 level); 256 px setting gives the right physical size.
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W9 Perching.** Explorer, Chrome, VS Code, maximized and snapped windows; falls on move (including a slow user drag), minimize, close; ghost windows (Steam, GeForce and Discord overlays, UWP, Teams toasts, Chrome popups) never perched; rounded-corner clip; WinEvent counter < 5/s while moving the mouse.
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W10 Chaos.** Cursor gag at most 1 s, telegraphed, aborts on a nudge, never with a button held, a click right after lands on the shield, behaviour over an elevated window; typing honk works unfocused, is silent for elevated windows, at most 3 per hour; raw input still works after toggling the feature off and on; Defender scan clean.
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W11 Sound.** A sound plays on launch **before any click** (autoplay flag); tray and settings stay in sync.
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W12 Settings.** Every control that exists in the build is live and persists, including the five "Where Earl can go" controls; autostart reflects Task Manager Startup state, and **disable in Task Manager, re-enable in Settings, reboot: Earl starts**; hotkey conflicts reported; hotkey "off" survives a restart; open Settings, click a browser: the browser covers Settings.
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W13 Lifecycle.** Lock, sleep and resume, display off, RDP: no frozen or blank canvas, sane needs after a long absence, evidence-of-absence beat; logoff keeps `state.json` intact (flush request); no freeze from occlusion throttling.
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W14 Performance.** Idle < 1% CPU total; < 200 MB after 8 h; walking cadence even on a 75 Hz or 144 Hz display if available.
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W15 Updater.** Preview N to preview N+1 via the preview endpoint (`2.0.0-preview.<run>` versions): prompt, Later / Skip / Install, relaunch, state preserved.
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W16a Single instance.** Single instance with autostart; a second launch opens Settings.
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W16b Toolbox (M3.1).** Toolbox hotkey and drawer; items persist across a restart; stash items return on "Bring Earl back".
  - Build id: none yet. Date: none yet. Notes: none.
- [ ] **W17 Privacy.** `hideFromScreenCapture` hides Earl from a Teams share and a screenshot on the layered overlay; the cursor gag is suppressed while Teams or Zoom is foreground.
  - Build id: none yet. Date: none yet. Notes: none.

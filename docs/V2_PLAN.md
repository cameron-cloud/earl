# Earl v2 - Implementation Plan

Base: `/home/cameron/mini-earl`, branch `master`, HEAD `0bfa12e` (v1.0.0). This plan merges six specialist designs (platform, simulation/render, brain, toolbox/settings, art, delivery). It resolves every conflict between them in section 2. The companion art work order is `ART_SHOTLIST.md`.

Nothing in this plan has been run on Windows yet. Anything marked **(W)** can only be verified on Cameron's Windows 11 machine. The riskiest Windows assumptions are now measured first, in the M0.4 platform spike, before any contract is frozen.

**Revision 2.** Four adversarial reviews (Windows platform, "alive not robotic", requirement coverage, engineering) were applied to this plan. Every blocker and major issue is either fixed in place or listed with a reason in Appendix A (Rejected critiques). The largest changes: the taskbar default became `always` (superseded in revision 3, below), and the behind-the-taskbar lane is a full-body, clipped, expressive lane instead of a static head (5.6). The overlay never lets tao touch its styles after init (4.1, 4.3). The panel is an unowned normal window (D9). New brain systems give him goals, memories, an attention model and a gentler first week (6.15 to 6.20). There is a Windows spike (M0.4) and a walking skeleton (M1.S) before the fan-out. Art style is a hard gate before Batch A (Q2).

**Revision 3 (Cameron's answers, 2026-09-29).** Cameron answered the open questions (section 15). His words on the taskbar: "His home is on top of the taskbar with settings that change where he is allowed to wander." So:
- Earl's home is the **top edge of the taskbar** when one is visible (the bottom of the screen when there is none). Slipping behind it to peek, sulk or nap is an occasional choice of his: the `earl.taskbarHiding` default is now **`sometimes`** (D1, 5.6). The behind lane, the depth ladder and the four levels are unchanged.
- A new **"Where Earl can go"** settings group (D35, 9.1, 9.3) holds five wander-zone controls: behind the taskbar, perch on windows, climb the screen edges, roam range along the taskbar, and what happens in fullscreen. A disallowed zone gives every behavior that enters it zero utility (7, "Zone gates").
- The visibility metrics were re-derived for the on-top home (5.6, 12.6); the old 55% / 35% pair is kept as the floor for the `always` level.
- Q2 (art style gate), Q5 (typing honk, now counting key-downs), Q14 (no hard date) are answered; the rest are accepted at their recommended defaults, except the server-tool installs in Q10. Q9 is answered: assume default security settings, so builds are signed. Stray copies are kept and their content consolidated into docs/SPEC.md.

---

## 1. Vision and design principles

**Vision.** It is the same duck, with much more life: many more animations, behaviors and settings to play with. Earl should have real attitude and be unpredictable, in a way that reads as a grumpy-but-loving, chaotic, curious little creature rather than a timer-driven robot. The rebuild is also the chance to clean up the assets and make him cheap to run.

**Principles**

1. **The simulation lives outside React.** A pure, deterministic TypeScript `World` runs on a fixed 60 Hz step. React is used only for the panels and the toolbox drawer, and never re-renders per frame.
2. **Rust owns the desktop.** Rust owns window geometry, the taskbar, fullscreen state, window surfaces, the cursor and hit testing. JS never computes platform geometry; it receives typed events in overlay-local CSS px.
3. **One overlay, occlusion by clipping.** One transparent window covers the primary monitor. "Behind the taskbar" and "behind a window" are clip rects the renderer applies and the hit test honours. The real z-order is left alone.
4. **Behavior comes from utility plus sampling, never timers.** Durations are log-normal. Choices are softmax-sampled, with memory, momentum and "ignore it" always an option.
5. **Zero work when nothing changes.** No draw, no IPC and no setState when the scene is unchanged. Everything pauses when Earl is hidden, the session is locked or the display is off.
6. **Linux first, Windows only where it has to be.** `earl-core` (pure Rust), the headless sim, the browser sandbox and golden traces cover everything except real Win32 behavior.
7. **Code never waits on art.** Every frame has a fallback chain and every prop has a canvas-drawn placeholder.
8. **Safe and private by construction.**
   - Key identity and window titles are never read.
   - Prank limits are hard-coded in Rust.
   - A dead-man switch means the desktop can never be blocked, even if the main thread hangs (4.3: the pointer thread detects a hung overlay and restarts the app).
   - Nothing hostile: pranks are telegraphed, capped per hour and never redirect a click into another app (6.11, 7.8).
9. **Single writer per datum.** Rust owns settings, stats and files. The world owns live runtime state. Every other party sends patches or commands.

---

## 2. Decisions

`[C]` marks a decision Cameron was asked to confirm. Each appears again in section 15 with his answer. As of revision 3 every `[C]` decision is answered or accepted at its recommended default, except D34 (Q10, server tools), which stays open. D28 signing is decided by Q9: assume default security settings, so builds are signed.

### Product

**D1 `[C]` (answered, Q1) Taskbar: his home is on top of it; behind it is an occasional choice.**
- **Rule:**
  - When a bottom taskbar is visible, his home is its **top edge**: he stands, walks, sits, naps and plays with his feet on the taskbar's top edge, like v1, and that is where he returns to after anything else (at `never` and the default `sometimes`; the `mostly` and `always` levels below let a user move his home behind).
  - Slipping **behind** the taskbar is a choice he makes now and then, to peek, sulk, hide or nap. He then uses the **behind lane** (5.6): his feet stand on a virtual floor below the taskbar's top edge and everything below that edge is clipped, so the taskbar hides him to a chosen depth. At the shallow "wading" depth his head, wings and chest show and he walks, fidgets, quacks and emotes there with ordinary full-body clips. Deeper depths are the peek (chin on the edge), eyes-only and fully hidden. When the reason ends (the sulk resolves, the nap ends, the cursor leaves), he climbs back on top.
  - With no taskbar (a fullscreen app, auto-hide, or a taskbar on another edge), he stands at the very bottom of the screen.
  - Where else he may go (behind the taskbar, windows, screen edges, a section of the taskbar, fullscreen) is set by the "Where Earl can go" group (D35).
- **Setting:** `earl.taskbarHiding` = `never | sometimes | mostly | always`, **default `sometimes`**. The plain-number meaning of each level is in the 5.6 table. `mostly` and `always` keep the revision 2 behavior (home behind, pops up for whole-body actions) for anyone who wants it.
- **Rationale:** Cameron's answer to Q1: "His home is on top of the taskbar with settings that change where he is allowed to wander." `sometimes` is exactly that reading (home on top, slips behind by choice, about 15% of awake grounded time). The expressive behind lane (5.6) still makes those visits lively rather than a static head.

**D2 Needs meters.** The visible meters are hunger, energy and fun (requirement 3). A fourth, **clean**, stays hidden:
- It only raises bath and scratch utility.
- It never feeds sulking.
- Rationale: it gives the tub a purpose without adding a chore.

**D3 Activity setting.** `earl.activity` is a 0-100 slider with labels Couch potato / Chill / Normal / Lively / Gremlin at 0/25/50/75/100.
- It interpolates the brain's 5-row activity table.
- It replaces v1 "Animation speed".
- Rationale: it is a smooth slider for the UI while the tuning stays in 5 rows.

**D4 `[C]` (accepted default, Q3) Size.**
- `earl.size` 48-256 px, step 8, snapping at 48/64/96/128/192/256. Default 96.
- 48 is the floor because hit masks and faces stop reading below it.

**D5 `[C]` (accepted default, Q4) Personality sliders.** Six sliders in an "Earl's personality" card on the Mood tab: grumpiness, playfulness, curiosity, sleepiness, clinginess, gremlin.
- They include a "Reset to Earl" button.
- Rationale: the "settings to mess around with" goal; each is one number in the brain.

**D6 `[C]` (accepted default, Q6) Fullscreen.**
- `general.fullscreen` = `stayAtBottom | stayWithItems | hide`, default `stayAtBottom`. It is shown in the "Where Earl can go" group (D35) as "When something is fullscreen": "Earl stays at the bottom" / "Earl and his toys stay" / "Hide Earl".
- Separately, `general.hideInGamesAndSlideshows` (default on, labelled "Hide in exclusive games and slideshows") hides Earl for exclusive D3D fullscreen, presentation mode, and slideshows detected by foreground window class (PowerPoint `screenClass` and a small table of presenter classes; class names only, never titles). Most modern games run borderless and classify as `app`, so the label promises no more than the detection can deliver.
- In fullscreen, placed items are hidden (not deleted) so they never cover video controls, unless the setting is `stayWithItems`: then they stay visible at the bottom and are display-only like Earl (click-through until hover-to-arm, below), and he may use the ones already on the ground. Earl stays and biases to the bottom corners.
- **Perching is never possible in fullscreen,** whatever the settings: the fullscreen app covers every other window and its own top edge is the screen top, so there is nothing to perch on. This is why the fullscreen control has no perching option.
- **In any fullscreen state Earl is display-only.** He has no hit region, so a click on a video scrub bar or a game HUD under him goes to the app. He becomes hittable only after the cursor has rested on him for 600 ms ("hover-to-arm", shown by a small look-up at the cursor); then pet and drag work until the cursor leaves him.

**D7 Toolbox.**
- A drawer drawn **inside the overlay**, docked bottom-right on the ground line.
- Opened from the tray, the global hotkey, or Settings.
- Rationale: dragging an item out is a same-window pointer capture. The platform, toolbox and delivery specialists agreed; the sim specialist's "separate toolbox window" is rejected because cross-webview drag needs OLE and a click-through drop target.

**D8 `[C]` (accepted default, Q12) Toolbox hotkey.** Default `Ctrl+Alt+Shift+D`, configurable or off, with "in use" detection.
- Rationale: "D for duck". Adding Shift avoids the AltGr clash of `Ctrl+Alt+D` on some EU layouts, and it is easier to type than `Ctrl+Alt+Shift+T`.

**D9 Panel window.**
- One `panel` window with tabs: General, Earl, Mood, Chaos, Toolbox, Sound, About. About is a tab, not its own window.
- It is an **unowned, normal top-level window**: not topmost, with its own taskbar button and Alt+Tab entry, so other apps can cover it. (Owning it by the topmost overlay would put it in the topmost band and bring back v1 bug #49.) It is destroyed on close and has its own Vite entry, `panel.html`.
- Earl never covers its controls: while the panel is visible and above him in z-order, its rect is an occluder in the surfaces snapshot, so Earl renders and hit-tests as if he were behind it, unless he is perched on its top edge.

**D10 Swarm (kept restrained).**
- `chaos.swarm.maxDucklings` 1-3, default 2.
- `chaos.swarm.frequency` = `rare` (a visit roll every 45-90 min) or `sometimes` (every 20-40 min); default `rare`.
- Visits last 30-60 s, with a 15 min minimum cooldown.
- Never while he sleeps, in fullscreen, or when a need is red.
- Ducklings use baby art when it exists; otherwise scaled 0.55x, tinted Earl frames.

**D11 Physics party.** Gravity slider 0.3-1.0, default 0.4. Bounciness 0-100, default 80, mapped to e = 0.22 + 0.73 * b/100.

**D12 Quiet time** (a new, cheap feature from the toolbox specialist).
- Tray > Quiet time > 30 min / 1 h / until woken.
- He naps in place; no chaos, no sound.

**D35 Where Earl can go (wander zones)** (revision 3, from Cameron's Q1 answer; numbered last so existing references stay stable).
- One card on the Earl tab, "Where Earl can go", with **five controls** (9.1, 9.3). Each is a zone he may or may not enter:

| Control (label) | Key | Values | Default | What it allows |
|---|---|---|---|---|
| Behind the taskbar | `earl.taskbarHiding` | `never` / `sometimes` / `mostly` / `always` | `sometimes` | the behind lane (5.6, 7.5a): peeking, sulking, hiding and napping behind the taskbar, his item stash (8.2), and `edge_hide` at a side edge when there is no taskbar (7.1) |
| Perch on windows | `earl.windowPerching` | on / off | on | jumping onto window tops and everything done up there (7.5b, 5.7), and whims that target a window |
| Climb the screen edges | `earl.wallClimbing` | `never` / `wildOnly` / `anytime` | `wildOnly` | `wall_climb` (7.5b) |
| How far he roams along the taskbar | `earl.roamRange` | `{from, to}` in % of the monitor width, span at least 25 | `{from:0, to:100}` (whole width) | where on the ground line (taskbar top, behind lane, or screen bottom) he walks, rests and uses items |
| When something is fullscreen | `general.fullscreen` | `stayAtBottom` / `stayWithItems` / `hide` | `stayAtBottom` | whether he and his items stay during fullscreen (D6); perching is never possible in fullscreen |

- **Climbing decision: `wildOnly` by default.** A climb takes him up to 70% of the screen height, over whatever she is working on, and usually ends in a fall. Outside chaos that reads as a glitch rather than personality, and his home is the taskbar top (D1). So by default he climbs only inside Wild Earl gremlin episodes (6.11), which means never while chaos is off (the default). `anytime` is there for anyone who wants it: outside Wild it is a rare, calm climb (utility 0.05·C at an edge, 15 min cooldown, up to 40% height, always a gentle slide back down, no backflip), and Wild keeps its full version. `never` removes it even from Wild. It replaces the old `chaos.wild.wallClimbing` toggle so one thing is never controlled in two places; the Wild card shows a link to this control.
- **Roam range, kept simple:** one two-thumb slider drawn over a small taskbar picture, plus three preset chips: "Whole width" (0-100), "Clear of the clock" (0-85) and "Left side" (0-45, which also keeps him clear of a centred Start button and the pinned icons). Stored as percentages so it survives resolution and DPI changes (9.4). Rules:
  - Wander targets, resting spots, the novelty bins (6.5), the stash, critter stalking and the toolbox peek are sampled only inside the range. Screen-edge behaviors (`edge_peer`, `edge_hide`, `wall_climb`, `wall_bump`) happen only at an edge the range touches; otherwise the range ends act as soft walls he turns at (no bonk).
  - Drags, throws, falls and fullscreen can leave him outside it. He then walks back in before his next ground behavior (`return_to_range`, no mood penalty).
  - Window perches are not limited by the range (the perching toggle governs them), but `jump_down` aims to land inside it.
  - Items the user places outside the range stay there. He ignores them unless he is dropped onto one, then walks back in.
  - "Bring Earl back" puffs him to the in-range spot nearest the tray.
- **Brain wiring:** every behavior declares the zones it enters. A behavior whose zone is disallowed gets **zero utility** (a hard gate before the softmax and the ε pick, not a penalty), and whims never target a disallowed zone (7, "Zone gates"). User actions still win: dropping him onto a window with perching off makes him hop straight down.
- **Rationale:** Cameron's answer to Q1 ("settings that change where he is allowed to wander"). Five controls, each a plain yes/no or a short choice, keep it understandable; everything finer stays in tuning.

### Architecture

**D13 One full-monitor overlay.**
- Label `overlay`, covering `rcMonitor` of the primary monitor.
- Created once and never resized for gameplay.
- Physical px in Rust; overlay-local CSS px on the wire.
- Rationale: it removes v1's expand/shrink races, and perching, parachutes and items need the whole screen anyway.
- **Gated by the M0.4 spike.** A monitor-sized topmost window can force DWM composition over borderless-fullscreen video and games (losing independent flip and MPO) and costs GPU at idle. M0.4 measures both. If either fails, the overlay becomes a bottom-band or entity-bbox-sized window and the renderer's viewport origin (already in the render API from M1.0) absorbs the offset; world coordinates do not change. The same fallback may be applied only while an `app` fullscreen is up.
- The overlay's top edge sits 1 physical px below `rcMonitor.top` (the bottom is unchanged, so the "very bottom" floor is exact). No shell heuristic can then classify it as a monitor-covering window.

**D14 Rendering: layered, not one full-screen canvas.**
- **Primary mode `layers`:** each drawable group gets its own small DPR-correct `<canvas>`, moved with `transform: translate3d` at device-pixel-snapped positions. The groups are Earl, each item, each duckling, the parachute, bubbles and the particle field.
- A canvas repaints only when its content signature changes. Movement is compositor-only.
- A layer canvas repaints only when its frame id, flip or DPR size changes. Squash and stretch, tilt, spin and breathing are a CSS `transform` about the anchor (`transform-origin`), and occlusion is a CSS `clip-path` on container elements (5.10), so procedural motion and clip changes cost no repaint.
- **The renderer mode is decided once, in the M0.4 Windows spike** (layers against a single full-monitor canvas with dirty rects). Only the chosen mode is built; there is no dual-mode requirement in M1.
- Rationale: the platform specialist showed that a full-screen canvas reports full-screen damage every frame, and the sim specialist flagged the same cost as unverified. Measuring before M1.0 avoids building two renderers.

**D15 React in the overlay only for UI chrome.**
- The toolbox drawer and item context menu are a React root, lazily imported on first open.
- The sim, renderer and bubbles never touch React.

**D16 Simulation is pure TS under `src/sim/**`.**
- This covers core, physics, env, anim, brain, items, chaos and metrics.
- No DOM, Tauri, `Math.random` or `Date.now`. Enforced by a separate `src/sim/tsconfig.json` with `lib: ["ES2022"]` (no DOM, so DOM globals are type errors), ESLint `no-restricted-imports` (Tauri, React, `src/render`, `src/overlay`), `no-restricted-globals` (window, document, performance, Date) and `no-restricted-properties` (`Math.random`), all scoped to `src/sim/**`. There is no text grep (it would match the sim's own `windowId` vocabulary).
- Seeded sfc32 with split streams (`physics`, `brain`, `anim`, `particles`, `items`, `swarm`).
- **Production seeding:** `overlay/boot.ts` (outside the pure zone) seeds from `crypto.getRandomValues` on every launch, so autostart mornings never replay the same first minutes. The seed is written into diag dumps so traces stay replayable.
- Registries built with `import.meta.glob` are also emitted as generated index files by the same codegen step as `sprites.gen.ts`, and `npm run sim` runs through `vite-node`, so the pure zone works under plain Node.
- Rationale: deterministic tests and time-accelerated simulation.

**D17 Brain design.** A layered utility AI:
- reflex > direct user action > reaction > autonomous > fidget;
- behaviors as generator coroutines;
- a five-affect spring-with-noise engine that runs in both mood modes;
- a relationship model saved to disk.

  Rationale: the brain specialist's analysis. Behavior trees, planning and bigger FSMs are rejected.

**D18 Naming.** There are three separate namespaces, joined only by tables in code:
- **Behavior ids:** snake_case (`slip_behind_taskbar`), in `src/sim/brain/behaviors/**`.
- **Clip names:** short snake_case (`walk`, `peek_bob`), one file per owner in `src/sim/anim/clips/<behavior-or-item>.ts`, globbed into a registry (no single hot `clips.ts`). Speech lines (`brain/speech/<category>.ts`), per-behavior tuning (next to each behavior file) and audio cues (`audio/cues/<kind>.ts`) are split and globbed the same way.
- **Art shot ids and frame ids:** `earl_<pose>_<nn>`, `baby_*`, `prop_*`, `acc_*`, `icon_*`, from the art shot-list. They are canonical and generate the `FrameId` TS union.

  The brain's working pose names (`idle_front`, `peek_over`...) and the toolbox specialist's item file names (`bread_4.png`) are retired in favour of shot ids.

**D19 Art format.**
- Cameron delivers PNGs on flat magenta #FF00FF.
- `scripts/art.mjs` keys, aligns and writes 512 px masters (committed, with `.gitattributes` marking `*.png` binary).
- **Keyer:** a soft key with despill, not a threshold. Alpha comes from the distance to #FF00FF in a chroma space; colour is unmixed as `c' = (c - (1-a)*key)/a`, clamped; any residual pixel where R and B both exceed G is clamped to its nearest interior colour; a 1 px alpha erosion runs only for shots flagged `fringy`. In the `v1-faithful` profile (D20) alpha is then hard-thresholded at 128. `art:check` fails any pixel with alpha > 0 whose magenta-hue ratio exceeds a threshold, and a golden-image test runs the keyer on a synthetic anti-aliased circle on magenta.
- The build exports **two levels per page, 256 and 512 px**, into lazily-loaded atlas pages (`core`, `duck2`, `props`, `baby`, `ui`). `spriteCache` picks the smallest level that is at least `displaySize*dpr`, so a 256 px Earl at 150% or 200% scaling is never upscaled.
- It also generates the typed module `src/sim/anim/sprites.gen.ts` holding frames, anchors, attach points, pose class, prop footprints and attach lines (measured from each prop's alpha bbox, 8.3) and 64x64 hit masks.
- **Generated outputs are not committed.** `sprites.gen.ts`, the registry index files and the atlas pages are built from committed `art/shots.json` and `art/masters/` in `predev`, `pretypecheck`, `prebuild` and CI (deterministic, gitignored). This keeps regenerable files and binary atlas churn out of parallel workers' rebases.
- Rationale: the art specialist's pipeline, with the sim specialist's typed generated module replacing `manifest.json`. Atlas pages load one feature at a time, so the sim specialist's "no atlas" objection does not apply.

**D20 `[C]` (answered, Q2: gate confirmed as planned) Art style: a hard gate before Batch A.**
- Requirement 12 says the April sprites must be regenerated "in the original style", and the brief is "same duck". The originals (measured: about 2,400 colours at 128 px, hard 0/255 alpha, visible stair-stepped edges, a warm tan rim, **no dark outlines**) are a crisp look. The April sprites' dark outline, grey halo and larger framing are the defects in every profile.
- The pipeline supports two **style profiles**, selected per project in `art/shots.json`:
  - `v1-faithful`: hard alpha threshold, no anti-aliasing, the hard-edge warning disabled, T1 and STYLE LOCK worded "keep the crisp sprite edges".
  - `smooth`: anti-aliased soft plush illustration at 256, same shapes, palette and own-colour rims, T1 worded "smooth clean edges".
- **No masters are generated until Cameron picks** (Q2). He approves the 4 masters in the lineup next to v1 at 64/96/256 before starting the rest. Props and canvas placeholders follow the chosen profile, always with own-colour rims, never black outlines.
- Rationale: the art specialist measured the originals; the coverage review showed that assuming the smooth style could cost Cameron 133 images in a style he never approved.

**D21 Mirroring.** Side poses are drawn facing right and flipped in code. All `*_left.png` files are deleted.

**D22 Settings.**
- Rust-owned and typed (in `earl-core`, so tests run on Linux), exported to TS with ts-rs into `src/shared/bindings/`.
- Changed by RFC 7396 merge patches, validated and clamped, then broadcast as `settings://changed {rev, settings}`.
- **No setting uses JSON null as a value.** "Off" for a hotkey is `{enabled:false, accel}` (the accelerator is remembered), and `settings_patch` rejects null for every non-removable key, so a merge-patch null can never delete a key and silently restore its default.
- **One load path:** start from `Settings::default()` (the schema defaults), then apply the file's JSON as a patch through the same per-field `validate()` that `settings_patch` uses, dropping and logging each field that fails. A garbage `sound.volume` therefore becomes the schema default 35, never 0. There is no `T::default()`-based lenient deserializer.
- The **whole v2 schema is frozen in M1.0**, so later milestones never edit it.

**D23 Runtime state.**
- `state.json` is separate from `settings.json`.
- The brain's affect, needs, relationship and memory go in an opaque, TS-versioned blob (`brain`). Items, stats, position and onboarding are typed in Rust.
- **The overlay** sends `state_put` on each meaningful change (affect tier change, relationship change, need crossing a 5-point step, item change, episodic entry), with no JS-side debounce. Per-frame values are never "meaningful".
- **Rust** coalesces disk writes to at most once per 5 s while dirty. On `ExitRequested`, `WM_QUERYENDSESSION`, lock, suspend and before an update installs, Rust emits `state://flush-request`, waits up to 300 ms for a final `state_put` and `stats_add`, then writes synchronously. Atomic tmp+rename writes, with `.bak` files.

**D24 Hit testing.**
- Rust owns regions: rect + 64x64 1-bit mask (from the build, sent once) + an affine `{scaleX, scaleY, angle, pivot}` + clip rects.
- **Proximity-gated precision:** while the cursor is far, JS sends only a padded coarse rect at most 2 Hz; exact masked regions at up to 30 Hz only after Rust reports `pointer://near` (4.3).
- A dedicated pointer thread with an adaptive 8-100 ms poll on a high-resolution waitable timer.
- Click-through toggles only on change, by the pointer thread posting `WM_APP_SETHIT` to the overlay subclass, which flips only `WS_EX_TRANSPARENT`. tao's `set_ignore_cursor_events` is never called after init (4.1).
- Capture is latched in Rust on the button-down edge, with no JS round trip (4.3).
- Dead-man switch at 2 s; capture watchdog at 300 ms; a hung-overlay watchdog restarts the app (4.3).

**D25 Taskbar, fullscreen and window change detection is event-driven.**
- Taskbar: hidden appbar registration (`ABN_*`), `TaskbarCreated`, `SPI_SETWORKAREA`. The auto-hide slide is tracked by a short 30 Hz poll of `Shell_TrayWnd`'s rect (400 ms after the cursor reaches the bottom edge or an `ABN_STATECHANGE`), never by an Explorer-wide LOCATIONCHANGE hook (the desktop is Explorer too, so that hook fires on every mouse move over it).
- Windows: only low-rate global WinEvent hooks. `LOCATIONCHANGE` is never hooked globally; it is hooked per process (`idProcess`) for the watched windows and the foreground window only (4.7).
- A 5 s resample is the only safety net.
- Rationale: the platform design. The delivery specialist's 4 Hz polling is rejected.

**D26 `[C]` (answered, Q5: yes) Typing detection, two tiers.**
- **Always-on coarse signal** `userBusy`: `GetLastInputInfo` changed while the cursor was still and no button was down. It feeds `watch_typing` and `greet_return`.
- **Precise signal:** a Raw Input keyboard sink (`RIDEV_INPUTSINK`) that **counts key-downs only** (Cameron's Q5 answer), never key identity. Autorepeat is filtered without knowing which key: a key-down (`RI_KEY_MAKE`) is counted only if at least one key-up has arrived since the last counted key-down, so a held key counts once. The sink keeps that one boolean and a counter, nothing else; fast rollover typing undercounts slightly, which is harmless for a burst threshold. It is registered only while `chaos.messes.honkOnTyping` is effectively on and Earl is visible, and it feeds `typing_honk`, capped at about 3 honks per hour (7.8, 6.11).
- **Earl-platform is the only raw-input owner in the process.** Raw input registration is per process per usage, and tao registers mouse and keyboard for its own window at startup. The app is built with `.device_event_filter(tauri::DeviceEventFilter::Always)` so tao unregisters. Registration and `RIDEV_REMOVE` happen only on the earl-platform thread, are redone after `TaskbarCreated` and resume, and a debug build asserts through `GetRegisteredRawInputDevices` that `hwndTarget` is ours.
- No `WH_KEYBOARD_LL` hook.
- Rationale: the coarse heuristic counts the scroll wheel as typing, which is harmless for "watch" but wrong for a honk. The raw sink never reads key identity, so the design pins that in a test and a review rule.

**D27 Cursor gag.**
- `SetCursorPos` driven from the pointer thread.
- Raw mouse input aborts on real user movement.
- Rust hard limits: at most 1200 ms, at most 300 CSS px, and at least 3 min apart.
- The brain adds its own limits: 80-200 px over 0.6-1.0 s, a 10 min cooldown, never within 2 s of typing, only after the cursor has been idle for at least 2.5 s, and always telegraphed for 0.8-1.5 s first (7.8).
- **Click shield:** during the gag and for 600 ms after it, Rust gives the overlay a small hit region under the cursor, so an accidental click lands on Earl ("hey!") and never on whatever app is now under the moved cursor. The path is horizontal-dominant and never ends over the taskbar rect or in the top 40 px of the monitor.
- Suppressed while a known meeting or screen-share app class is foreground (Teams, Zoom; class table in `earl-core`).

**D28 Distribution.**
- NSIS per-user installer only; app identifier kept as `com.threxai.earl`.
- Updater endpoint `https://github.com/cameron-cloud/earl/releases/latest/download/latest.json`, checked from Rust.
- Nothing downloads or installs without a click.
- Releases are drafts until Cameron publishes them.
- `v2-preview` is a rolling pre-release, used only by preview builds through `EARL_UPDATE_ENDPOINT`. The preview CI job sets the version to `2.0.0-preview.<run_number>` at build time (a semver prerelease sorts below 2.0.0, so the final release still upgrades), so preview N+1 is offered to preview N.
- **Two updater keypairs:** preview builds are signed with a separate preview key whose public key is compiled only into preview builds; the production key is available only to `release.yml` on `v*` tags.
- **Code signing (Q9 answered: assume default security settings).** Smart App Control on a fresh Windows 11 install is in Evaluation and can block unsigned installers outright, so Azure Trusted Signing is set up in M0.2 and signs every CI build, including previews and the updater NSIS.

**D29 Fresh install, but migration code still ships.** Juliette's machine may hold a v1 `config.json`, since the identifier is the same. v2 migrates once:
- size, sound and stats carry over;
- the real first-launch date is recovered by inverting v1's fake calendar;
- the old file is renamed to `config.v1.bak.json`;
- **he remembers her:** a found v1 config skips `first_meeting` and plays the `reunion` variant instead, and fondness is seeded at `0.55 + 0.1*min(1, daysSinceFirstLaunch/180)` (buddy tier), trust at 0.55.

  The migration is ordered and idempotent (9.4). Rationale: it is cheap, and "Together since April 4, 2026" is worth keeping. A duck that has lived with her since April should not treat her as a stranger.

**D30 Single instance.** `tauri-plugin-single-instance` is registered first. A second launch shows Earl and opens Settings.

**D31 Branching.**
- Integration branch `v2`; work branches `feat/<unit>-<slug>`, one tx-spawn worktree each.
- `master` stays at v1.0.0 for hotfixes.
- Registries are built with `import.meta.glob`, so adding a behavior or item means adding a file.

**D32 Sandbox mocks at the IPC layer.**
- `mockIPC` + `mockWindows`, backed by a fake desktop, so the real `src/platform/tauri.ts` adapter runs in the sandbox.
- If Tauri `Channel` mocking proves awkward, the mock delivers channel messages by calling the channel's `onmessage` directly.
- **The IPC contract is machine-checked,** because `mockIPC` bypasses Rust signatures and the capability ACL. `cargo test` exports `src/shared/bindings/commands.json` (command name, argument names and types after Tauri's camelCase conversion, return type, allowed windows). The TS facade's types and the sandbox mock's handler table type are generated from it, and a test checks `capabilities/*.json` against its "allowed windows". A Linux CI job (`ipc-contract`) builds the real app with `platform/stub`, runs it under xvfb, and a test page in each window invokes every command and listens to every event, failing on any "not allowed" or deserialization error.

**D33 `[C]` (accepted default, Q11) New dependencies**, explained here per CLAUDE.md:

| Kind | Dependency | Why |
|---|---|---|
| npm, dev | `vitest` + `@vitest/coverage-v8` | Test runner on the existing Vite config |
| npm, dev | `fast-check` | Property fuzzing of the sim |
| npm, dev | `@playwright/test` | Sandbox e2e and screenshots; chromium is already cached |
| npm, dev | `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks` | Lint. rules-of-hooks would have caught the v1 Settings crash |
| npm, dev | `prettier` | Formatting |
| Rust | `windows` 0.61 | Win32 bindings, same version tao already pulls in |
| Rust | `ts-rs` | TS types from Rust structs |
| Tauri plugins | `single-instance`, `global-shortcut`, `log` | Already has `autostart`, `updater` |
| CI tools (not app deps) | `cargo-audit`, Dependabot (npm, cargo, actions), `npm audit --audit-level=high` | Dependency CVE checks; the last v1 commit was a Vite CVE fix |

Thread queues, locks and the hit-region table use `std::sync::{mpsc, Mutex, Arc, Condvar}` (the region table is `Mutex<Arc<Regions>>`, updated at most 30 times a second and uncontended). `arc-swap`, `parking_lot` and `crossbeam-channel` are not added unless a Windows profile shows contention.

**Removed:** `pngjs`, `dirs`, `@tauri-apps/plugin-updater` (the JS side), `@tauri-apps/plugin-process`.

**D34 `[C]` (open, Q10) Server tools.** `rustup component add clippy rustfmt`, the `x86_64-pc-windows-msvc` target, `cargo-xwin`, and `clang lld llvm` for cross-checking Windows code on Linux. The Windows CI job is the fallback.

---

## 3. Architecture overview

```
+---------------------------------------------------------------------------------------------+
| RUST (src-tauri)                                                                            |
|                                                                                             |
|  earl-core (pure, cargo test on Linux)                                                      |
|    geom  taskbar::classify  fullscreen::classify  surfaces  hit  gag  typing                |
|    settings{schema,validate,patch,migrate}  state                                           |
|                                                                                             |
|  main thread (tao/WebView2): overlay window + subclass (LAYERED|TOOLWINDOW|NOACTIVATE        |
|                              permanent; WM_APP_SETHIT flips TRANSPARENT; rect lock)         |
|                              panel window (unowned, normal), tray, global hotkey            |
|  earl-platform thread: hidden top-level window + message loop                               |
|     appbar ABN_*, TaskbarCreated, WM_SETTINGCHANGE/DISPLAYCHANGE, WinEvent hooks,           |
|     raw input (kbd count / mouse abort), WTS lock, power, coalescing timers, EnumWindows     |
|  earl-pointer thread: GetCursorPos adaptive 8-100 ms -> hit(regions) -> post WM_APP_SETHIT  |
|     capture latch, far-field cursor events, near-only stream, gag driver, hang watchdog     |
|  tokio: store (settings.json/state.json atomic), updater, diag                              |
+-------------------------------------------+-------------------------------------------------+
        commands (async, never block UI)    |   events / channels (only on change)
  platform_init  hit_register_masks         |   platform://geometry  platform://ground
  hit_set_regions  hit_capture              |   platform://activity  pointer://hover|near|outside-down
  pointer_subscribe  surfaces_subscribe     |   Channel<CursorSample>  Channel<SurfacesMsg>
  surfaces_watch  gag_cursor_start|stop     |   surfaces://moved|gone  gag://ended  typing://burst
  typing_enable  topmost_reassert           |   settings://changed{rev}  state://stats
  settings_get|patch|reset  state_get|put   |   earl://command  update://status  hotkey://status
  stats_add  autostart_*  update_*  panel_* |   panel://navigate
+-------------------------------------------+-------------------------------------------------+
| OVERLAY WEBVIEW (overlay.html, no React on the hot path)                                    |
|                                                                                             |
|  platform/tauri.ts (adapter)  ->  overlay/boot.ts                                           |
|                                    |                                                        |
|   overlay/input.ts (pointer gestures) -> sim/  <- platform snapshot (env, surfaces, cursor)  |
|                                                                                             |
|   sim/ (pure, fixed 60 Hz):  env -> physics -> items -> brain(tick) -> intents -> locomotion |
|        anim player -> events ring buffer -> audio / render / stats / persist                 |
|                                    |                                                        |
|   render/ (mode chosen in M0.4; layers: small canvas per drawable, CSS transform + clip-path)|
|   overlay/hitShapes.ts (far: coarse rect <= 2/s; near: masks <= 30/s)   audio/ (Web Audio)   |
|   overlay/ui/ (React, lazy): ToolboxDrawer, ItemContextMenu                                 |
|   overlay/scheduler.ts  ACTIVE (rAF, every n-th vsync near 60) | IDLE (setTimeout) | PAUSED |
+---------------------------------------------------------------------------------------------+
| PANEL WEBVIEW (panel.html, React): Settings tabs + About, useSettings() with rev guard      |
+---------------------------------------------------------------------------------------------+
```

### Module layout: `src/`

```
src/
  app/            overlay-main.ts (no React), panel-main.tsx
  platform/       types.ts (Platform interface, DesktopEnv, CursorSample, Surfaces), tauri.ts
  shared/         bindings/ (ts-rs, generated)  ipc.ts  events.ts  settingsStore.ts  deepPartial.ts
  sim/            PURE ZONE (lint-enforced)
    core/         world.ts  loop.ts  rng.ts  clock.ts  types.ts  events.ts  intent.ts  params.ts
    env/          env.ts (DesktopEnv -> floor/walls/occluders, debounced transitions)  taskbarLane.ts
    physics/      body.ts collide.ts surfaces.ts forces.ts pendulum.ts parachute.ts locomotion.ts reach.ts
    input/        gestures.ts (click/hold/drag/throw/stroke classification, LSQ velocity)
    anim/         clips/<owner>.ts (globbed) animator.ts blink.ts procedural.ts frames.ts
                  sprites.gen.ts (GENERATED at build, gitignored)
    brain/        index.ts context.ts perception.ts affect.ts needs.ts relationship.ts memory.ts
                  episodic.ts whims.ts attention.ts causes.ts arcs.ts (honeymoon, tier scenes)
                  utility.ts selector.ts reactions.ts fidget.ts speech.ts speech/<category>.ts
                  tuning.ts debug.ts
                  behaviors/types.ts behaviors/registry.ts (import.meta.glob)
                  behaviors/<category>/<id>.ts   (one file per behavior)
    items/        itemDefs.ts registry.ts (glob) <kind>.ts affordances.ts wind.ts water.ts
    chaos/        wild.ts episodes.ts pranks.ts swarm.ts physicsParty.ts effective.ts
    critters.ts   particles.ts  persist.ts  stats.ts
    metrics/      trace.ts metrics.ts
  render/         renderer.ts layers.ts canvasMode.ts atlas.ts spriteCache.ts clip.ts
                  drawEntity.ts bubbles.ts hud/needs.ts debug.ts
                  fx/ (particles, shadow, strings)  props/ (canvas placeholders per prop)
  audio/          engine.ts voice.ts voices/*.ts cues/<kind>.ts
  overlay/        boot.ts scheduler.ts input.ts hitShapes.ts ui/ToolboxDrawer.tsx ui/ItemContextMenu.tsx
  panels/         settings/{SettingsApp,Header,Sidebar}.tsx sections/*.tsx controls/*.tsx theme.css
                  about/{StatsGrid,Hearts,EarlPortrait}.tsx shared/UpdateCard.tsx
  assets/atlas/   GENERATED atlas pages (*.png, 256 and 512 levels), gitignored
sandbox/          index.html main.ts mockIpc.ts fakeDesktop/*.ts devHud/*.tsx lineup.ts scenarios/*.json
test/             sim/*.test.ts scenarios/*.ts traces/physics-*.golden.json (physics only)
                  baselines/behavior-metrics.json (hot file: M2.6 and integration units only)
e2e/              playwright.config.ts *.spec.ts
scripts/          art.mjs art/lib/*.mjs check-dashes.mjs sim.ts gen-animations-doc.mjs bump-version.mjs
art/              shots.json SHOTLIST.md(gen) reference/v1/ inbox/(ignored) masters/ templates/(ignored) out/(ignored)
```

### Module layout: `src-tauri/`

```
src-tauri/
  Cargo.toml       [workspace] members = [".", "core"]
  build.rs         AppManifest command allow-list
  capabilities/    overlay.json  panel.json
  icons/           generated by `tauri icon` + tray_32.png (RGBA)
  core/src/        lib.rs geom.rs taskbar.rs fullscreen.rs surfaces.rs hit.rs gag.rs typing.rs
                   settings/{mod,schema,validate,patch,migrate}.rs state.rs
  core/tests/fixtures/*.json   (real Windows snapshots from diag dumps)
  src/
    main.rs lib.rs app_state.rs events.rs store.rs overlay.rs panels.rs tray.rs hotkey.rs
    updater.rs autostart.rs
    commands/{mod,platform,settings,state,system,diag}.rs
    platform/mod.rs (Platform facade + trait PlatformBackend)
    platform/windows/{mod,thread,overlay_style,monitor,taskbar,fullscreen,windows_enum,
                      winevents,pointer,cursor_gag,rawinput,session,vdesk,diag}.rs
    platform/stub/mod.rs  (fake 1920x1080@1.0, 48 px bottom taskbar; EARL_FAKE_PLATFORM replay)
```

**Deleted in v2:**
- `src/hooks/*`, `src/engine/*`, `src/components/*`, `src/App.tsx`, `src/utils/{config,updater}.ts`
- both `sprites.json` files, `assets/`, `process_sprites.mjs`, `scripts/fix-sprites.mjs`, all `*_left.png`
- the constants `WINDOW_HEIGHT`, `TASKBAR_HEIGHT`, `SPRITE_SOURCE_SIZE`, `HOP_OFFSETS`
- the Rust commands `expand_window`, `shrink_window`, `update_hit_test`, `get_taskbar_state`, `set_ignore_cursor_events`, and the raw FFI at `commands.rs:19-24,73-96`

---

## 4. Platform layer design

### 4.1 Overlay window

**tauri.conf.json:** `label:"overlay"`, `visible:false, transparent:true, decorations:false, shadow:false, resizable:false, alwaysOnTop:true, skipTaskbar:true, focus:false, dragDropEnabled:false`.

**Setup before `show()`:**
1. Find the primary monitor with `MonitorFromPoint({0,0}, MONITOR_DEFAULTTOPRIMARY)`, then `GetMonitorInfoW` (rcMonitor, rcWork) and `GetDpiForMonitor(MDT_EFFECTIVE_DPI)`.
2. `set_position` / `set_size` with **Physical** values. This fixes `lib.rs:43-46`, which passes a physical position as logical and uses `current_monitor()` instead of the primary.
3. Install a `SetWindowSubclass` that handles:
   - `WM_STYLECHANGING` (GWL_EXSTYLE): always OR in `WS_EX_LAYERED|WS_EX_TOOLWINDOW|WS_EX_NOACTIVATE`, clear `APPWINDOW`, and set or clear `WS_EX_TRANSPARENT` from the `hittable` atomic. Whoever writes the style, the result is ours.
   - `WM_APP_SETHIT(on)`, posted by the pointer thread: store `hittable`, then `SetWindowLongPtrW(GWL_EXSTYLE)` toggling **only** `WS_EX_TRANSPARENT`, with no `SWP_FRAMECHANGED` and no `ShowWindow`.
   - `WM_MOUSEACTIVATE`: return `MA_NOACTIVATE`.
   - `WM_ACTIVATE` with `WA_ACTIVE` or `WA_CLICKACTIVE` (WebView2's cross-process child HWNDs can call `SetFocus` themselves): immediately `SetForegroundWindow((HWND)lParam)`, the window being deactivated (allowed, since we are foreground at that instant), and return.
   - `WM_WINDOWPOSCHANGING`: force the desired rect, held in an atomic.
   - `WM_APP_SHOW(on)`: `ShowWindow(SW_SHOWNOACTIVATE | SW_HIDE)`.
4. Set the permanent ex-style once, post `WM_APP_SETHIT(false)`, then `WM_APP_SHOW(true)`.

**tao is never asked to touch the overlay's styles after init.** In tao 0.34.8 every flag change runs `WindowFlags::apply_diff`, which calls `ShowWindow` (SW_SHOW unless a stale `MARKER_DONT_FOCUS` copy survives from `focus:false`), rewrites the whole ex-style, calls `SetWindowPos(SWP_FRAMECHANGED)`, and drops `WS_EX_LAYERED` whenever input is accepted. That means focus theft, a re-created layered redirection surface (flicker) on every hover, and a non-layered monitor-sized window while hittable, which Chromium's native occlusion tracker in Chrome, Edge, Teams, Discord and VS Code treats as opaque, throttling their video and rAF. So after init the code never calls Tauri `set_ignore_cursor_events`, `show()`, `hide()` or `set_always_on_top` on the overlay; all of that goes through the subclass. `focus:false` stays in the config and a config test pins it.

**Focus:** `NOACTIVATE`, `MA_NOACTIVATE` and the `WM_ACTIVATE` hand-back mean clicking Earl never steals focus from the app you are typing in. If the overlay ever became foreground, Explorer would treat it as a monitor-covering fullscreen app (taskbar drops, `ABN_FULLSCREENAPP`, Focus Assist), which would flip Earl's own ground mode; the 1 px top inset (D13) is a second guard against that.

**Hang safety:** `run()` calls `DisableProcessWindowsGhosting()` first, so Windows never replaces a hung monitor-sized overlay with a desktop-blocking "Not Responding" ghost. See the hang watchdog in 4.3.

**Topmost policy:**
- **How:** `SetWindowPos(HWND_TOPMOST, NOMOVE|NOSIZE|NOACTIVATE|NOOWNERZORDER|ASYNCWINDOWPOS)` from the platform thread. `set_always_on_top(true)` is a no-op when the flag is already set, so it is not used for this.
- **When:** only on drag start and on entering an `app` fullscreen, plus on toolbox open **only if no shell popup is visible**. There is no reassert on a foreground change to `Shell_TrayWnd`: that is exactly when jump lists, thumbnail previews, the tray overflow, taskbar context menus and the clock and quick-settings flyouts open above the taskbar edge where he peeks.
- **Shell popups and other topmost windows are occluders.** Whenever a visible top-level window of the 4.7 shell class list (`TaskListThumbnailWnd`, jump lists, `TopLevelWindowForOverflowXamlIsland`, `NotifyIconOverflowWindow`, `Windows.UI.Core.CoreWindow` flyouts, `XamlExplorerHostIslandWindow`, `#32768`, `tooltips_class32`), or any topmost window from another process, overlaps Earl, its rect joins his clip and hit-clip list, so he renders and hit-tests as if behind it. While one is open over the behind lane he also ducks to sink 1.0. The detection reuses the low-rate `OBJECT_SHOW/HIDE` hooks.
- **Limits:** at most once per second. If another window keeps reasserting (more than 5 times a minute), stop, to avoid a topmost war.

**Virtual desktops:** `WS_EX_TOOLWINDOW` should show him on all desktops **(W)**. Fallback: `IVirtualDesktopManager::MoveWindowToDesktop` on `EVENT_OBJECT_CLOAKED` of our own hwnd (visible to us because the hooks no longer skip our own process, 4.7).

**WebView2 settings (both windows):**
- One `BROWSER_ARGS` constant in Rust is applied to the overlay and the panel, because every webview sharing the user-data folder must use identical args and Chromium honours only the last `--disable-features`: `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection[,CalculateNativeWinOcclusion] --autoplay-policy=no-user-gesture-required`. It restates wry's defaults, which `additionalBrowserArgs` would otherwise replace. A test asserts both builders use the constant. The occlusion flag is added only if W13 shows throttling.
- `contextmenu` is prevented in a capture listener in both entries, and via `with_webview` release builds set `AreDefaultContextMenusEnabled=false` and `AreBrowserAcceleratorKeysEnabled=false` (no Reload, Print or Inspect; right-click is "pet").
- Via `with_webview`, `ICoreWebView2::add_ProcessFailed` is subscribed. On a renderer or browser exit the overlay is reloaded (or the app relaunched through the single-instance path), and the world restores from the last `state_put`.

**Panel window (D9):**
- Created **without** `.parent()`: an unowned, normal, activatable top-level window, 640x600, min 520x480, native decorations, not topmost, with a taskbar button.
- While visible and above Earl in z-order, its rect is an occluder for him (4.7); he may still perch on its top edge.
- Destroyed on close, which frees about 30 MB.
- Tray "About Earl" opens it at the About tab, or emits `panel://navigate` if it is already open.

**Screen capture privacy:** `general.hideFromScreenCapture` (default off) calls `SetWindowDisplayAffinity(overlay, WDA_EXCLUDEFROMCAPTURE)` (Win10 2004+), so Earl does not appear in Teams or Zoom screen shares and screenshots. **(W)** verify on a layered window.

### 4.2 Coordinates and DPI

- Tao sets Per-Monitor-v2. Assert it at startup on every thread.
- Rust holds `Space {origin_phys, scale}`. `platform_init` takes `{innerWidth, innerHeight, devicePixelRatio}` from JS, and Rust derives `scale = physWidth/innerWidth`, logging a diag warning when that differs from `GetDpiForWindow/96` (text scaling or a WebView2 zoom mismatch would otherwise shift every hit rect and the taskbar clip line). JS re-sends on `resize` and on `matchMedia` resolution changes.
- All IPC uses overlay-local CSS px (float). JS never sees physical px.
- `WM_DPICHANGED`, `WM_DISPLAYCHANGE` and `SPI_SETWORKAREA` all trigger the same sequence: recompute the primary monitor, re-apply the rect, rebuild `Space`, emit `platform://geometry`, then emit `platform://ground`.
- World positions are stored as a floor-relative `xFrac` plus a surface id, so a resolution change re-lays everything out cleanly.
- **Secondary monitors:**
  - Out of scope. Monitor edges are walls, and windows that straddle into the primary are clipped to it.
  - A cursor off the primary monitor is `onScreen:false`. Earl looks toward the edge where it left.

### 4.3 Click-through and hit testing

**`hit_register_masks(raw)`**
- Called once at atlas load, and again on art hot-reload in dev.
- Format: `{id:u32, w:u16, h:u16, bits}` little-endian. The 64x64 masks come from the build, already dilated by 1 cell.

**`hit_set_regions({seq, precision: coarse|exact, regions:[{id, kind: earl|item|duckling|ui|bubble|menu|shield, rect, mask?:{maskId, flipX}, xf?:{scaleX, scaleY, angle, pivot}, clip:[rect...]}]})`**
- Pushed from `overlay/hitShapes.ts` after quantizing to 1 CSS px and diffing.
- **Proximity-gated precision:**
  - **Far** (the cursor outside `nearRadius`, default 6 body lengths): JS sends only one padded coarse rect per entity group (the bbox inflated by `nearRadius` plus the farthest he can travel in 500 ms), at most 2 Hz and only when it changes. No masks, no per-step pushes.
  - **Near** (after Rust emits `pointer://near {near:true}`): exact masked regions at up to 30 Hz, sent immediately when a clip or mask changes.
  - Budget: 0-2 IPC/s whenever the cursor is far, whatever Earl is doing.
- Stored in a `Mutex<Arc<Regions>>`.

**Hit rule:** the point, inverse-transformed through `xf` about `pivot` (6 multiplies, so squash, tilt and tumble spin never leave holes over his body or dead zones over transparent corners), is inside `rect`, AND (there is no mask OR the mask bit is set), AND it is inside no `clip` rect. So:
- Earl's hidden body behind the taskbar never blocks taskbar icons.
- Transparent corners of a 256 px Earl never block desktop icons.
- In any fullscreen state Earl's region is present but flagged `armOnHover`: it is not hittable until the cursor has rested inside it for 600 ms (D6).

**Pointer thread:**
- **Timer:** a `CreateWaitableTimerExW(CREATE_WAITABLE_TIMER_HIGH_RESOLUTION)` loop (not `timeBeginPeriod`), so 8 ms really is 8 ms and not the default 15.6 ms tick.
- **Poll interval:** `clamp(dist_to_nearest_region / 6 px/ms, 8, 100) ms`. It is 8 ms during capture or a gag, 16 ms while the toolbox or a context menu is open (so short outside clicks are not missed), and a Condvar wakes it on every region push.
- **Buttons:** `VK_LBUTTON` and `VK_RBUTTON` are mapped through `GetSystemMetrics(SM_SWAPBUTTON)`, so left-handed users get the right semantics.
- **Transitions only:** click-through changes only when the hit state changes, by posting `WM_APP_SETHIT(on)` to the overlay (4.1); an `AtomicBool` guards against redundant posts. Each change emits `pointer://hover {regionId|null}`.
- **Capture latch (no JS round trip):** when the pointer thread sees a button-down edge while the cursor is inside a region, it sets `captured=true` and holds the overlay hittable until that button's up edge, however fast the cursor leaves his mask. `hit_capture(bool)` from JS only extends or ends the latch. The 300 ms capture watchdog applies only when no button is physically down.
- **Far-field cursor semantics live in Rust as events,** not as a raw stream: `pointer://near`, `pointer://startle {speed}` (a fast approach over 1500 px/s within 3 body lengths), `pointer://parked {x,y}` (still for 1 s within `nearRadius`), `pointer://left-monitor {edge}`, `pointer://above {x}` and `pointer://outside-down {x,y}` (coordinates only; the brain may glance there, 6.9).
- **Raw cursor stream:** `pointer_subscribe(Channel<CursorSample{x,y,onScreen,buttons}>, hz)`, subscribed only while near, chasing, fleeing, gagging or stroke-detecting, at 30 Hz, and only on movement of 2 px or more. It is unsubscribed otherwise.
- **Invariant:** the overlay takes input only over a visible region, or during a latched capture.
  - **Dead-man switch:** no region push or heartbeat for 2 s empties the regions.
  - **Capture watchdog:** capture with no button down for 300 ms is dropped.
  - **Hang watchdog:** while hittable, the pointer thread pings the overlay with `SendMessageTimeoutW(WM_NULL, SMTO_ABORTIFHUNG, 1500 ms)`. On failure it spawns `earl.exe --recovered` (single-instance hands off) and calls `ExitProcess`, so a stalled main thread (WebView2 init, a debugger, a long synchronous call) can never leave a hittable monitor-sized window behind.
- Hit testing is **never** paused, not even in flight. Earl can be caught mid-air.

### 4.4 Drag

1. `pointerdown` over Earl or an item does nothing yet in the sim, but Rust has already latched capture on the button-down edge (4.3), so a fast flick that leaves his mask within a frame is never lost.
2. **Pickup** starts after 6 CSS px of movement or a 200 ms hold. At that point JS calls `setPointerCapture`, then `hit_capture(true)` (extends the latch), then `topmost_reassert()`.
3. **Click** is a release within 250 ms and under 6 px.
4. `pointerup`, `pointercancel` or `lostpointercapture` calls `hit_capture(false)`.
5. `clientX/Y` are world coordinates, with no expand and no y fix-up.
6. The same flow drags items out of the toolbox.
7. Right-click never opens a browser context menu (4.1); it is "pet".

### 4.5 Taskbar, ground and peek-behind (Cameron's current request)

Earl's home ground is `floorY`: the taskbar's top edge when a bottom taskbar is present, otherwise the screen bottom (D1). The behind lane is a sim-side depth below that edge (5.6); Rust only supplies the geometry.

**Sampling** (`platform/windows/taskbar.rs`):
- `ABM_GETTASKBARPOS` (edge, rect)
- `ABM_GETSTATE & ABS_AUTOHIDE`
- `FindWindowW("Shell_TrayWnd")`, then visibility and the current `GetWindowRect` (the slide position)
- `rcWork`
- the fullscreen state (4.6)

**Classification** (`earl-core::taskbar::classify`, pure):
```
present = fullscreen == none && visible && on primary && !autohide && visible_thickness >= 8 phys px
if present && edge == BOTTOM : mode = "taskbar", floorY = tb.top          (measured, never 40/48)
else                         : mode = "screen",  floorY = rcMonitor.bottom
edge LEFT/RIGHT -> wall at the taskbar's inner edge + occluder; edge TOP -> ceiling + occluder
autohide revealed (slid in)  -> floor unchanged; taskbar.revealed rect = occluder only
```

**Event:** `platform://ground {mode, floorY, taskbar?:{rect, edge, autohide, revealed}, fullscreen: none|app|d3d|presentation}`.
- Emitted only on change.
- Mode flips are debounced 300 ms, so Alt+Tab never makes him fall twice.
- Auto-hide slide movement is not debounced: while it animates, the revealed rect is streamed at up to 30 Hz so the clip line tracks it.

**Change detection:**
- A hidden appbar registration: `ABM_NEW` with no `ABM_SETPOS`. It delivers `ABN_POSCHANGED`, `ABN_STATECHANGE` and `ABN_FULLSCREENAPP`. `ABN_FULLSCREENAPP` is delivered per monitor, so the earl-platform window is created positioned inside the primary `rcMonitor` (still hidden). It re-registers after `TaskbarCreated` or a display change, and `ABM_REMOVE` runs in the exit and panic hooks.
- `TaskbarCreated` (Explorer restarted), which re-registers and resamples.
- `SPI_SETWORKAREA` and `WM_DISPLAYCHANGE`.
- **Auto-hide slide:** only while the taskbar is auto-hide, a 30 Hz poll of `Shell_TrayWnd`'s rect for 400 ms after the cursor reaches the bottom edge (a far-field pointer event) or after `ABN_STATECHANGE`. No Explorer-wide LOCATIONCHANGE hook: the desktop (Progman/WorkerW) is Explorer, so such a hook fires on every mouse move over the desktop.
- A 5 s resample while visible, as a safety net.

**Behind the taskbar is fake occlusion** (JS side in 5.6):
- The renderer clips Earl at `y >= taskbar.top`.
- His hit region carries `clip:[taskbar.rect]`.
- The result is pixel-exact whichever topmost window is currently on top.
- Shell popups over the taskbar edge (jump lists, thumbnails, tray overflow, flyouts, context menus) are extra occluders while visible, and he ducks while one is open (4.1).

### 4.6 Fullscreen detection

`earl-core::fullscreen::classify` is pure. It runs on `EVENT_SYSTEM_FOREGROUND`, `ABN_FULLSCREENAPP`, and the foreground window's `LOCATIONCHANGE` (a hook scoped with `idProcess` to the foreground window's pid, re-scoped on every foreground change, 4.7).

**Classification steps:**
1. Take the foreground window. It is not fullscreen if it is null, our own pid, or `Progman`, `WorkerW` or `Shell_TrayWnd`.
2. It must be on the primary monitor.
3. Its rect (the larger of `GetWindowRect` and `DWMWA_EXTENDED_FRAME_BOUNDS`) must contain `rcMonitor`, and it must not be (`WS_CAPTION` && `IsZoomed`). Maximized windows count as maximized, not fullscreen.
4. `SHQueryUserNotificationState` plus the foreground class then classify it:
   - `QUNS_RUNNING_D3D_FULL_SCREEN` gives `d3d` (true exclusive mode only; most modern games are borderless or flip-model and land in `app`).
   - `QUNS_PRESENTATION_MODE` (Windows presentation settings), or a foreground class in the presenter table (PowerPoint `screenClass`, and a few other known slideshow classes), gives `presentation`. Class names only, never titles.
   - Anything else geometric gives `app`.

**Behavior by kind:**

| Kind | Behavior |
|---|---|
| `app` (F11, YouTube, borderless games) | Ground is the screen bottom. Earl stays visible (unless `general.fullscreen = hide`) but **display-only**: no hit region until hover-to-arm (600 ms rest on him, D6), so clicks on scrub bars, play controls and game HUDs under him reach the app. Items are hidden, or with `stayWithItems` stay visible and display-only under the same hover-to-arm rule. Topmost is reasserted once on entry. |
| `d3d` or `presentation` | If `hideInGamesAndSlideshows` ("Hide in exclusive games and slideshows") is on, the overlay is hidden and everything pauses. |

**In any fullscreen state:**
- hover-to-arm hit testing (above);
- no cursor gag, typing honk, swarm, speech or perching (perching has nothing to land on, D6);
- the roam range (D35) still applies along the screen bottom;
- volume x0.5;
- activity one step lower;
- wandering biased to the bottom corners (factor 0.7), or to the ends of the roam range when it does not reach a corner.

### 4.7 Window perching and occlusion (M3.5)

**Snapshot:** `EnumWindows` (in z-order), then filter.
- **Skip windows that are:** our overlay; invisible; iconic; cloaked; `TOOLWINDOW` without `APPWINDOW`; `WS_EX_TRANSPARENT`; smaller than 120x60 CSS.
- **Skip by class:** `Progman`, `WorkerW`, `Shell_TrayWnd`, `Shell_SecondaryTrayWnd`, `Windows.UI.Core.CoreWindow`, `XamlExplorerHostIslandWindow`, `TopLevelWindowForOverflowXamlIsland`, `NotifyIconOverflowWindow`, `tooltips_class32`, `#32768`, `ForegroundStaging`.
- **Read per window:** the rect from `DWMWA_EXTENDED_FRAME_BOUNDS`, `IsZoomed`, `DWMWA_WINDOW_CORNER_PREFERENCE` and the pid.
- **Never read** window titles.
- Keep at most 32 windows. Earl's own panel is included (he can perch on his settings, and it occludes him while above him, D9).
- **Shell popup list:** the class-skip list above is also used to detect visible shell popups and other-process topmost windows, which are sent as occluders (4.1), not as perches.

**Compute** (`earl-core::surfaces`, pure). Occluders for window i are windows 0..i-1 plus the taskbar.
- **`perch` segments:** the top edge minus the occluder x-ranges. Keep a segment only if it is at least 48 CSS wide, `T >= top+32`, `T < floorY-48`, and the window is not maximized.
- **`occluders`:** at most 16 rects within the band `[T-300, bottom]`.
- **`hideable`:** the window's bottom edge is below his eye line when he stands on the floor (feet may show under it), or he is perched on it. Replaces the old `touchesFloor` (bottom within 2 px of `floorY`), which only snapped windows met.
- **Ids:** `"{hwnd:x}-{gen}"`.
- **Payload:** `{rev, list:[{id, z, rect, kind, perch:[[x0,x1]], occluders, cornerRadius, hideable}]}`, diffed and pushed on the surfaces channel.

**Change detection:**
- **Global hooks, low-rate events only** (out-of-context): `FOREGROUND`, `MOVESIZESTART/END`, `MINIMIZESTART/END`, `OBJECT_SHOW/HIDE/DESTROY`, `CLOAKED/UNCLOAKED`. They do **not** skip our own process (so the panel's moves and the overlay's own CLOAKED event are seen); the callback filters the overlay hwnd explicitly.
- **`LOCATIONCHANGE` is never hooked globally.** It fires for every cursor move (`OBJID_CURSOR`), caret blink, scrollbar and progress bar, and every event is marshalled to our thread before any filter runs. Instead it is hooked with `idProcess` scoped to (a) the pid of each watched window (the one he is perched on or hiding behind) and (b) the foreground window's pid (for F11 detection), re-scoped on every foreground or watch change and removed when unneeded.
- The first statement of the callback filters to `OBJID_WINDOW` and `CHILDID_SELF`.
- **Watched ids** emit `surfaces://moved` or `surfaces://gone` immediately. `MOVESIZESTART` on the window he is perched on is emitted as `surfaces://grabbed` (the user started dragging it, 5.7).
- Everything else is coalesced to at most 10 Hz, followed by an `EnumWindows` resnapshot. A 2 s resync runs only while he is perched or hiding.
- Hooks other than FOREGROUND are installed only while perching (`earl.windowPerching` on, D35) or hide-behind-windows is effective and Earl is visible.
- **Budget:** a diag counter of WinEvent callbacks; fewer than 5 per second at steady state while moving the mouse continuously over the desktop and over a browser (M3.5 acceptance).

**Depth modes** (used by the sim):

| Mode | Clip |
|---|---|
| `Floor` | none; in front of all windows |
| `OnWindow(id)` | that window's occluders |
| `BehindWindow(id)` | the window's rect with rounded corners, plus its occluders |
| `BehindTaskbar` | the taskbar rect |

### 4.8 Chaos primitives (M4.3)

**Cursor gag:** `gag_cursor_start({path:[[x,y,tMs]], maxMs}) -> Ok(gagId) | Refused(reason)`.
- The pointer thread interpolates the path on its high-resolution timer, calling `SetCursorPos` every 8 ms, clamped to the primary monitor.
- **Refused if:** the setting is off; any button is down; a move/size loop is active; a capture is active; fullscreen is anything but none; the secure desktop is up; `SPI_GETSCREENREADER` is set; a meeting or screen-share app class is foreground; the cursor moved within the last 2.5 s; less than 3 min since the last gag; `maxMs` over 1200; path displacement over 300 CSS; the path ends over the taskbar rect or in the top 40 px; the path is not horizontal-dominant.
- **Click shield:** from gag start until 600 ms after it ends, Rust adds a `shield` region of about 24x24 CSS px under the cursor. A click in that window lands on Earl ("hey!"), never on the app under the moved cursor.
- **Aborts on:** real raw mouse input (registered only for the gag's duration, by earl-platform, the sole raw-input owner, D26), a drift of 3 phys px or more, or a `SetCursorPos` failure.
- Always emits `gag://ended {reason: done|user|button|limit|error}`.

**Typing:** `typing_enable(bool)` turns on the raw keyboard sink.
- It counts key-downs only (`RI_KEY_MAKE`), and only when a key-up has arrived since the last counted key-down (one `upSinceLastDown` boolean filters autorepeat without any key identity, D26), with a counter `fetch_add`.
- Burst detection: at least 5 key-downs in 1.5 s, at most one event per 2 s, suppressed in fullscreen. It emits `typing://burst {keysPerSec, sessionMs}`, where `sessionMs` is how long the current typing session has run (a session ends after 10 min without typing).
- A unit test pins the event struct. Review rule: no field named `key`, `vk` or `scan` in `rawinput.rs`.

**Busy signal:** implemented in **M1.1** (`session.rs`), not M4.3, because M2 behaviors need it: `platform://activity {locked, displayOn, userIdleMs, userBusy}` comes from `GetLastInputInfo`. It is sent only on threshold crossings (30 s and 5 min idle; busy on/off). Only raw input stays in M4.3.

### 4.9 Threads, commands, events

**Threads:**
- **main:** O(1) window operations only.
- **`earl-platform`:** a hidden **top-level** tool window, never shown, running a message loop. It must be top-level (not message-only) to receive broadcasts, and it is positioned inside the primary monitor for per-monitor appbar notifications (4.5). JS commands reach it through `std::sync::mpsc` plus `PostMessageW(WM_APP)`. It is the only raw-input owner (D26).
- **`earl-pointer`**.
- **tokio:** store, updater, diag.

**Rule:** every command is `async`. In Tauri v2 a synchronous command runs on the main thread.

**Commands** (types exported with ts-rs; the `src/platform/tauri.ts` facade is typed from the generated `commands.json` manifest, D32):

| Group | Commands | Allowed from |
|---|---|---|
| boot | `platform_init({innerWidth, innerHeight, devicePixelRatio}) -> {geometry, ground, settings, settingsRev, state, features}`, `viewport_changed({innerWidth, innerHeight, devicePixelRatio})` | overlay |
| hit | `hit_register_masks(raw)`, `hit_set_regions(r)`, `hit_capture(bool)`, `heartbeat()` | overlay |
| pointer | `pointer_config({nearRadius, events})`, `pointer_subscribe(channel, hz)`, `pointer_unsubscribe()` | overlay |
| surfaces | `surfaces_subscribe(channel)`, `surfaces_unsubscribe()`, `surfaces_watch(ids)` | overlay |
| chaos | `gag_cursor_start(req)`, `gag_cursor_stop()`, `typing_enable(bool)` | overlay |
| window | `topmost_reassert()`, `toolbox_set_open(bool)` | overlay |
| settings | `settings_get()`, `settings_patch(patch) -> {rev, settings}`, `settings_reset(section?)` | both |
| state | `state_get()`, `state_put(snapshot)`, `stats_add(delta)`, `onboarding_set(flag)`, `report_status({moodLabel, hidden})` | overlay |
| state | `stats_reset()` | panel |
| system | `autostart_get()`, `autostart_set(bool)`, `update_check()`, `update_install()`, `hotkey_try(accel)` | panel |
| system | `panel_open(tab)` | both |
| system | `earl_command(cmd)`: forwards bringBack, putAwayAll, resetRelationship, quiet or preview to the overlay | panel |
| diag | `diag_dump() -> path`, `diag_overlay(bool)` | both, dev and preview builds |

**Events:**
- `platform://geometry`, `platform://ground`, `platform://activity`
- `pointer://hover`, `pointer://near`, `pointer://startle`, `pointer://parked`, `pointer://left-monitor`, `pointer://above`, `pointer://outside-down`
- `surfaces://moved`, `surfaces://gone`, `surfaces://grabbed`
- `state://flush-request`
- `gag://ended`, `typing://burst`
- `settings://changed {rev, settings}`, `state://stats` (1 Hz, only while the panel exists)
- `earl://command {type: show|hide|home|toolbox|bringBack|putAwayAll|resetRelationship|quiet|preview}`
- `update://status`, `hotkey://status`, `panel://navigate`

**Capabilities** (`build.rs` app manifest; commands are denied unless granted):
- `overlay.json`: `core:event:default` plus the overlay commands.
- `panel.json`: `core:event:default`, `core:window:allow-close`, `settings_*`, `stats_reset`, `autostart_*`, `update_*`, `hotkey_try`, `panel_open`, `earl_command`.
- All JS window-management, updater, process and autostart permissions are removed.

**CSP:** `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src ipc: http://ipc.localhost`. GitHub is removed; only Rust talks to the network.

### 4.10 Lifecycle

**Pause everything** when:
- Earl is hidden from the tray;
- a d3d or presentation fullscreen is up with the setting on;
- the session is locked (`WTS_SESSION_LOCK`);
- the display is off (`GUID_CONSOLE_DISPLAY_STATE`).

  "Pause" means: park the pointer thread, remove the hooks and raw input, and hide the overlay (rAF stops).

**Resume:** resample everything and send a full snapshot. The sim catches up from wall-clock time with `world.onResume(elapsedMs)`, which uses the same analytic catch-up as `world.advanceTo(t)` (12.2): needs, affect and relationship are advanced in closed form or at coarse steps, never 1.7 M fixed ticks for an 8 h lock. After 10 min or more away, the brain stages evidence that he lived while she was gone (6.19).

**Canvas and WebView2 issues:**
- Handle canvas `contextlost` / `contextrestored`: re-create the ImageBitmaps.
- **(W)** If WebView2 occlusion throttling freezes rAF, add `CalculateNativeWinOcclusion` to the shared `BROWSER_ARGS` `--disable-features` list (4.1). Test before adding it.
- A WebView2 renderer or browser crash reloads the overlay through `ProcessFailed` (4.1); the dead-man switch has already freed the desktop.

### 4.11 Tray, hotkeys, single instance, autostart

**Tray menu:**
```
Earl - feeling cheeky              (disabled header, from report_status; may show the day
                                    temperament, e.g. "woke up on the wrong side of the taskbar")
Try Chaos mode?                    (first week only, a one-time hint line, 6.18)
Hide Earl / Show Earl              (left-click on the icon also toggles)
Open toolbox            Ctrl+Alt+Shift+D
Bring Earl back
Quiet time  >  30 minutes / 1 hour / Until I wake him / Wake Earl now
---------------------------------
[x] Sound
[ ] Chaos mode
Mood  >  (o) Pure personality  ( ) Needs
Activity  >  Couch potato / Chill / Normal / Lively / Gremlin
---------------------------------
Settings...
About Earl
Update available - v2.x.y...       (only when available)
---------------------------------
Quit Earl
```
- `CheckMenuItem`s everywhere. Radio groups are done by hand.
- One `tray::sync(&Settings, &Status)` is called from `settings_patch`, `report_status` and the updater.
- Tooltip: "Earl - feeling cheeky".
- "Restart Earl" is removed.
- The icon is `icons/tray_32.png` (RGBA) instead of the opaque `assets/icons/tray_icon_32.png` at `tray.rs:44`. It is picked per DPI once the icon art lands.

**Global hotkeys** (`tauri-plugin-global-shortcut`, re-registered on settings change):
- `toolbox.hotkey`, default `Ctrl+Alt+Shift+D`.
- `general.showHideHotkey`, default none.
- In dev and preview builds only: `Ctrl+Alt+Shift+F12` toggles the debug overlay.
- A failed registration gives `hotkey://status inUse`, and the recorder shows "Another app is using this shortcut".

**Single instance:** registered first. A second launch shows Earl and opens Settings.

**Autostart:**
- Args are `--autostart`, which skips the greeting.
- Settings shows the **OS truth** via `autostart_get`: the Run key exists, points at the current exe, and `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run` does not mark it disabled. Disabled is `byte0 & 1 == 1` (covers 0x03 and 0x07).
- `autostart_set(true)` = plugin `enable()` **plus deleting the entry's `StartupApproved\Run` value**, because `enable()` rewrites only the Run value and would leave a Task Manager "disabled" blob in place, making the toggle look broken. `autostart_set(false)` = plugin `disable()`. Both re-read the OS afterwards.
- It is enabled once on first run. It is re-`enable()`d on each launch while on, to refresh the path.

### 4.12 Updater and distribution

**Build settings:**
- `bundle.targets: ["nsis"]`, `bundle.windows.nsis.installMode: "currentUser"` (at any other level Tauri v2 ignores it and silently builds a per-machine or both-modes installer), `plugins.updater.windows.installMode: "passive"`. A config test parses `tauri.conf.json` and asserts both, plus `focus:false` on the overlay.
- An `NSIS_HOOK_PREINSTALL` hook detects the v1 MSI by its UpgradeCode and offers to uninstall it first, so an upgrade never leaves two installs.
- tauri-action `updaterJsonPreferNsis: true`.
- `"version": "../package.json"`, with `scripts/bump-version.mjs` keeping `Cargo.toml` in step.

**`updater.rs` flow:**
1. Check 30 s after start, then every 24 h (if `autoCheckUpdates`). Offline is silent.
2. **When an update is available:**
   - emit `update://status available`;
   - add the tray item;
   - show the About-tab UpdateCard (version, notes, Install and restart, Later, Skip this version);
   - Earl says "psst... new me" once, if speech is on.
3. **On Install:**
   - download with progress;
   - flush the store;
   - `install()` (Tauri exits; the passive NSIS installer runs, then relaunches **(W)**).

**Other points:**
- Delete `src/utils/updater.ts`, which installs and relaunches silently.
- `EARL_UPDATE_ENDPOINT` is honoured only in preview builds, which carry a `2.0.0-preview.<run>` version and the preview updater key (D28).
- **Signing:** Smart App Control on a fresh Windows 11 (22H2+) blocks unsigned, unknown-reputation executables outright, with no bypass, including every updater-downloaded installer. Before M6 (ideally before M0.2 finishes), Cameron checks Windows Security > App & browser control > Smart App Control on Juliette's PC. If it is On or Evaluation, signing is required: Azure Trusted Signing is set up in M0.2 and signs every CI build, previews and the updater NSIS included. W1 runs on a clean Win11 VM with SAC On. If SAC is Off, unsigned remains acceptable (one SmartScreen "Run anyway"). Updates downloaded by Rust carry no Mark-of-the-Web.

---

## 5. Simulation and rendering design

### 5.1 World model

**Entities:** plain classes over one shared `Body`. There is no ECS; there are fewer than 40 entities.

```ts
interface Body { x; y /* feet centre */; px; py; pa; vx; vy; angle; angVel; hw; h; shape: 'box'|'circle';
  mass; restitution; friction; dragLin; dragQuad; gravityScale;
  mode: 'grounded'|'air'|'held'|'kinematic'|'wall'|'hidden'; surface: SurfaceRef|null;
  depth: Depth /* Floor | OnWindow(id) | BehindWindow(id) | BehindTaskbar(sink) */;
  bounceCount; airTime; fallStartY; apexed; asleep }
```

**Earl's collision box:** 0.60·size wide by 0.83·size tall, fixed per pose class (standing, sitting, tumbling circle).

**Masses:**

| Entity | Mass |
|---|---|
| Earl | 1 |
| duckling | 0.4 |
| ball | 0.25 |
| rubber duck | 0.15 |
| items | 2-5 |

**Size scaling:**
- `S = size/64`.
- Speed ∝ `size_eff = 64·(size/64)^0.75`. This is the brain specialist's rule; it stops a 256 px Earl from crawling or teleporting.
- Jump velocity ∝ √S, so jump height ∝ S.
- Gravity is constant in screen space.

**Surfaces:** one-way platforms `{id, kind: floor|window|item, x0, x1, y, z, vy, owner}`.
- Screen sides are walls and the screen top is a ceiling.
- **Reachability:** a BFS with a ballistic reach test. Unaided jumps reach up to 2.5 body heights, or 4 with a flap. Horizontal reach is up to 3 body lengths.

### 5.2 Fixed timestep and scheduler

- **Step:** 60 Hz semi-implicit Euler. The accumulator is clamped to 250 ms, with at most 5 catch-up steps. Render interpolation uses `alpha = acc/STEP`.
- **Rates:** the brain scores only at decision points, affect updates at 2 Hz, needs at 1 Hz.

**Scheduler modes:**

| Mode | Behavior |
|---|---|
| **ACTIVE** | rAF with frame pacing near 60 fps. The refresh period P is the median of the last 30 rAF intervals; the scheduler renders every n-th vsync with `n = max(1, floor(refreshHz / 54))`, the lowest even cadence that stays at or above about 54 fps: 60, 75 and 90 Hz render every vsync, 120 Hz every 2nd (60 fps), 144 Hz every 2nd (72 fps) and 165 Hz every 3rd (55 fps). The transform write is skipped when the snapped device-px position has not changed. `pacing.ts` is unit-tested at 60, 75, 90, 120, 144 and 165 Hz. (The old "skip ticks under 15.5 ms" rule gave 37.5 fps at 75 Hz.) |
| **IDLE** | Entered when every body is asleep, there are no particles or tweens, and no frame is due within 100 ms. Wakes with `setTimeout` at the earliest of: next anim frame, next brain reconsider, next blink, or next breath tick. Breath runs only when its amplitude is at least 1 device px. |
| **PAUSED** | See 4.10. |

Any input or platform event calls `scheduler.kick()`.

### 5.3 Physics constants (`sim/core/params.ts`)

| Parameter | Normal | Physics party |
|---|---|---|
| gravity | 1800 px/s² | × `chaos.physics.gravity` (default 0.4) |
| terminal velocity (no chute) | 1400 px/s | same |
| Earl restitution | 0.22 | from bounciness (default 0.80) |
| max bounces | 3 | unlimited until below threshold |
| bounce threshold | 180·√S px/s | same |
| wall restitution | 0.35; dizzy above 700 px/s | 0.7; never dizzy |
| ground friction μ | 0.9 | ×0.3 |
| tumble when landing \|vx\| > | 500·S | 350·S |
| ball | e 0.72, rolling decel 120 px/s² | e 0.95 |
| chute terminal velocity | 110 px/s | 70 px/s |

**Step, per body:**
1. **Forces:** gravity, plus wind and buoyancy fields. Air drag is computed on velocity relative to the wind: exact linear drag plus quadratic drag.
2. **Integrate** position.
3. **Swept one-way platform test:** take the highest surface crossed, with `vy >= 0`. It cannot tunnel at 5000 px/s.
4. **Contact:**
   - If `impact > threshold` and `bounceCount < max`: bounce and emit `BOUNCED`.
   - Otherwise settle and emit `LANDED{impact, height, surface, bounces}`.
   - If the landing `|vx|` exceeds the tumble speed: switch to a rolling circle tumble, which ends with `TUMBLE_END`.
5. **Walls and ceiling:** reflect and emit `WALL_HIT{side, speed}`. A `climb` intent (Wild, or the calm climb with `earl.wallClimbing = anytime`, D35) switches the body to `mode:'wall'`, which ignores gravity and climbs at 60·S px/s.
6. **Grounded:** self-propelled gait. Walking past a surface end makes him airborne.

### 5.4 Holding and throwing

**Cameron's decision (2026-09-29, verbatim): "i want to keep the current fling mechanics we have and his size".** It overrides the rest of this plan where they differ. The rule is **v1 parity**: for the same release velocity at the same size, v2 produces v1's path. The one deliberate physics change is that upward throws go up (needed for the parachute, 5.5 and M1.9); the parachute itself is the other. Every other difference is in 5.4.4 for Cameron to veto.

#### 5.4.1 v1 fling reference (origin/master)

Line numbers are origin/master's and are the same on v2 until M1.4 deletes the v1 TypeScript. The golden fixtures (5.4.5) come from this code.

**Pickup and hold**
- A press is a pickup at once: `useDrag.ts:29-53` calls `onDragStart` on pointerdown, and `useEarlBehavior.ts:538-585` enters `PICKED_UP`, applies the pickup mood penalty (-3, -8, then -15, `mood.ts:119-130`), plays the pickup sound and expands the window to the full monitor (`commands.rs:96-130`). An angry Earl dodges instead: a 40 px sideways jump and a tantrum (`useEarlBehavior.ts:541-556`, `mood.ts:195-197`). This is bug 11.
- Drag versus click: `|dx| + |dy| > 4` px from the press point (`useDrag.ts:16,60-64`). A release under that also fires the click (`App.tsx:48-55`).
- Follow: the target is the cursor minus the press offset, clamped to `[0, W - size] x [0, H - size]` (`useEarlBehavior.ts:590-597`). Each rAF frame the body moves 0.25 of the way to the target (`useEarlBehavior.ts:317-344`): a per-frame lerp, a 58 ms time constant at 60 Hz and faster on a 144 Hz monitor.
- Lean: a CSS rotation about the sprite box's top centre (`EarlCanvas.tsx:100-104`). The target is `clamp(0.8 * gapX, -35, 35)` degrees, where gapX is target minus body in px, smoothed as `swing = 0.6 * swing + 0.4 * target` per frame (`useEarlBehavior.ts:326-327`). His feet trail the motion and swing back when the cursor stops. After release the angle decays by x0.85 per frame, snaps to 0 under 0.5 degrees, then eases back over 0.2 s (`useEarlBehavior.ts:349-353`, `constants.ts:45`, `EarlCanvas.tsx:104`). `DRAG_SWING_SCALE` (`constants.ts:46`) is unused.
- Held sprite, from the same gap g = (dx, dy) in px (`useEarlBehavior.ts:329-341`): `drag_fast` when `60 * |g| > 800` (a gap over 13.3 px); else `drag_left` or `drag_right` when `|dx| > |dy|`; else `drag_up` or `drag_down` when `|dy| > 2`; else `picked_up`. Each is a single frame (`sprites.json`).

**Release velocity** (`useDrag.ts:15,37,56-75,91-102`)
- Samples: the press point plus each pointermove (clientX/Y, CSS px, y down); the last 5 are kept. The pointerup position is not a sample.
- `v = (last - first) / (tLast - tFirst)` when the span is over 1 ms, else 0. That is the mean velocity over the last 4 move intervals: about 67 ms with a 60 Hz pointer, 33 ms at 125 Hz. It counts samples, not time. No smoothing and **no cap**.
- Quirk Q1: pausing before the release keeps the old samples, so "stop, then let go" still throws at the last motion's speed.
- Quirk Q2: moves before the window expansion resolves are ignored (`useDrag.ts:57`), and the press sample is in the small window's coordinates while later samples are full-monitor coordinates. A release after only 1-4 moves gets a spurious downward vy of about `(H - 204) / span`.

**Release classification** (`useEarlBehavior.ts:600-647`, `stateMachine.ts:169-184`), with `speed = hypot(vx, vy)`:

| speed (px/s) | v1 state | horizontal velocity | decay per 60 Hz frame | stop rule | animation | release sound |
|---|---|---|---|---|---|---|
| under 200 | FALLING | none: vx discarded | - | - | `picked_up`, still (`stateMachine.ts:101-102`) | drop |
| 200-599 | SLIDING | 0.5 vx | x0.92 | under 15 px/s: FALLING, straight down from there | `tumble` | drop |
| 600-1199 | TUMBLING | 0.8 vx | x0.95 | under 20 px/s: DROPPED at once, even mid-air (Q3) | `tumble` | tumble |
| 1200 and up | TUMBLING | vx | x0.95 | as above | `tumble` | tumble |

- Decay is `v *= k^(dt / 16.67 ms)` (`stateMachine.ts:295-310`): per 60 Hz frame and frame-rate independent. If nothing stops it, the total drift is 0.208 v for a slide and 0.333 v for a tumble.
- Vertical start: `vy0 = max(vy, 0)` (`useEarlBehavior.ts:619`). Upward throws lose their upward part (bug 13).
- A release over 400 px/s also costs mood -10 (`FLUNG_INTO_WALL`), wall or not (`useEarlBehavior.ts:642-645`, `mood.ts:145-150`).
- `tumble` alternates `tumble.png` and `dropped_squish.png` every 100 ms and loops. Nothing rotates or spins.

**Flight** (`physics.ts:86-153`, `constants.ts:41-42`), once per rAF frame with the raw frame delta (no clamp, `useEarlBehavior.ts:201`). Frame order: state tick (decay and stop rules), animation, position, events, clamp (`useEarlBehavior.ts:222-314`).
- Vertical: `vy = min(vy + 1200 dt, 600)`, then `y += vy dt` (semi-implicit Euler). Gravity is 1200 px/s^2 and terminal velocity 600 px/s. A downward release faster than 600 is cut to 600 on the first step.
- Horizontal: `x += vxSlide dt`, with vxSlide decayed first. FALLING has no horizontal motion at all (bug 14).
- Q3: when a tumble's vxSlide drops under 20 px/s the state becomes DROPPED, a ground state, so Earl is put straight onto the ground at that x with no fall (`stateMachine.ts:296-299`, `physics.ts:154-157`, then the window shrink at `useEarlBehavior.ts:279-293`). No drop sound and no height penalty on that path. A fast throw that is nearly vertical (`|0.8 vx| < 21` px/s), such as straight down at 600 or more or straight up, snaps to the ground on the first frame.
- Walls: x is clamped to `[0, W - size]`, the monitor's left and right edges. TUMBLING reflects, `vxSlide = -0.6 vxSlide` (`stateMachine.ts:200-204`); each hit plays the wall bump sound and costs mood -10 (`useEarlBehavior.ts:308-312`). SLIDING does not reflect: Earl stays pinned to the wall while vxSlide decays, and the sound and the -10 repeat every frame (Q4; 26 frames in the `wall-slide` fixture).
- No ceiling: vy is never negative.
- Ground: `H - pad - size`, where pad is 40 px with the taskbar visible and 4 px when it is hidden (`physics.ts:48-49`, `useEarlBehavior.ts:77-80`, `constants.ts:8`).

**Landing** (`physics.ts:97-103,122-127,140-147`, `stateMachine.ts:186-191`, `useEarlBehavior.ts:257-277`)
- Touchdown is a dead stop: y snaps to the ground and vx and vy go to 0. **No bounce** (`bounceCount` is never incremented), no ground slide, no roll, no tumble on landing.
- Then `dropped` plays: squish 200 ms, squish 200 ms, squat 150 ms, stand 100 ms. That is 650 ms at the "normal" animation speed (x1.5 chill, x0.5 hyper, `constants.ts:31-35`), then IDLE (`stateMachine.ts:238-244`).
- Mood: a fall over 20 px (release y to ground) costs -3 under 100 px, -8 under 300 px, else -15 (`useEarlBehavior.ts:262-264`, `mood.ts:132-143`). The drop sound plays on landing only from FALLING (`useEarlBehavior.ts:265-267`).

**Size.** The fling has no size term: every constant is in px or px/s and is the same at 48, 64, 80 and 96. Size only moves the walls and the ground by the box size.

**Measured** (from the fixtures: 60 Hz, 64 px, 1920x1080, pad 40; x is the box's left edge, times are from release):

| case | release x, height above ground, vx, vy | v1 tier | v1 landing x | v1 time to land | control back |
|---|---|---|---|---|---|
| slow-drop | 900, 150, 120, 60 | FALLING | 900 | 450 ms | 1133 ms |
| gentle-right | 900, 150, 400, 0 | SLIDING | 935.2 | 500 ms | 1183 ms |
| fast-left | 900, 150, -1000, 100 | TUMBLING | 716.9 | 417 ms | 1100 ms |
| fast-right | 900, 150, 1500, 100 | TUMBLING | 1243.3 | 417 ms | 1100 ms |
| diagonal-down | 700, 300, 700, 500 | TUMBLING | 841.2 | 517 ms | 1200 ms |
| straight-down | 900, 300, 0, 180 | FALLING | 900 | 617 ms | 1300 ms |
| straight-down-fast | 900, 300, 0, 900 | TUMBLING | 900 (Q3 snap) | 17 ms | 700 ms |
| upward | 900, 150, 400, -900 | TUMBLING | 979.6 | 500 ms | 1183 ms |
| upward-straight | 900, 150, 0, -1000 | TUMBLING | 900 (Q3 snap) | 17 ms | 700 ms |
| wall-slide | 30, 400, -560, 0 | SLIDING | 0 (pinned) | 917 ms | 1600 ms |
| wall-tumble | 1500, 400, 1400, 0 | TUMBLING | 1820.3 (1 reflect) | 917 ms | 1600 ms |
| v1-cap | 200, 700, 3000, 900 | TUMBLING | 1124.0 | 1167 ms | 1850 ms |
| high-drop | 900, 800, 0, 0 | FALLING | 900 | 1583 ms | 2267 ms |

#### 5.4.2 Holding (v2)

**Gestures** (`sim/input/gestures.ts`):

| Gesture | Rule |
|---|---|
| pickup | 6 px of movement or a 200 ms hold |
| click | released within 250 ms, under 6 px |
| double-click | second click within 320 ms and 8 px. The first click reacts at once; the second upgrades the reaction. |
| spam | 3 or more clicks in 4 s |
| stroke-pet | 3 or more direction reversals within 1.5 s over Earl's rect, below 600 px/s. Detected from the cursor stream, so it works while the window is click-through. |
| right-click | pet (the WebView2 context menu is suppressed, 4.1) |

**Held** (v1's hold, made frame-rate independent):
- The body is kinematic. It follows the target (cursor minus grab offset, clamped to the monitor as in v1) with v1's lerp: `gap *= 0.75^(dt / 16.67 ms)` per step, identical to v1 at 60 Hz.
- Lean: v1's rule. The sprite rotates about the box's top centre; `target = clamp(0.8 * gapX, -35, 35)` degrees and `angle = 0.6 * angle + 0.4 * target` per 60 Hz step. After release it decays by x0.85 per step and snaps to 0 under 0.5 degrees. gapX is in px at every size, as in v1.
- Frame, from the gap with v1's rule: `picked_up` maps to `earl_held_01` (`earl_held_grumpy_01` when wary, an addition); `drag_left` and `drag_right` to `earl_held_side_01` (mirrored for left); `drag_up` and `drag_down` to `earl_held_01` for now (F14); `drag_fast` to `earl_flail_01..02`.

#### 5.4.3 Throwing (v2)

- **Release velocity:** v1's estimator. Samples are the pickup point and each pointer move in CSS px (DIP, y down); the last 5 are kept and `v = (last - first) / span`, or 0 under a 1 ms span. No 4000 px/s clamp, only a 20000 px/s glitch guard (F10). Q1 (a paused release still throws) is kept for parity. Q2 cannot happen (F6).
- **Classification, horizontal velocity, decay and stop rules:** exactly the v1 table in 5.4.1, on the same `speed = hypot(vx, vy)`. The one exception is Q3: when a tumble's horizontal velocity dies mid-air he falls straight down from there, like v1's slide stop (F4). The landing x is unchanged.
- **Vertical:** `vy0 = vy`, **including upward** (F1). Gravity 1200 px/s^2. Downward speed is capped at 600 px/s every step, so a fast downward release starts at 600 as in v1. Upward speed has no cap; the screen top reflects like v1's walls, `vy = -0.6 vy`, and emits `CEILING_HIT` (F2).
- **Integration:** the fixed 60 Hz step (5.2) in v1's order: decay and stop rules, then gravity and the terminal clamp, then the move, then contacts. At 60 Hz this reproduces v1 at 60 Hz exactly (F9).
- **Walls:** TUMBLING reflects at 0.6; SLIDING pins against the wall without reflecting. `WALL_HIT` and its sound fire once per contact, not every frame (F5).
- **Landing:** v1's dead stop. No bounce, no ground slide, no roll and no tumble on landing (Earl's rows in 5.3). Emits `LANDED{impact, height, surface, bounces: 0}`.
- **Landing beat:** v1's 650 ms `dropped` sequence in v2 art (`earl_land_squish_01` for 400 ms, the squat for 150 ms, the stand for 100 ms, scaled by the activity-driven animation speed the same way), then the brain has control. The 7.7 `land` variants are additions (F15).
- **Size:** none of these constants scale with `earl.size`, at any size (v1 had no size term).
- **Airborne visuals:** v1's tumble cycle (the tumble shot and the squish alternating every 100 ms) for the SLIDING and TUMBLING tiers; `earl_held_01` held still for the FALLING tier. v2 adds a spin angle `cross(grabOffset, v) * k` on the sprite only (F13).
- **Parachute (5.5):** it arms only after the apex of an upward throw, or on a fall that did not start from a release (a lost perch, a floor drop). Drops and flings that start level or downward behave exactly like v1 from any height (F3).

#### 5.4.4 Differences from v1 fling

Cameron can veto any row; its v1 column is then the behavior.

| # | v1 behavior | v2 plan | Why |
|---|---|---|---|
| F1 | the upward part of a throw is discarded (bug 13) | kept: he flies up, peaks and falls | Cameron's parachute request (M1.9). The one deliberate physics change. |
| F2 | no ceiling (vy is never negative) | the screen top reflects at 0.6 | only reachable through F1; reuses v1's wall coefficient |
| F3 | no parachute | the chute arms after an upward throw's apex, or on a fall that did not start from a release, over max(3 bodyH, 200 px) | Cameron's request. Level and downward flings never arm it, so they stay v1 at any height. The old plan armed it on any release over 200 px up, which would turn high v1 flings into glides; that is the alternative if Cameron prefers it. |
| F4 | Q3: a mid-air tumble whose vx drops under 20 px/s snaps onto the ground; a fast near-vertical throw snaps on frame 1 | he falls straight down from that point | the snap is a visible teleport. Landing x is unchanged; only the time to land grows (the `straight-down-fast` and `upward-straight` fixtures). |
| F5 | Q4: the wall sound and the -10 mood repeat every frame while a slide is pinned to a wall | once per contact | the same path, without the sound spam and a mood hit of up to -260 |
| F6 | Q2: a release after 1-4 moves gets a spurious downward vy | cannot happen | one overlay and one coordinate space (4.1) |
| F7 | every press is a pickup, and a click is a pickup under 4 px (bug 11) | the 5.4.2 gesture thresholds (pickup at 6 px or 200 ms) | clicks, pets and double-clicks need presses that are not pickups. A throw needs movement anyway, so no v1 throw changes. |
| F8 | the hold follow and lean run per rAF frame, so they are faster on a 144 Hz monitor | the same constants per 60 Hz step | identical at 60 Hz, and the same on every monitor |
| F9 | flight integrates with the raw rAF delta | the fixed 60 Hz step | identical at 60 Hz, and stable on other monitors |
| F10 | no release cap | a 20000 px/s glitch guard | only a pointer glitch goes that fast |
| F11 | the ground is 40 px above the monitor bottom (4 px with the taskbar hidden) | the real taskbar top and lanes (4.5, 5.6) | Cameron's taskbar request. The path relative to the ground is unchanged. |
| F12 | only the taskbar floor | window tops and items too, when perching is on (M3.5, M3.6) | a later, separate feature. The parity test runs with no windows. |
| F13 | the tumble cycle only, no rotation | the same cycle plus a spin angle on the sprite | visual only; drop it if it reads wrong |
| F14 | 6 held sprites: still, left, right, up, down, fast | 4 shots; up and down share `earl_held_01` | v2 art. Add `earl_held_up_01` and `earl_held_down_01` to the shot list if Cameron wants them back. |
| F15 | the landing beat is always `dropped` (650 ms) | the same beat by default; after it, dizzy following a wall hit over 700 px/s, or a stuck landing when bonded (7.7) | personality additions after the dead stop; the path is unchanged |
| F16 | no Physics party | chaos Physics party (5.3, right column): bounces and lower gravity | chaos is off by default and not v1-possible |

Dropped from the old plan in favour of v1: LSQ velocity over 80 ms with a 4000 px/s clamp, the spring follow (omega 25), the cursor-acceleration pendulum, gravity 1800 px/s^2 and terminal velocity 1400 px/s, Earl's bounces (restitution 0.22, 3 bounces, threshold 180 sqrt(S)), ground friction 0.9, the tumble on landing above 500 S, wall restitution 0.35, the long-glide horizontal drag outside the parachute, and any size scaling of fling speeds.

#### 5.4.5 v1 parity test (M1.3)

- **Fixtures:** `test/fixtures/v1-fling/*.json`, 13 cases captured from v1's own step functions by `test/v1-fling-capture.test.ts`. `npm run capture:v1-fling` rewrites them; a plain `npm test` checks that they still match v1. M1.4 deletes the capture test together with the v1 engine and keeps the fixtures.
- **Contents:** the release (x, y, height, vx, vy, speed), the world (1920x1080, pad 40, size 64, 60 Hz), `v1`, and `v2Expected`. `v2Expected` is `"same-as-v1"` unless F1, F2 or F4 applies; then it is v1's own step functions with only those changes. Each holds the tier, landing x, time to land, bounces, wall contacts, ceiling hits, the mid-air stop, settle time (the last motion), control time (the landing beat is over) and the path sampled every 50 ms.
- **Test:** `test/sim/v1-fling-parity.test.ts` (M1.3) runs the v2 sim on each fixture with no windows or items and the chute off, and compares with `v2Expected`:
  - landing x within 1 px, and every path sample within 1 px;
  - time to land and settle time within 1 step (16.7 ms);
  - bounces exactly 0; wall contacts and ceiling hits exact;
  - control time within 2 steps (33 ms; v1's animator drops each frame's remainder).
- **Chute pass:** the same run with the chute on. The 150 px cases that start level or downward must still match (they never arm it), and both upward cases must deploy it.

### 5.5 Parachute (`sim/physics/parachute.ts`)

**Arming:** he is descending, the height to the floor is greater than `max(3·bodyH, 200 px)`, and either:
- the throw's apex has passed, or
- a fall started from a release or a lost perch.

**Deploy timing** (brain RNG stream):

| Case | Timing |
|---|---|
| normal | 0.15-0.4 s after arming, after a 250-500 ms "oh no" flail |
| grumpy (G > 0.6) | 0.6-1.2 s late |
| 5% "forgot" | at 1.5 bodyH above the ground; soft but thumpy |
| chaos (any sub on), 10% | tangles, spins, collapses, redeploys |

**Drag:**
- A 250 ms ramp to `dragQuad = g/vt²`, where vt = 110 px/s.
- Horizontal linear drag of 0.4, so throws turn into long glides.
- Drag is relative to the wind, so the fan pushes the chute hard (at least 5× the drift of bare Earl).

**Sway:**
- The canopy is a pendulum with L = 1.3·bodyH: `θ'' = -(g/L)sinθ - cθ' + kw·(windₓ-vx)/L + noise(0.3 Hz)`, about ±8°.
- Earl tilts by θ·0.5.

**Landing:**
- 20%: the canopy drapes over him (`prop_parachute_05`) and he wriggles out.
- Otherwise it collapses (`prop_parachute_04`) and he stuffs it away.
- Emits `CHUTE_COLLAPSED`.

**Art:** `prop_parachute_01..03` for deploying and open. The strings are always procedural, from the canopy hem attach points to Earl's `hang` wing-tip points (`earl_hang_01`, `earl_hang_alarm_01`).

**Umbrella ride:** the same module, with 0.7× chute drag and 1.5× sway.

### 5.6 Taskbar lanes (`sim/env/env.ts`, `sim/env/taskbarLane.ts`)

**Floor:** `floorY` comes from `platform://ground` as-is. The sim never recomputes taskbar geometry.

**The world clip** is the monitor minus the occluders:
- the taskbar rect when present;
- the revealed auto-hide rect while it is shown;
- left, right or top taskbars.

  Earl, items, particles and bubbles are all clipped by it.

**Floor transitions** (already debounced in Rust):

| Transition | Items | Earl |
|---|---|---|
| **Taskbar gone** (the floor drops) | Lose support and fall with real physics (the ball bounces). No mood penalty for a fall shorter than one body height. | If he was `BehindTaskbar`, he is now exposed: emit `FLOOR_CHANGED{cause:'taskbar-gone', exposed:true}`, and the brain plays a `caught` beat. |
| **Taskbar back** (the floor rises) | Lifted with a 250 ms ease-out, as if the taskbar pushed them up. | Standing where it appeared: becomes `BehindTaskbar` with `sink = dy/bodyH`, and the brain decides whether to pop up (`climb_onto_taskbar`) or stay behind. At `never` he pops up at once (the behind zone is off, D35); at `sometimes` (the default) he pops up within 3 s unless he was already sulking or napping, in which case the visit continues until that reason ends; at `mostly` and `always` he usually stays. Elsewhere (on a window, in the air): unaffected. |
| **Auto-hide reveal** | Occluder only; the floor does not move. | If at the bottom, he is now behind it; the brain may play `caught` (glance up). |

**Lanes seen by the brain:** `onTaskbar | behindTaskbar | floor | window | wall | item | air`.

**`taskbarHiding` levels, in plain numbers** ("behind share" = share of awake grounded time with his feet below the taskbar edge, sink > 0; sim-checked ±10%):

| Level | Home | Behind share | Pops up onto the taskbar top for |
|---|---|---|---|
| `never` | on the taskbar top (v1) | 0 | - (every behind-lane behavior is gated off) |
| **`sometimes` (default)** | on the taskbar top (Cameron's Q1 answer); slips behind by choice to sulk, nap, hide or peek (requirement 8 literal), about 3-6 visits per awake hour of about 20 s to 3 min each (median 90 s; naps and sulks last longer) | 0.15 | - (he is already on top; he climbs back up when the reason for the visit ends) |
| `mostly` | behind | 0.6 | whole-body actions, plus about a third of his wandering and play happens on top |
| `always` | behind | 0.85 | only actions that need a real surface under his whole body: jumps to windows, items, trampolining, zoomies and sprints, being dragged, thrown or dropped. He slips back behind 1-3 s after the action ends. |

**Visits at `sometimes` (the default).** A visit starts from a scored reason, never from a quota: a sulk (eyes depth), a nap or `goodnight` (crest depth), shyness or a scare (peek or eyes depth), a busy user (a chin-on-edge peek), or curiosity (a wade-depth peek along the taskbar, `peek_pop` play). It ends when that reason ends, or after a log-normal stay (median 90 s, so 3-6 visits an hour add up to the 0.15 share; naps and sulks last as long as they last), with `climb_onto_taskbar`. There is no automatic return behind after surface behaviors.

**Behind lane = full-body clips on a virtual floor.** In the behind lane Earl is not a special static head. His feet stand on a virtual floor at `taskbarTop + sink·bodyH`, where `sink` is the fraction of his body height hidden below the edge, and everything below `taskbarTop` is clipped (5.10). Ordinary full-body clips play there: walk, look, tilt, yawn, preen, scratch, honk, sneeze, quack, tantrum stomp, sleep. The walk cycle supplies a natural head bob, so moving along the lane is a real waddle, not a sprite on a rail.

**Depth ladder:**

| Sink | Name | What shows | Frames | Used when |
|---|---|---|---|---|
| 0.15-0.30 | wade | head, wings, upper chest | any full-body clip | default resting and moving depth behind the taskbar when watched or idle |
| 0.55 | peek | head down to the chin; chin on the edge | `earl_peek_01` family (`_blink`, `_look`, `_grumpy`, `_happy`, `_quack`), `ledge` anchor at y=124 of 256 | "chin-on-edge rest"; when the user is busy |
| 0.63 | eyes | crest and eyes | `earl_peek_grumpy_01` | sulking, scared, wary |
| 0.80 | crest | crest and Zzz | `earl_peek_sleep_01` | napping behind the taskbar |
| 1.0 | hidden | nothing | - | duck, whack-a-mole, shell popup open |

**Frame placement rule:** clips tagged `locomotion` anchor by the feet on the virtual floor (so the cycle bobs). Every other frame in the behind lane is placed so its detected eye centre (from `sprites.gen.ts`) sits at the lane's eye height, `taskbarTop - (eyeFrac - sink)·bodyH` (eyeFrac is about 0.68 for the sit_idle geometry). Pose swaps between sit, stand and ledge frames therefore never make his head jump.

**Contextual depth and share (not a flat number):** the setting's behind share is multiplied by about 1.5 (capped at 0.95) when the user is busy (6.16), he is sulking or napping, or he was recently scared, and by about 0.4 when he is "watched" (cursor idling in the bottom band, or the user idle but present). The same context picks the depth: watched gives wade, busy gives peek, sulk gives eyes, nap gives crest.

**Sub-behaviors:**

| Sub-behavior | Motion |
|---|---|
| sink / rise | eases between ladder depths over 0.5-0.9 s (ease-in going down, ease-out coming up) |
| peek-bob | at peek depth, sink varies 0.5-0.6 with random holds of 0.6-3 s; he looks around with `earl_peek_look_01` and facing flips |
| wade walk | the normal walk cycle on the virtual floor at 0.65 speed |
| duck | sink goes to 1.0 in 120 ms, then he reappears elsewhere 1-4 s later (whack-a-mole) |
| pop-out | a ballistic hop onto the taskbar top (`earl_hop_squat_01` then `earl_hop_air_01`) |

**Visibility metrics** (12.6), re-derived in revision 3 for the on-top home. Definitions, as shares of awake time with the user present: **full-body** = not behind the taskbar (on the taskbar top, the floor, a window or an item, held or airborne); **expressive** = full-body, or behind at wade depth (sink ≤ 0.35); **head-only** = sink ≥ 0.55. Each floor is the level's contextual behind share with a margin: full-body ≈ 1 - behindShare, and at `sometimes` most visit time is at peek depth or deeper (sulk, nap, peek), so about 70% of it is head-only.

| Level | Full-body | Expressive | Head-only | Behind visits |
|---|---|---|---|---|
| `never` | ≥ 95% | ≥ 95% | ≤ 2% | 0 |
| **`sometimes` (default, the gated headline)** | **≥ 75%** | **≥ 85%** | **≤ 12%** | **≥ 2 per awake hour, median stay 20 s-3 min (naps excluded)** |
| `mostly` | ≥ 30% | ≥ 60% | ≤ 30% | - |
| `always` | ≥ 12% | ≥ 55% | ≤ 35% (the revision 2 pair, kept as this level's floor) | - |

The visits row guards against a `sometimes` that never actually slips behind: the behind share alone could pass with one long sulk behind the taskbar and no other visits.

When fully hidden (sink ≥ 1), nothing is drawn and there is no hit region, so the scheduler idles.

**Hit region** while behind: `clip:[taskbar.rect]`. Only the visible head is clickable, and the taskbar underneath stays fully usable.

**No taskbar:** the same hide mechanics work at the monitor's side edges. His x goes past the edge and the canvas edge clips him (`edge_peer`, hide-at-edge), only at an edge the roam range touches (D35).

**Roam range** (`earl.roamRange`, D35): `env.ts` turns it into the ground lane's walkable x-interval `[from·W, to·W]` for the taskbar top, the behind lane and the screen bottom alike. Range ends that are not a screen edge are soft walls: he turns there without a bump. Every ground x target is clamped into this interval, not only wander targets: follow and chase stop at a range end (he watches the cursor from there), fetch and ball play turn back at it, and `attention_seek` walks to the middle of the range. The interval is recomputed on every ground event and settings change; if he is outside it, the brain queues `return_to_range`.

### 5.7 Perching (M3.6)

- While Earl stands on a window at z = k, every window above k is an occluder for him.
- **Perch lost** when the edge moves more than 4 px in one tick at over 150 px/s, or when the window disappears. Then:
  - `vy = Δy/dt` (clamped) and `vx += 0.5·Δx/dt`;
  - he goes airborne;
  - `PERCH_LOST{cause}` is emitted.
- **The user grabs the window** (`surfaces://grabbed`, from `MOVESIZESTART` on his window): he scrambles for 150-300 ms, then falls, even if the drag starts slowly. This is requirement 9 ("falls off when the window moves"); user drags usually start below 150 px/s, so the speed rule alone would let him ride them.
- **Slower moves the user did not start** (an app resizing or animating itself) are ridden (`ride_window`).
- `surfaces_watch([id])` is kept up to date with his current window.

### 5.8 Events

A typed union written into a reused ring buffer (no allocation):

`LANDED, BOUNCED, WALL_HIT, CEILING_HIT, SLIDE_STOPPED, TUMBLE_END, PICKED, THROWN{vx,vy}, APEX, CHUTE_DEPLOYED, CHUTE_COLLAPSED, PERCH_LOST{cause}, FLOOR_CHANGED{dy,cause,exposed}, WATER_ENTER{impact}, WATER_EXIT, ITEM_TOUCH{id}, BALL_KICKED, CLIMB_TOP, CLIP_EVENT{sfx|emit|launch}, GESTURE{click|dbl|spam|pet|stroke|hover}`.

The brain, audio, stats and renderer all consume them.

### 5.9 Intents (brain to body)

The brain sets `earl.intent`. `physics/locomotion.ts` executes it and reports `done` or `failed`:

`idle(pose) | walkTo(x, gait) | jumpTo(surfaceId, x) | taskbarLane(sink, mode) | perch(windowId) | use(itemId) | climb(side) | emote(clip) | carry(itemId) | kick(itemId) | push(itemId, dx) | faceTo(x) | lookAt(target)`

**Jump solver:** apex `h = max(dyUp + 0.5·bodyH, 0.6·bodyH)`, then `vy0 = -√(2gh)` and `vx = dx/t`. Unreachable targets are rejected.

### 5.10 Rendering (`render/`)

**Layers mode (the expected M0.4 outcome; the mode is chosen there, D14):**
- Each drawable has a canvas at its device-px bbox:
  - Earl: bbox inflated for tilt, the shadow and a held prop;
  - each item: back and front layers are separate canvases;
  - each duckling;
  - the parachute plus strings;
  - each bubble;
  - one particle-field canvas, sized to the live particle bbox with a 64 px hysteresis margin.
- **Content signature:** `(frameId, flip, dprSize, level)`. A layer is repainted only when one of these changes (about 7 repaints/s while walking).
- **Procedural motion is compositor-only:** squash and stretch, tilt, tumble spin, breathing, walk scale jitter and lean are a CSS `transform` on the layer (`translate3d(...) rotate(...) scale(...)` with `transform-origin` at the anchor). Alpha is CSS `opacity`. None of them repaint.
- **Z-order:** CSS `z-index`, in this order:
  1. item back layers
  2. Earl, ducklings and item front layers, all sorted by feet y. An item's front layer (tub rim, blanket, umbrella canopy) is lifted above **only the entity currently using that item**; anyone walking past a bed or tub is sorted by feet y and never drawn behind its blanket or rim.
  3. held props
  4. parachute
  5. particles
  6. bubbles
  7. needs HUD
  8. debug

**Clipping (no repaint on clip change):**
- Occlusion is CSS on container elements, not canvas code. One world-level container has `clip-path: inset(...)` for the taskbar line (the behind lane, 5.6). Per-depth containers (`OnWindow(id)`, `BehindWindow(id)`) carry a `clip-path: polygon(evenodd, ...)` built from that depth's occluders; they update only when the occluders change.
- The canvas fallback mode keeps the in-canvas `ctx.clip('evenodd')` path.
- The same occluder list goes into that entity's hit region, so only what is visible is clickable.

**DPR:**
- Backing store is `round(css·dpr)`.
- Positions are snapped to `Math.round(x·dpr)/dpr`.
- `matchMedia('(resolution: Xdppx)')` changes trigger a reallocation.

**Sprite cache:**
- Atlas pages are kept as **encoded Blobs** (256 and 512 levels, D19). The level used is the smallest one at least `displaySize·dpr`.
- A frame is decoded on demand with `createImageBitmap(blob, sx, sy, sw, sh, {resizeWidth, resizeHeight, resizeQuality:'high'})` at `displaySize·dpr`; the full page is never kept decoded. Crop-then-resize means frames can't bleed into each other.
- Filled lazily, one clip at a time. Until a frame is ready, the previous prescaled frame or a CSS-scaled one is shown.
- **Size slider:** while the value is moving, layers render the current cache with a CSS scale; the cache is re-prescaled 200 ms after the value settles. No createImageBitmap churn at 30 Hz.
- Memory budget: encoded pages (a few MB) plus an LRU of prescaled frames capped at 48 MB.
- **No `getImageData` / `putImageData` anywhere** (deletes `EarlCanvas.tsx:40-62,344-365`).

**Canvas mode (fallback, only if M0.4 picks it):** one monitor-sized canvas; the dirty rects of (prev ∪ cur) are merged, with a full clear when they exceed 35% of the screen. It uses the same draw order and in-canvas clip code.

The draw functions are shared, so the unchosen mode can be revived later if ever needed, but only one mode is built and tested in M1.

### 5.11 Animation data (`sim/anim/`)

**`sprites.gen.ts`** (generated by `npm run art:build`, gitignored, D19):
- the `FrameId` union;
- per frame: page, rect, offset, `anchor` `[128,240]` or the anchor-type point, `anchorType`, facing, mirror, eyes (centres and radii, used by the procedural blink), head point, `attach` points, `ledgeY`, **pose class** (`sit | stand | side | ledge | air | lie`), hit mask id;
- per prop: the measured alpha-bbox footprint and the attach lines (8.3);
- a `placeholder` flag.

**Clips** (`clips/<owner>.ts`, one file per behavior or item, globbed):
```ts
walk:       { frames:[{f:'earl_walk_02',ms:150},{f:'earl_walk_01',ms:150,ev:[{sfx:'step'},{emit:'dust'}]},
                      {f:'earl_walk_02',ms:150},{f:'earl_walk_03',ms:150,ev:[{sfx:'step'}]}],
              loop:'loop', rate:{from:'speed', nominal:40}, blink:false },
hop:        { frames:[{f:'earl_hop_squat_01',ms:[70,110]},{f:'earl_hop_air_01',ev:[{launch:'hop'}],hold:'landed'},
                      {f:'earl_hop_squat_01',ms:100},{f:'earl_stand_front_01',ms:80}], loop:'once', next:'@brain' },
sit_idle:   { frames:[{f:'earl_sit_idle_01',ms:[1800,4200]}], loop:'loop', blink:'earl_sit_blink_01', breathe:true },
peek_bob:   { frames:[{f:'earl_peek_01',ms:[600,3000]}], loop:'loop', anchor:'ledge', proc:{bob:0.2} },
```

**Fields:**
- `ms` is a number or a `[min,max]` range sampled from the anim RNG.
- Loop modes: `loop | once | pingpong | {from:n}`.
- Frame events: `sfx`, `emit`, `launch`, `impulse`.
- `hold:'landed'` ties air frames to real physics. This retires `HOP_OFFSETS` and its sign bug.
- `rate:'speed'` makes playback rate = actual speed / nominal speed. That removes foot-skating, and activity scales movement and animation together.
- `alt:'mirror'` alternates mirrored frames (tantrum, shake, splash, wiggle).
- **Pose-class variants:** a clip may name a frame by role (`look`, `look_up`, `blink`, `quack`) instead of an id; the player resolves the variant that matches the current pose class (for example `look` resolves to `earl_look_01` when sitting, `earl_stand_look_01` when standing or walking, `earl_peek_look_01` at peek depth). He never snaps from a standing side walk to a sitting front pose and back. The art lint checks that every clip frame's pose class matches its neighbours, or that a transition frame sits between them.

**Missing frames resolve in this order:**
1. the frame itself;
2. the `fallback` chain in `art/shots.json` plus a `proc` hint (for example, stretch = stand with scaleY 1.08);
3. the clip's fallback clip;
4. `earl_sit_idle_01`.

   The first miss logs one line.

**Anchoring:** every frame is placed by its anchor. This fixes the measured drifts:
- `dropped_squish` floats 16 px;
- `run_step1` lurches 20 px;
- v1 Earl floats about 7% above the ground;
- it deletes the sitting-offset hack at `physics.ts:155-157`.

**Art lint** (vitest): a `standing` or `gnd` frame whose head width differs by more than 6% from `earl_sit_idle_01`, or whose baseline is off by more than 1 source px after alignment, fails. Shots that deform on purpose (puffed_up, plop, land_squish, stretch, startle, and any others flagged) carry a per-shot `lint` override in `shots.json` (for example `headWidthTolerance: 0.15` or `skip: ["headWidth"]`).

### 5.12 Procedural layer, particles, bubbles

**Procedural motion** (`anim/procedural.ts`, about the anchor):

| Effect | Rule |
|---|---|
| squash and stretch | spring k=300, c=18. Landing squash = clamp(impact/1500, 0, 0.35), volume-preserving (`sx ≈ 1+0.6(1-sy)`) |
| air tilt | `atan2(vy,\|vx\|)·0.15`, clamped to ±20°. Also a lean into fan wind. |
| breathing | scaleY 1 ± 0.012 at 0.25 Hz; skipped when under 1 device px |
| wobble and shake | decaying sine |
| ground shadow | canvas ellipse on the surface below; width and alpha shrink with height; none behind the taskbar |

**Blink channel:**
- Interval log-normal, median 3.5 s.
- 12% double blinks; 5% slow blinks when sleepy.
- It swaps in the current frame's drawn blink variant where one exists (`earl_sit_blink_01`, `earl_sit_side_blink_01`, `earl_peek_blink_01`, `earl_stand_blink_01`).
- **Procedural eyelid fallback:** for every other frame with detected eyes, the renderer draws an eyelid over each eye (an ellipse in the body colour with the tan crease line, sliding down and up over about 120 ms). The same lid at half height gives the sleepy half-lid look. So every resting pose blinks, including pouty, huffy, happy, stare and peek_grumpy.
- This fixes v1's exact 5.56 s repeat.

**Mouth sync:** a vocalization uses the frame's bill-open variant (`earl_sit_quack_01`, `earl_peek_quack_01`, `earl_honk_01..02`) when one exists. Otherwise it applies a 60 ms squash-up pop on the head so a sound is never played by a perfectly still duck.

**Particles:**
- A struct-of-arrays `Float32Array` pool with a cap of 384 and no allocation after init.
- Kinds: droplet, feather, dust, heart, zzz, star, confetti, crumb, sweat, anger-mark, steam, "!" and "?", wind streak, speed line.
- Glyph bitmaps are pre-rendered per DPR.
- Stepped at the fixed rate, so confetti no longer depends on frame rate.
- They replace `Confetti.tsx` and `PetHeart.tsx`.

**Bubbles** (speech and thought):
- Canvas-drawn, laid out once into an `OffscreenCanvas`.
- Anchored to the head point, clamped on-screen and above the clip line.
- Font: Segoe UI (a system font, offline).
- Thought bubbles carry need icons (bread, zzz, ball), drawn as canvas glyphs.
- **Glyph bubbles:** a non-verbal track (bread, "?", "!", "...", anger mark, heart, a tiny window, a tiny ball) that is used far more often than words, so speech stays rare and fresh (6.13).
- They replace `SpeechBubble.tsx`.

**Needs HUD** (`render/hud/needs.ts`):
- Three bars (hunger, energy, fun) above Earl.
- Shown after 600 ms of hover, `always`, or automatically when a meter drops below 25 (unless set to `never`).
- Colours: green above 60, amber 30-60, red below 30.

### 5.13 Audio (`audio/`)

- Web Audio synthesis only, no audio files.
- The `AudioContext` is created at boot. Both webviews run with `--autoplay-policy=no-user-gesture-required` (the shared `BROWSER_ARGS`, 4.1), because stroke-pet, hover and the typing honk are not user activations and would otherwise leave him mute until the first real click. `resume()` on the first pointer event stays as a fallback (fixes `sound.ts:3-8`). W11 checks that a sound plays on launch before any click.
- The sim emits `SoundCue {kind, intensity, mood}`; `voice.ts` renders it (recipes in 6.13).

---

## 6. Brain and personality design

### 6.1 Layers and priorities

**The loop:**
```
perception.ts -> BrainContext (reused object)
Brain.tick(dt):
  1. affect.update (2 Hz), needs.update (1 Hz), relationship decay, attention (watched/busy, 6.16)
  2. reflexes (every tick)          priority 3: grabbed, thrown, surface lost, floor changed
  3. event queue -> reactions       priority 2: click, double-click, pet, spam; priority 1: stimuli
  4. whims (6.15): keep 1-3 short goals; they add score to behaviors that advance them
  5. selector (decision points + reconsider ticks) -> behavior        priority 0
  6. current behavior coroutine .next() -> MotorIntent
  7. fidget layer (only while resting; settled or restless, 6.8)
  8. episodic log (6.17): salient events are appended; callbacks are scored like any behavior
```

**Rules:**
- Each behavior declares `interruptible` (the lowest priority allowed to cut it). Naps are 1; tantrums and sulks are 2.
- Behaviors are `function*` coroutines built from the helpers `glance()`, `anticipate()`, `walkTo()`, `jumpTo()`, `play()`, `wait(ln)`, `say()`, `sfx()` and `lookAt()`.
- **`BehaviorDef`:** `{id, tags, gate(ctx), score(ctx), run(ctx,h), interruptible, minCommitMs, cooldown:{medianMs, sigma}, chaos?: 'wild'|'messes'|'swarm'|'physics', lanes?: Lane[], zones?: Zone[]}`. `zones` lists the "Where Earl can go" zones the behavior enters (`behindTaskbar | windowTop | wallClimb | outsideRange | fullscreenItems`, D35); `utility.ts` turns it into `zoneGate` (6.6).

### 6.2 Affect engine (both modes)

**Five affects**, each 0..1: G grumpy, P playful, C curious, S sleepy, A affectionate.

**Derived:**
- `arousal = clamp(0.5P + 0.4C + 0.3G - 0.6S + 0.2)`
- `valence = A + 0.6P - G`
- Expressed values: `P' = P(1-0.6S)`, `C' = C(1-0.5S)`. Behaviors score on the expressed values.

**Dynamics:** a damped spring with noise (second-order OU) per affect:
```
v += dt*(-K*(a - base(t)) - Cd*v) + Sn*sqrt(dt)*N(0,1);  a += dt*v;  clamp [0,1], on clamp v *= -0.3
K = (2π/period)²;  Cd = 2ζ√K;  Sn = wanderStd*sqrt(2*Cd*K)
```
Tuned in human units: `swingPeriodSec 360`, `dampingRatio 0.55`, `wanderStd 0.12`.

**`mood.swings` setting (0-100)** scales:
- `moodSwingsPerHour` from 1 to 10 (5 at 50);
- `wanderStd` from 0.06 to 0.18.

**Spontaneous swings always have a visible cause:**
- Poisson at `moodSwingsPerHour` × activity multiplier (× 1.2 when Wild is on).
- Each swing picks an affect, weighted toward G and P, **and a petty cause from `causes.ts`** that plays first and then applies the `±0.3√K` kick: stubbed toe on a wall, a sneeze, a shadow startle, a crumb found, a fly lands on his head (the ambient critter, 6.19), a hiccup, the ball rolling away, a window he could not reach, the rubber duck being there. Causes drawn from the world or the episodic log are preferred. Only the small OU drift stays invisible; every swing large enough to change the mood label is caused.

**Event impulses:** the same velocity kick, ramped over 4 s. Strong events also apply 40% of the change immediately. A pet is a transient A +0.15 that decays over about 3 min, on top of its slow fondness effect.

**Day temperament:** at the first wake of each day a temperament is rolled (grumpy, zoomy, clingy, sleepy or curious day, weighted by the personality sliders; "ordinary" 40%). It shifts the matching baseline by 0.15 for that day and shows in the tray header ("Earl woke up on the wrong side of the taskbar").

**Baselines** (recomputed every 10 s; personality sliders p* are 0..1 from the settings; each baseline is clamped to 0.03..0.9):

| Affect | base(t) |
|---|---|
| G | 0.10 + 0.40·pGrump - 0.15·fondness + 0.30·grudgeSum + 0.35·needStress (Needs mode only) |
| P | 0.10 + 0.40·pPlay + 0.08·morning - 0.25·(1-E/100) |
| C | 0.15 + 0.45·pCurious + 0.15·recentNovelty |
| S | 0.05 + 0.25·pSleepy + 0.35·night + 0.10·lunchDip + 0.45·(1-E/100)² |
| A | 0.12 + 0.25·pClingy + 0.60·fondness - 0.20·sessionWariness + 0.10·missedYou + honeymoon (6.18) |

**Time factors:**
- `night` is 1 from 23:00 to 06:00, with cosine fades from 21:00 and until 08:00.
- `lunchDip` peaks at 14:00, ±1 h.
- `morning` covers 07:00-10:00.
- `missedYou` is 1 after 30 min or more of user activity with no interaction, when fondness is above 0.5.

**Birthdays:** on 4/4 (Juliette) and 6/23 (Cam), A base +0.3 and G base -0.2.

**Resting pose from affect.** Thresholds are **percentiles of each affect's stationary distribution under the current sliders and tier**, recomputed with the baselines every 10 s (from the known OU mean and std), not absolute numbers. This keeps expressions visible at any slider setting. ±0.05 hysteresis; the first match wins:

| Condition | Frame |
|---|---|
| G above its 95th percentile | `earl_puffed_up_01` |
| G above its 88th percentile | `earl_sit_huffy_01` |
| G above its 75th percentile and G > A | `earl_sit_pouty_01` |
| S > 0.65 | `earl_sit_sleepy_01` |
| A above its 75th percentile and G below its 60th | `earl_sit_happy_01` |
| otherwise: his **resting duck face** | alternates by hysteresis between `earl_sit_idle_01` and a "huffy-lite" (`earl_sit_idle_01` with the procedural half-lid and a -4° head tilt), plus `earl_sit_side_01`, or `earl_stand_front_01` when about to move |
| in the behind lane at peek depth (an occasional visit at the default `sometimes`) | `earl_peek_01`, `earl_peek_grumpy_01` (G above 75th), `earl_peek_happy_01` (A above 75th) |

**Grumpy-but-loving is a style, not a threshold.** Affection is mostly expressed through acts with grumpy framing: he follows her cursor but says "hmph", leans in while looking away (`lean_on_cursor` with the head turned), accepts pets with `earl_petted_grumpy_01` before melting, brings the ball and then pretends he didn't. These acts are gated on A relative to its own distribution, so they appear from the first day.

**Expression targets** (12.6, at default sliders): neutral resting face at most 50% of resting time; grumpy family (pouty, huffy, puffed, peek_grumpy, sulk, huffy-lite) 15-30%; affectionate family (happy, petted, wiggle, lean, nuzzle, peek_happy) at least 5% as a stranger, 12% as buddy, 20% bonded.

**Mood label** (for the tray and the panel header), from the dominant affect: grumpy, playful, curious, sleepy, affectionate, or content.

### 6.3 Needs

Meters run 0..100, where 100 is satisfied. H hunger (fullness), E energy and F fun are visible. K clean is hidden (D2).

**Rates** per minute, awake unless noted, at `needsPace = normal`:

| Meter | Decay | Recovery |
|---|---|---|
| H | -0.6 awake, -0.2 asleep | bread +10 per bite (4 bites); seeds +5 per 5 s pecking bout (6 bouts) |
| E | idle -0.35, walk -0.5, run -1.5, sprint / zoomies / trampoline -3 | floor nap +2.5, behind-taskbar nap +2.5, bed +5, sitting +0.3 |
| F | -0.8 | ball +2/s, trampoline +1.5/s, chasing the cursor +1/s, pet +4 (diminishing), swarm visit +10, bath +10, enjoyed throw +8, parachute glide +5 |
| K (hidden) | -0.1 | bath +25 per 5 s of splashing |
| K costs | eating -3 per bite, hard landing -2 | |

- `needsPace` multiplies all decay: `gentle` 0.7 (default), `normal` 1.0, `demanding` 1.4.
- **Presence gating:** needs decay and sulkPressure accrue at the full rate only while the user is present (`userIdleMs` < 5 min), and at 25% otherwise. There is no extra F decay while she is idle. She never comes back from lunch to a duck that has been sulking at an empty room.
- **Energy is not scaled by the activity setting.** E drain comes only from what he actually does (the gait mix already scales it), so a Gremlin Earl is busy, not chronically exhausted.
- **Urgency:** `urg(m) = logistic((50-m)/10)`.

**Needs mode:**
- The meters are real; the HUD is shown per `mood.needsMeters`.
- **Asks escalate diegetically**, per meter below 30: first he glances toward the toolbox corner; then a belly-rumble sfx (hunger) or a big yawn (energy) or a sigh at an empty spot (fun); then he pecks at the ground; then one thought bubble; after that at most one bubble per 8-10 min.
- **He self-serves:** if the item he needs is on the desktop, he goes and uses it.
- **Foraging:** a hungry Earl occasionally finds a crumb (+5 H, a code-drawn crumb, at most once per 20 min), so neglect is a slope, not a cliff.
- **Gratitude beat:** fed while hungry (or played with while bored), he turns to the cursor, wiggles and shows a heart. Tending him should feel rewarding, not like clearing a warning.
- **needStress** = `Σ_{H,E,F} max(0, 35-m)/35 / 2`, clamped to 0..1.
- **sulkPressure:** `+= Σ max(0, 25-m)/25` per present minute; it decays by 1 per minute when every meter is above 40. Past 3, he sulks.
- **Sulk has an arc:** an active back-turned sulk for at most 10 min continuous, then a resigned nap. When she returns after being away, he plays a short guilt-trip scene (a pointed look at the empty food spot, a sigh) and forgives on a **single** gesture: feed OR pet.
- **Offline decay** (app closed): 25% of the normal rate, and it never pushes a meter below 40.
- **Balance targets** (sim-tested over 16 seeds, 12.2):
  - No items, user present, every activity row (0/25/50/75/100) at `normal` pace: the first sulk comes 90-150 min after everything was full.
  - User away 1 h: no sulk on return, only the guilt beat.
  - With bed, bread and ball placed (tested in M3.2/M3.3 when items exist): every meter stays above 25 for 8 h.

**Pure personality mode:**
- The same meters run hidden, with a floor of 45 on each.
- 1.5× recovery.
- No sulkPressure or needStress.
- The meters only nudge behavior scores.

**Switching modes** (via settings patch; nothing is reset):
- **Pure to Needs:** each meter becomes `max(m, 60)` and the HUD shows for 3 s.
- **Needs to Pure:** any sulk ends through `forgive`, sulkPressure is cleared, and G falls gradually as needStress disappears.
- Affects, relationship and memory carry over in both directions.

### 6.4 Relationship (persisted in `state.brain.relationship`)

```ts
interface Relationship { trust: number /*0.40*/; fondness: number /*0.25*/;
  sessionWariness: number /* half-life 60 min (45-90 by P); drives avoidance */;
  roughMemory: number /* slow, half-life 3 d; changes flavor only, never avoidance */;
  throwHabituation: number /* per session, 0..1 */;
  grudges: {kind:'slammed'|'hardLanding'|'dropped'|'spammed'|'duckFavoritism', intensity:number, t:number}[];
  itemLiking: Record<ItemKind, number> /* -1..1: rubberDuck -0.4, fan -0.2, tub 0.1, ball 0.4, trampoline 0.3,
                                            umbrella 0, bed 0.3, bread 0.5, seeds 0.3 */;
  lastSeenMs; daysTogether; petsToday; petsTodayDate; firstMeetingDone: boolean; tierScenesSeen: string[];
  version: 1 }
wariness (for avoidance) = clamp(sessionWariness + 0.3*(1-trust) + 0.5*grudgeSum - 0.2)
```

**Two kinds of wariness.** The parachute invites throwing, so ordinary throws must not sour him for days.
- **sessionWariness** (half-life 45-90 min, shorter with higher P) is the only thing that drives avoidance (`avoid_cursor`, wriggling free, flinching away).
- **roughMemory** (half-life 3 days) only changes flavor, never avoidance: he flinches when grabbed but stays, grips the taskbar edge with his bill when lifted, and mutters "not again." It also feeds episodic callbacks (6.17).

**Throw habituation.** Within a session, a throw that ends in a chute glide or a soft landing raises `throwHabituation` by 0.25-0.35 (faster with P) whenever trust ≥ 0.3. Reactions move from fear, to "hmph", to "again!" over about 3-4 such throws. Only **wall slams over 700 px/s** and **hard landings with no chute** create grudges and cost trust; ordinary throws cost nothing beyond a small, fast-decaying sessionWariness bump (+0.05, and 0 once habituated).

| Event | trust | fondness |
|---|---|---|
| pet | +0.002 | +0.006·dim, where dim = 1/(1+petsToday/30) |
| gentle put-down (release below 200 px/s) | +0.003 | - |
| fed while hungry (Needs mode) | +0.004 | +0.010 |
| played with (ball kicked by user, toy placed near him, fetch) | - | +0.003 |
| first interaction of the day | - | +0.010 |
| throw ending in a glide or soft landing | 0 | +0.002 once habituated |
| slammed into a wall (over 700 px/s) | -0.040 | -0.004 |
| hard landing (fall over 5 body lengths, no chute) | -0.020 | - |
| daily drift | toward 0.5+0.4·fondness at 0.03/day | -0.01/day only after 3 or more days away; floor 0.25 |

**Enjoyed throws:** a throw is "wheee" (F +8) when `throwHabituation ≥ 0.6` or `bondedPlay = clamp((trust-0.6)/0.3)·P` is high.

**Warm-up pace:** about 20 pets a day plus feeding takes fondness from 0.25 to 0.6 in 5-8 days. The day-1 honeymoon (6.18) makes the start of that climb charming rather than unpleasant.

**Tiers:**
- stranger: fondness below 0.3
- acquaintance
- buddy: above 0.55
- bonded: above 0.8
- the overlay tier *wary* applies when wariness is above 0.5 (never on day 1 without a slam, 6.18)
- tier-gated content and the one-time tier-crossing scenes are in 6.20

**Grudges:**
- Starting intensity: slammed 0.35, hardLanding 0.25, dropped 0.15, spammed 0.2, duckFavoritism 0.2. Ordinary throws create none.
- Half-life 20 min, cut to 10 min if he is petted within the window.
- A grudge is dropped below 0.05. `grudgeSum` is capped at 1.

**On load:** grudges decay by the real time that passed, and affects start 50% of the way back toward baseline.

### 6.5 Short-term memory (session only; the persisted episodic log is 6.17)

- **Behavior ring (16 entries).** Repetition penalty `rep = 0.6·exp(-dt/90 s)` for the same id, plus `0.25·exp(-dt/60 s)` per shared tag. Scores are multiplied by `(1 - min(0.85, Σrep))`.
- **Annoyance log:** clicks and grabs over the last 60 s. Drives spam detection and escalating pickup annoyance.
- **Novelty map:**
  - The roam range (D35; the whole screen width by default) is split into 16 bins, plus one entry per perch segment while perching is allowed.
  - Novelty grows 0.02/s toward 1 and resets on a visit.
  - Wander targets are sampled ∝ novelty². This replaces the coin flip at `stateMachine.ts:355`.
- **Wall memory:**
  - A bump count per edge, with a 5 min half-life.
  - Walking toward a recently bumped edge, he turns early with p = `min(0.9, 0.3+0.2·count)`.
  - This is the real version of the unused `shouldAvoidWall`.
- **Attention slots:** up to 3 stimuli (item placed, window opened, cursor parked, an outside click location at a low rate, the ambient critter), with salience decaying over 20 s. They add +0.3·salience to matching behaviors. Outside clicks carry coordinates only, never targets; at most one in 5 is admitted, so he sometimes glances where she clicked.
- **Favourite spot:** where he last napped well. It biases nap location 40%.

### 6.6 Decision making

**Score:**
- `U = w · Π curve_i(input_i)`, with compensated multiplication (geometric-mean style).
- Curves: `lin`, `quad`, `inv`, `logistic`, `bell`, `step`.
- Then `U *= (1-rep)·moodFit·chaosGate·zoneGate`, and `U += 0.15` for the current behavior while inside `minCommit`. `zoneGate` is 0 or 1: 0 when the behavior enters a zone the "Where Earl can go" settings disallow (D35, 7 "Zone gates"), so it can never be chosen.

**Choose:**
- Gate all behaviors (zone-gated ones included, so the ε pick below never picks them either), take the top 6, and softmax at temperature T.
- With probability ε, pick uniformly among the gated behaviors instead. ε is 3%; 4% with Wild outside an episode; 8% inside a gremlin episode (6.11).
- Active whims (6.15) add `+0.4·whimProgress(behavior)` to behaviors that advance a whim.

**Temperature:** `T = T_activity·(1+0.5·arousal)·(1+chaosT)`, where chaosT is Wild +0.2 outside episodes and +0.8 inside a gremlin episode, Messes +0.2, Physics +0.3, summed over the active subs.

**Reconsider ticks:**
- Exponential intervals (rate from 6.10); ×2 only inside a gremlin episode.
- Switch only if `U_best > 1.25·U_cur + 0.05` AND a coin with p = 0.6 agrees.
- A switch during locomotion plays a turn-back beat: stop, the `look` role (resolves to `earl_stand_look_01` while standing, 5.11) for 300-600 ms, then turn.

**Deliberate overreach:** 15% of jump attempts (perch_jump, whim jumps) target a spot just beyond his reach. He falls short, slides down, gives an embarrassed glance at the cursor and retries (with a run-up, from a different spot, or using the trampoline as a step), or gives up with a huff. The jump solver still rejects hopeless targets.

### 6.7 Anti-robot rules (enforced in `behaviors/types.ts` helpers)

- **Durations:** always log-normal (`ln(median, σ=0.45)` × activity). No uniform ranges, no fixed timers.
- **Anticipation is keyed to what follows** (one fixed pre-roll would itself become a tic):
  - walk: looks toward the destination;
  - run or pounce: butt-wiggle crouch;
  - jump: looks up, measures, small bounce;
  - nap: sigh, turns in a circle;
  - 20-30% of actions skip anticipation entirely (impulsive), the chance scaled by P and raised inside gremlin episodes;
  - 15% of walks get a double-take, 8% a false start (two steps, stop, sit back down).
- **Audience check:** after any notable success, failure or landing, 30% of the time he looks toward the cursor.
- **Reaction latency:** startle median 180 ms, notice median 450 ms. He never reacts on the same frame.
- **Gait:** a speed multiplier sampled from 0.85-1.15 per walk, with a 10% chance of a mid-walk speed change.
- **Distractions:** he notices a stimulus with `P = s·(0.3+0.7C')·(1-focus)`, where focus is 0.2 for wander, 0.6 for eating and 0.9 for sleep. Noticing means a 400-900 ms glance, then a re-score.
- **Hesitation** near anything he is wary of (liking below 0):
  - He stops 1.5 body lengths away and leans in (procedural tilt).
  - Then he proceeds with p = 0.5 + liking/2, or backs off.
- **Transitions:** never instant.
  - `earl_sit_to_stand_01` plays forward to stand up and reversed to sit down; `earl_plop_01` plays on a hard sit.
  - Pose swaps blend with a 60-120 ms squash.
  - Front and side views turn through `earl_turn_01` when it exists.

### 6.8 Fidget layer (idle, sit, pout and behind-lane rest only)

**Two states, not a flat Poisson process** (constant twitching reads as a looping animation):
- **settled:** 1-3 fidgets per minute, with real stillness between them (breathing and blinks only);
- **restless:** a burst of 3-5 fidgets over 10-30 s, then back to settled.
- Restless bursts start at a rate from 6.10 and are more likely after a stimulus, with high P or C, or when busy is false and watched is true.

| Fidget | Weight | Gate | Frames |
|---|---|---|---|
| glance (brief facing flip) | 3 | - | current pose, flipped |
| look_up | 1.5 | window or cursor above him | `look_up` role (sit, stand or peek variant) |
| head tilt | 2 | C' > 0.4 | `earl_tilt_01` + procedural ±8° |
| preen | 1.5 | not at peek depth or deeper (fine at wade depth) | `earl_preen_01..02` |
| scratch | 1 (×2 if K < 50) | not at peek depth or deeper | `earl_scratch_01..02` |
| shake_feathers | 0.7 | - | `earl_shake_01` alternating mirrored |
| sneeze | 0.15 | 15 min cooldown | `earl_sneeze_01..02` |
| yawn | 2 | S > 0.45 | `earl_yawn_01..02` |
| sigh | 1 | G > 0.5 | procedural squash, down then up |
| stare_cursor | 3 | cursor within 6 body lengths and still for 1 s or more | `earl_stare_01` |
| tail wiggle | 1.5 | A or P > 0.5 | procedural |
| hiccup | 0.1 | 30 min cooldown | procedural micro-hop |

### 6.9 Context effects

- **Time of day:** as in 6.2.
  - The first wake of the day plays `morning_stretch` then `morning_greeting`.
  - After 23:00, there is a 30% chance of `goodnight` before a nap.
- **User activity** (`platform://activity`, from M1.1):
  - Idle over 5 min: the S baseline +0.1 and naps are more likely (needs decay slows, 6.3).
  - Coming back after that: resume evidence (6.19), then `greet_return`.
  - `userBusy` feeds `watch_typing` and the busy attention state (6.16).
  - Precise typing bursts (Messes only) feed `typing_honk`.
- **Cursor** (far-field events from Rust, 4.3):
  - `pointer://startle` (over 1500 px/s within 3 body lengths) is a startle stimulus.
  - `pointer://parked` nearby leads to stare, lean or peck.
  - `pointer://left-monitor` counts as "away": he looks toward the edge where it left.
- **Fullscreen:** see 4.6.

### 6.10 Activity mapping

Anchor rows at 0/25/50/75/100, linearly interpolated between them:

| | 0 Couch potato | 25 Chill | 50 Normal | 75 Lively | 100 Gremlin |
|---|---|---|---|---|---|
| idle dwell median | 40 s | 22 s | 12 s | 7 s | 4 s |
| reconsider ticks per min | 3 | 5 | 8 | 12 | 18 |
| speed multiplier (walk 0.65, run 2.1, sprint 3.5 body lengths/s) | 0.75 | 0.9 | 1.0 | 1.15 | 1.35 |
| drive growth (F boredom, swings per hour; **not** E drain, which follows the gait mix) | 0.6 | 0.8 | 1.0 | 1.3 | 1.7 |
| nap score bias / nap length multiplier | +0.25 / 1.6 | +0.12 / 1.3 | 0 / 1.0 | -0.08 / 0.8 | -0.15 / 0.6 |
| T_activity | 0.06 | 0.08 | 0.10 | 0.13 | 0.16 |
| settled fidgets per min / restless bursts per 10 min | 1 / 1 | 1.5 / 1.5 | 2 / 2 | 2.5 / 3 | 3 / 4 |
| run share of locomotion | 5% | 10% | 18% | 28% | 40% |
| rest + sleep time budget, no user (sim-checked, ±8%) | 70% | 60% | 50% | 40% | 30% |

### 6.11 Chaos sub-features

A sub-feature is effective only when `chaos.enabled && sub.enabled`. This is computed in Rust `validate()` and in `sim/chaos/effective.ts`.

| Sub | Adds | Modifies | Guardrails |
|---|---|---|---|
| **Wild Earl** | **Gremlin episodes** (`episodes.ts`): Poisson, one every 8-20 min, lasting 30-90 s. Inside an episode `sprint`, `zoomies`, `wall_climb` (unless `earl.wallClimbing` is `never`, D35), `wall_bounce` (replaces the dizzy wall_bump) and `tantrum` (if `wild.tantrums`) chain at high T, and the episode ends with an exhausted flop. `random_tantrum` always follows a visible petty trigger from the world or the episodic log (the ball rolled away, he couldn't reach the window, the fan ruffled him, the rubber duck got petted, a wall bump). | Outside episodes: chaosT +0.2, ε 4%, swings ×1.2, +1 activity row for locomotion only. Inside: chaosT +0.8, ε 8%, reconsider ×2. | fullscreen dampening; at least 80% of tantrums have a logged cause within 5 s before them (12.6) |
| **Messes with you** | `grab_cursor`, `flee_cursor` (as tag), `hide_behind_window`, `typing_honk`, `item_steal` ×2, `peek_pop` scares ×2 | chaosT +0.2 | see D27 and 7.8. `typing_honk`: at most 3 per hour; within one typing session the chance halves after each honk; the first burst after at least 10 min without typing is preferred. Grab: telegraphed, cursor idle 2.5 s, click shield. Nothing in fullscreen. Property tests for every cap. |
| **Duck swarm** | `swarm_visit`, `herd_ducklings` | none | see D10. Visits start only when Earl is on a floor, taskbar-top, wade-depth or window lane (he pops out first if deeper). Ducklings follow the leader with a 300-600 ms delay and light boids (separation), **each with one sampled quirk**: a dawdler that trips and peeps, a wanderer that heads for the cursor and must be herded back, or a copycat that mimics exactly with a lag. Their poses are limited to the baby shots through a fixed Earl-clip to baby-clip table (walk, sit, peep, sleep; a duckling may doze against a resting Earl with `baby_sleep`). **Clicking a duckling:** it peeps and scurries to Earl, and Earl reacts by mood (a protective puff, or a jealous side-eye at the cursor, logged to the episodic log). They scatter when Earl is grabbed and leave by waddling off a screen edge. |
| **Physics party** | `bounce_play`, `moon_hop` | gravity × setting, restitution from bounciness, trampoline ×2 (always on while enabled). `haywireItems` runs as **party bursts**: every 3-6 min, for 10-20 s, items hop, spin, the fan turns, the ball self-bounces and bread slides; Earl startles, then joins in or glares. Between bursts items rest, so the scheduler can idle. | long launches always deploy the chute; items never leave the primary monitor; only the ball and rubber duck collide with other items |

### 6.12 User interaction table

| Input | Stranger or wary | Buddy or bonded | Modifiers |
|---|---|---|---|
| click | a startled little hop, then a suspicious `earl_stare_01` | hop + chirp | Every tier's click reaction starts with a hop-class move (this is the fix for v1 bug #11 from day one). G > 0.6: hop then glare "hmph" or `peck_cursor`. Asleep: wakes groggy (G +0.1 if S > 0.5). P > 0.6: hop-spin. Behind lane: a startled bob, then `duck` (sink 1.0) and re-emerges elsewhere. |
| spam | tantrum or flee | huff "rude." | each extra click: G +0.12, grudge `spammed` |
| double-click | startled jump | happy flap or `show_off` | G > 0.55: angry honk. C high: sneeze (the "boop"). |
| pet (right-click or stroke), 1.2 s cooldown | first pets: `earl_petted_grumpy_01` with the head turned away; after 3-5 pets in 20 s he melts (`earl_petted_01` + heart). On day 1 the melt is guaranteed by the 2nd or 3rd pet (6.18). | melts faster, tail wiggle, may lean in and follow the cursor | Sulking: first 2 refused (shrug), except that a returning user's single pet forgives a needs sulk (6.3). Asleep: smiles and stays asleep. |
| hover (600 ms) | watches warily | looks up, maybe leans | Needs HUD. Asleep: wakes only after 1.5 s and not within the first 60 s of a nap. |
| pickup | squirm; if sessionWariness > 0.5 and G > 0.6, 30% chance to wriggle free after 1-2 s; roughMemory only adds a flinch and a bill grip on the taskbar edge | relaxed dangle | annoyance escalates within 30 s: G +0.05·(1-tr) each time |
| gentle drop | dusts off | lands happy | trust +0.003 |
| throw | first throws: alarm, "why."; after 3-4 soft landings in a session: "again!" (habituation, 6.4). Only slams and chute-less hard landings cause a grudge and about 2 min of avoidance | "wheee", F +8 | the chute always saves long falls |
| drop onto an item | the affordance runs, but may refuse (G > 0.7: steps off, glares) | the affordance runs, eagerly | see 8 |

### 6.13 Speech and voice

**Speech budget:**
- Token bucket, with rates set by `earl.speech`:

  | Setting | Tokens | Speak chance |
  |---|---|---|
  | off | - | - |
  | rare | 1 per 8 min | 0.15 |
  | normal (default) | 1 per 4 min, max 2 | 0.25 |
  | chatty | 1 per 2 min, max 3 | 0.4 |

- Lines never repeat within 20 min (shuffle bags per category).
- No speech in fullscreen. Speech is allowed mostly while he is watched; while the user is busy the speak chance is halved (6.16).
- Birthday, first_meeting, reunion, tier scenes and forgive bypass the bucket.
- **Glyph bubbles first:** about 3 of every 4 "say something" moments use a glyph bubble (5.12) instead of words.
- **Pool size rule:** every category that can fire daily has at least 6 lines before M2 exits (the table below is the seed; `speech/<category>.ts` holds the full pools). Lines can be **templated with event slots** from the episodic log (6.17), e.g. "you threw me. {when}. i remember.", "the {item} was good.", "that {window} is not safe."
- New categories: `callback` (templated, 6.17), `bonded` (rare, 6.20), `whim_win` / `whim_fail` (6.15), `reunion`, `guilt_trip`, `tag` ("fine. you got me.").

**Lines** (seed lines; pools are grown to at least 6 per daily category):

| Category | Lines |
|---|---|
| greet_morning | "mornin'." / "oh. you're here." / "...hi." |
| greet_return | "took you long enough." / "i wasn't waiting." / "oh. you're back." |
| pet_grumpy | "hmph." / "...don't stop." / "fine. one more." |
| pet_melt | "...ok this is nice." / "*happy peep*" |
| spam | "rude." / "i bite." / "STOP." |
| thrown_bonded | "again!" / "wheee" |
| thrown_wary | "why." / "i'll remember that." |
| sulk | "not talking to you." / "hmph." |
| forgive | "...fine." |
| caught (taskbar vanished) | "i wasn't hiding." / "...hi." |
| hungry | "bread. now." |
| sleepy | "*yawn*" / "night." |
| rubber_duck | "who's this guy." / "...he's alright." |
| typing_honk | "HONK." |
| first_meeting | "...hi." |
| reunion (a v1 config was found) | "oh. it's you. ...good." / "new me. same you." |
| callback | "you threw me. {when}. i remember." / "the {item} was good." / "{where}. not going there." |
| bonded | "...i like you. don't make it weird." / "juliette." (once a day, as a greeting) |
| guilt_trip | "oh. NOW you're here." / "...i was fine. totally fine." |
| whim_win / whim_fail | "ha." / "...that wall moved." |
| update | "psst... new me" |
| chaos_on | "hehehe" |
| birthday Juliette (4/4) | "happy birthday juliette!!" / "it's YOUR day." / "i got you this honk. HONK." |
| birthday Cam (6/23) | "happy birthday cam." / "don't make it weird." |

**Voices:**

| Voice | Recipe |
|---|---|
| quack | saw f0 520 Hz, pitch +10% over 30 ms then -25%; formants 900 Hz Q4 and 2400 Hz Q6; 10 ms noise attack; 90-160 ms |
| honk | square/saw at 330 Hz, 220-350 ms, 25 Hz vibrato at 3% |
| peep / chirp | sine 1800 to 2600 Hz, 60 ms |
| boing | sine 180 to 420 Hz, 12 Hz vibrato; pitch by height |
| splash / shake | bandpass noise 1.5-4 kHz, 3-6 grains |
| nom / peck | 2-3 ms highpassed clicks, irregular |
| pop (chute) | noise + 90 Hz thump |
| snore | quiet low sine swell, 6-10 s jittered |
| step | soft filtered tick (only if `sound.footsteps`) |
| rustle | lowpass noise swell |
| bloop | sine drop from 600 to 300 Hz, 80 ms |

**Variation rules:**
- **Per call:** pitch ±8% (gaussian), duration ±15%, gain ±10%, onset 0-40 ms.
- 20% of quacks are doubled.
- **Mood colouring:**
  - A: +6% pitch, softer attack.
  - G: -8% pitch, +30% square, shorter.
  - S: slower and quieter.
  - Ducklings: +70% pitch.
- **Limits and volume:**
  - At most 1 vocalization per 1.5 s.
  - **Hourly vocalization budget:** 20 per hour normally, 8 per hour while the user is busy (6.16), a token bucket shared by quacks, honks and speech sounds (footsteps and ambient item sounds are exempt). An office must never have a reason to mute him.
  - Night 22:00-07:00 (if `sound.quietHours`): volume ×0.6 and half as many vocalizations.
  - Fullscreen: ×0.5.
  - `muteWhenBusy`: silent under `QUNS_BUSY`, presentations and D3D.

### 6.14 Tuning

`sim/brain/tuning.ts` exports one deeply readonly `TUNING` object in human units, with a comment per field:
- `personality` defaults (overridden by the settings)
- `affect`
- `needs`
- `relationship`
- `decision {topK 6, epsilon 0.03, switchRatio 1.25, switchMargin 0.05, commitBonus 0.15}`
- `activity` (the 5 rows)
- `chaos`
- `taskbar {behindShare by setting (0 / 0.15 / 0.6 / 0.85; default level sometimes), visitStayMedian 90 s (sometimes), sinkWade [0.15, 0.30], sinkPeek 0.55, sinkEyes 0.63, sinkCrest 0.80, busyMul 1.5, watchedMul 0.4}`
- `zones {roamMinSpan 0.25, returnToRangeMaxS 10, calmClimb {weight 0.05, cooldownMin 15, maxHeight 0.4}}` (D35)
- `speech`, `attention`, `whims`, `episodic`, `arcs`
- per-behavior weight and cooldown overrides live next to each behavior file (not in one shared `tuning.ts` table), so parallel units never edit the same file

**Dev builds only:**
- `%APPDATA%/com.threxai.earl/tuning.override.json` is deep-merged and hot-reloaded every 2 s.
- The debug overlay (`Ctrl+Alt+Shift+F12`) has a Brain tab: affect and needs bars, the top 6 utilities with probabilities, the last decision and why, and time warp (×10 / ×60).
- `npm run sim -- --hours 8 --activity 50 --mode needs --items bed,bread,ball --seed 42 --taskbar visible` prints behavior time shares, interval histograms, the visual-signature metrics (12.6) and, per behavior, the fraction of time spent on fallback frames, so every subjective-hour note is tagged with which behaviors were placeholders.

### 6.15 Whims (goals, both mood modes)

`brain/whims.ts`. The brain holds 1-3 short-lived goals, each lasting minutes, so pure personality mode has intent and not just noise.
- **Examples:** reach that window top; get the ball to the left corner; guard a spot; catch the critter (6.19); stash the bread (8.2); sit exactly at the screen corner; beat the rubber duck to the tub.
- **Spawn:** at decision points with p ∝ C and P, from the current context (a new window, a placed item, a critter, an episodic memory). Wild raises the rate. A whim is never spawned for a target in a disallowed zone (D35): no window-top whims with perching off, nothing outside the roam range, no "stash the bread" with `taskbarHiding = never`.
- **Persistence:** a whim survives across behaviors. Behaviors that advance it get `+0.4·progress` utility (6.6). Failed attempts retry with variation: a run-up, a second attempt from elsewhere, using the trampoline as a step.
- **Payoff:** success plays `earl_tada_01` (or a hop-spin) plus a look at the cursor (`whim_win`). Failure after 2-4 attempts plays a small tantrum or a sulk with a glare at the obstacle (`whim_fail`), which is also a logged cause for later tantrums.
- **Test:** at defaults, at least 3 whims start per awake hour and at least 25% end in visible success.

### 6.16 Attention model (watched / busy)

`brain/attention.ts`, from the far-field pointer events (4.3) and `platform://activity`.
- **watched:** the cursor is within 8 body lengths of him, or slow in the bottom band, or the user is idle but present (mouse moves, no typing). Showy and social behaviors ×1.5; speech allowed; the behind share drops (×0.4) and, if he is behind, the lane goes to wade depth (5.6).
- **busy:** typing, or fast cursor work elsewhere on screen. Cross-screen locomotion ×0.5; vocals and speech halved; the hourly vocal budget drops to 8 (6.13); behind-lane rest at peek depth and quiet fidgets are favoured.
- **neither:** normal scoring.
- **attention_seek backs off** when ignored: next attempts after 10, then 20, then 40 min, then he gives up with a "hmph" until the next interaction.
- **Audience check:** after a notable success, failure or landing, 30% look toward the cursor (6.7).

### 6.17 Episodic log (persisted memory)

`brain/episodic.ts`, stored in `state.brain.episodic`, so he can refer to shared history.
- **Entries:** about 32 of `{kind, x or surfaceId, itemId?, t, valence, intensity}`, pruned by `salience × recency`. Kinds include slam, hard landing, fell off window, bread eaten, bread put away, ball game, rubber duck petted, a big nap in the bed, a tier scene, a whim won or lost, a duckling click.
- **Callbacks** (ordinary scored behaviors, 7.3):
  - he avoids the spot of his last hard landing for about 1 h (walks around it and eyes it);
  - after bread is eaten or put away, he returns to where it was and looks around confused;
  - he glares at a window he fell from when it reappears;
  - he stares at the rubber duck's old spot;
  - the morning greeting references yesterday's top event ("you threw me. yesterday. i remember." / "the bread was good.").
- **Test:** after a scripted slam, a callback behavior occurs within 2 sim-hours in at least 60% of 16 seeds.

### 6.18 Onboarding arc (first day, first week)

`brain/arcs.ts`. A fresh install is a stranger-tier Earl, and warming up slowly is a requirement, but it must read as a charming pretense, not as him being unpleasant.
- **Honeymoon (first 2 h after first_meeting):** C +0.25; he approaches and investigates the cursor on his own; `honeymoon` adds +0.1 to the A baseline, fading over the 2 h.
- **Resists then melts:** on day 1 the 2nd or 3rd pet is guaranteed to produce the `petted_grumpy` to `petted` transition with a heart. The warm-up shows as a fading pretense ("hmph" while leaning in), and his behavior toward her is never avoidant on day 1 unless she slams him into a wall.
- **Discovery beat (about 10 min in):** the toolbox drawer opens briefly by itself, Earl drags a ball out (auto-placed, persisted) and a one-time bubble shows the toolbox hotkey.
- **Chaos teaser (first week, once):** during a normal zoomies he does one small gremlin act (a single cursor-free prank such as stealing the ball behind the taskbar, or rolling it to the far end of his range when `taskbarHiding = never`; zone gates apply, D35), and the tray gets a one-time "Try Chaos mode?" hint line.
- **Reunion:** if a v1 config was migrated (D29), first_meeting and the honeymoon are replaced by `reunion` (he pops up, stares, then trots over with a heart: "oh. it's you. ...good.").
- **Tests:** a pet leads to the melt beat within 3 pets; no `avoid_cursor` on day 1 without a slam; the discovery beat fires once and never again.

### 6.19 Ambient life (critters and evidence of absence)

- **Ambient critter** (`sim/critters.ts`): a canvas-drawn fly or ladybug appears every 10-30 min (not in fullscreen or quiet time), lands on the taskbar edge or a window top, and Earl stalks it, pecks, misses and glares. It is a curiosity stimulus, a petty cause for mood swings and tantrums (6.2), and a whim target.
- **Evidence he lived while she was gone:** on resume after 10 min or more away (lock, long idle), 1-3 plausible off-screen consequences are applied from state before the first frame: an item nudged, bread partly eaten with crumbs left, the ball on the other side, him asleep in the bed or at his favourite spot. He starts mid-activity so she "catches" him (freeze, then an innocent look away), then `greet_return` plays.

### 6.20 Tier-gated content (the payoff for warming up)

| Tier | New content |
|---|---|
| acquaintance | follows the cursor openly for short stretches; accepts pets faster |
| buddy | **fetch:** brings the ball to the cursor and waits; clicking the ball flicks it, he chases it and brings it back. Naps near where the cursor rests. Leaves her a crumb. Click reaction is a happy hop + chirp. |
| bonded | falls asleep leaning against a parked cursor; guards the cursor from the rubber duck; runs to greet her return; rare `bonded` lines, including "juliette." once a day as a greeting |

- **Tier-crossing scenes:** a one-time scene when she first crosses into buddy and into bonded (a hesitant approach, a nuzzle, a heart and a line), recorded in `tierScenesSeen` and mirrored by the About tab's hearts filling in with a small animation.

---

## 7. Behavior catalogue

**Notation:**
- G P C S A are the expressed affects. H E F K are needs in 0..1.
- tr = trust, fo = fondness, wy = wariness.
- bl = body lengths. curD = cursor distance in bl.
- Every score is also multiplied by the repetition penalty, moodFit and the gates.
- CD = log-normal median cooldown (σ 0.45).

Shot ids are exact frame file names from `ART_SHOTLIST.md` (`..` means a numbered range). Any frame not yet delivered falls back per 5.11.

**Lane gates:**
- Behaviors tagged `surface` (they need a real surface under his whole body: jumps, perching, items, trampolining, zoomies, sprint, wall climbs, ball play) run in `onTaskbar | floor | window | item`. In `behindTaskbar` they first run `climb_onto_taskbar`; with `always` he returns behind automatically 1-3 s after they end, with `mostly` going back behind is an ordinary scored `slip_behind_taskbar` (with its strong behind-share pull), and with `sometimes` (the default) he stays on top.
- Every other behavior (rest, sleep, fidgets, social in place, emotional, wander and trot, speech, honks) runs on the taskbar top by default and also runs in `behindTaskbar`, during a visit, at the depth the context picks (5.6), with ordinary full-body clips clipped at the edge.

**Zone gates** (D35; `behaviors/types.ts` declares `zones` per behavior, `utility.ts` applies them as `zoneGate`, 6.6):

| Zone | Setting that disallows it | Behaviors that get zero utility |
|---|---|---|
| behind the taskbar | `earl.taskbarHiding = never` | every 7.5a behavior except `climb_onto_taskbar` and `return_to_range` (which run at every level); `rest_behind` and `hide_nap`; the behind variants of `sulk` and `goodnight` (they fall back to their on-top versions); `item_steal` into the stash (pushing stays); `edge_hide` |
| window tops | `earl.windowPerching` off | `perch_jump`, `perch_walk` / `perch_sit`, `perch_hop_across`, `ride_window`, `umbrella_ride` from a perch, window-top whims, critter stalking on a window top |
| screen edges (climbing) | `earl.wallClimbing = never`, or `wildOnly` outside a Wild gremlin episode | `wall_climb` |
| ground outside the roam range | `earl.roamRange` narrower than the screen | wander and trot targets, rest spots, item use, stash and critter targets outside the range; `edge_peer`, `edge_hide`, `wall_bump` and `wall_climb` at an edge the range does not touch |
| fullscreen with items | `general.fullscreen = stayAtBottom` or `hide` | every item behavior while a fullscreen `app` is up |

Reflexes and user actions are exempt but resolve toward allowed zones: dropped onto a window with perching off, he hops straight down (`jump_down`); thrown or dragged outside the roam range, he lands where physics puts him and then walks back in (`return_to_range`, a plain walk with a glance around, no mood effect, at most 10 s).
- **Pose-class mapping:** `earl_look_01`, `earl_look_up_01` and `earl_stare_01` in the tables below mean the `look`, `look_up` and `stare` roles (5.11); standing and locomotion uses resolve to `earl_stand_look_01` and `earl_stand_look_up_01`, peek uses to `earl_peek_look_01`.

### 7.1 Locomotion and exploring

| id | Trigger / utility | Player sees | Shots | Sound | Effects | CD |
|---|---|---|---|---|---|---|
| wander | 0.35·(0.5+0.5C)·(1-S)·restless (restless rises 0 to 1 over the idle dwell) | glance, stands up if sitting, waddles to a novelty-sampled spot, 20% stop midway to look | earl_sit_to_stand_01, earl_walk_01..03, earl_sit_side_01 | 10% soft peep | E drain, novelty | none |
| trot | 0.2·P·step(E>0.4)·act | brisk run with bouncy bob | earl_run_01..04 | none (footsteps optional) | E -1.5/min | none |
| sprint (Wild) | 0.25·(P+G)/2·step(E>0.5) | flat-out run, 10° lean, dust puffs, speed lines | earl_run_01..04 | rapid peeps | E -3/min | 2 min |
| investigate | 0.5·C·salience·nov(target) | walks to the stimulus, stops 1.2 bl away, leans and sniffs, looks back at you | earl_walk_01..03, earl_sniff_01, earl_look_01 | "hm?" chirp | C down, novelty reset | 3 min per target |
| happy_hops | 0.2·P·A | 1-3 hops in place, 30% with a mid-air facing flip | earl_hop_squat_01, earl_hop_air_01 | hop chirp | F +2 | 1 min |
| zoomies | 0.12·P²·step(E>0.6)·act (×3 Wild) | 2-4 frantic laps, skids at turns, flops after | earl_run_01..04, earl_land_squish_01 | peep-peep-peep | E -3/min, F up, P down after | 8 min (4 Wild) |
| edge_peer | 0.15·C at a screen edge | peers off-screen past the edge (clipped), turns back | earl_sniff_01, earl_look_01 | none | novelty | 4 min |
| edge_hide (no taskbar) | 0.3·behindShare·(wy or sulk or shy) with ground = screen | slips past the side edge so only his head shows, peeks back | earl_walk_01..03, earl_look_01 | bloop | G -0.03 if scared | 2 min |

### 7.2 Rest and sleep

| id | Trigger / utility | Player sees | Shots | Sound | Effects | CD |
|---|---|---|---|---|---|---|
| sit | 0.3·(1-arousal)+0.1 | plops down, fidgets | earl_sit_to_stand_01 (reversed), earl_plop_01, earl_sit_idle_01 / earl_sit_side_01 | none | E +0.3/min | none |
| stand_idle | 0.25 filler | stands, mood-picked resting pose | earl_stand_front_01 / 6.2 resting frame | none | none | none |
| rest_behind | 0.3·behindShare_ctx·(0.4+0.6·(1-arousal)) with taskbar present (5.6 context multipliers); at the default `sometimes` this is a short visit, mostly when the user is busy | settles chin-on-edge and peek-bobs, looking around | earl_peek_01, earl_peek_blink_01, earl_peek_look_01 / earl_peek_grumpy_01 / earl_peek_happy_01 | bloop on sink | E +0.3/min | none |
| doze_off | 0.4·S·step(sitting or behind) | head nods (bob); 40% jerks awake, else naps | earl_sit_sleepy_01, earl_startle_01 | tiny snort on the jerk | S down on jerk | 3 min |
| nap | 0.6·S^1.5·(1-E)^0.7 + 0.2·night + actBias | yawn, turns in a circle, plops, sleeps with breathing and Zzz. Median 4 min × activity | earl_yawn_01..02, earl_plop_01, earl_sleep_sit_01 | snore every 6-10 s | E +2.5/min, S drains | 10 min |
| hide_nap | if a taskbar is present: nap ×0.5 at `sometimes` (so most naps stay on top and a nap behind is an occasional choice), nap ×(1.2 + behindShare) at `mostly` and `always`; more if wy > 0.4 or G > 0.5 | naps behind the taskbar, only the crest and Zzz show | earl_peek_sleep_01 | snore (quieter) | as nap | shared with nap |
| bed_sleep | nap ×1.4 if a bed exists | walks to the bed, pecks the pillow twice, climbs in, sleeps longer (median 7 min) under the blanket | earl_peck_01..02, earl_hop_squat_01, earl_sleep_lie_01 (+ prop_bed_01 / prop_blanket_02 layers, acc_nightcap_01 at night) | snore | E +5/min | 10 min |
| stretch | on waking (70%), after a sit of 2 min or more (0.2), always on the morning wake | long stretch, wings high | earl_stretch_01 (+ procedural stretch) | "mmrrh" chirp | S -0.1 | 5 min |
| wake | reflex when a nap ends or is disturbed | blinks, looks around; grumpy glare if woken by the user with S > 0.5 | earl_sit_sleepy_01, earl_sit_blink_01, earl_stare_01 | groggy quack | G +0.1 if disturbed | none |

### 7.3 Social

| id | Trigger / utility | Player sees | Shots | Sound | Effects | CD |
|---|---|---|---|---|---|---|
| stare_at_cursor | cursor still 1.5 s or more at curD < 6 | turns, stares, head tilt | earl_stare_01, earl_tilt_01 | none | C +0.02 | 1 min |
| follow_openly | 0.4·A·fo·step(fo>0.55)·cursorMoving | waddles after the cursor's x, stops close, looks up | earl_walk_01..03, earl_look_up_01 | happy peep | A up, F up | 3 min |
| follow_secretly | 0.45·bell(G,0.55,0.25)·step(fo>0.45)·(1-wy) | trails 4-7 bl behind; freezes and preens or looks away when the cursor turns toward him; creeps closer if it stays still | earl_walk_01..03, earl_preen_01..02, earl_look_01 | one "hmph" | A up | 4 min |
| lean_on_cursor | cursor still 3 s or more at curD < 1.2, A above its 70th percentile | leans into it (12° tilt) while looking away ("hmph"), tiny heart; bonded: open lean, eyes closed | earl_sit_happy_01, earl_look_01 (head turned) | trill | fo +0.001, A up | 5 min |
| chase_cursor | 0.4·P·step(cursor moving in the bottom 25% of the screen) | chases and pecks at the tip | earl_run_01..04, earl_peck_01..02 | peck clicks | F +1/s, E drain | 3 min |
| peck_cursor | cursor lingers at curD < 1.5 and G > 0.5 | pecks at it, glares | earl_peck_01..02, earl_sit_huffy_01 | low "hmph" quack | G -0.05 | 1 min |
| avoid_cursor | wariness > 0.5 (session part, 6.4) or grudgeSum > 0.4, cursor within 3 bl; never on day 1 without a slam | backs off or runs 3-6 bl, looks back suspiciously | earl_walk_01..03 / earl_run_01..04, earl_stand_look_01, earl_suspicious_01 | nervous peep | none | 30 s |
| greet_return | user back after 5 min or more idle | looks up; high fo: trots over; high G: turns his back | earl_look_up_01, earl_walk_01..03, earl_sulk_01 | greeting quack | A +0.05 | 20 min |
| watch_typing | userBusy for 5 s or more | faces the screen centre, head bobs | earl_look_up_01 (+ bob) | none | C up | 5 min |
| attention_seek | missedYou and fo > 0.5, not busy | walks to the middle of his roam range (the bottom centre by default, D35), stares, then does something silly | earl_stare_01, then show_off / sneeze / flop | quack | F up | backs off 10, 20, 40 min, then gives up with a "hmph" until the next interaction (6.16) |
| show_off | 0.3·P·watched | hop-spin, then looks toward the cursor for approval | earl_hop_squat_01, earl_hop_air_01, earl_tada_01 | ta-da chirp | F +3 | 3 min |
| callback_* | episodic entry salient and context matches (6.17) | avoids a landing spot, looks for eaten bread, glares at a window, stares at an old spot; morning line about yesterday | earl_stand_look_01, earl_stare_01, earl_side_eye_01, earl_sit_huffy_01 | "hmph" or glyph | memory salience down | 30 min per entry |
| fetch (buddy+) | ball placed, fo > 0.55, P mid or high | pushes the ball to the cursor and waits; after a flick he chases and returns it | earl_push_01..02, earl_run_01..04, earl_stare_01 | happy peep | F +3, fo +0.002 | 5 min |
| tier_scene | first crossing into buddy or bonded (6.20) | hesitant approach, nuzzle, heart, a line | earl_walk_01..03, earl_nuzzle_01, earl_petted_01 | trill | once per tier | none |
| whim_pursuit | an active whim (6.15) | goal-directed attempts with retries; tada or tantrum at the end | per whim | per whim | per whim | none |

### 7.4 Emotional

| id | Trigger / utility | Player sees | Shots | Sound | Effects | CD |
|---|---|---|---|---|---|---|
| pout | 0.35·bell(G,0.55,0.12) | sits facing away from the cursor | earl_sit_pouty_01, earl_sulk_01 | occasional "hmph" | slow G release | 2 min |
| huff | 0.4·step(G>0.62)·recentAnnoyance | puffs up, one stomp, sharp exhale | earl_sit_huffy_01, earl_tantrum_01 | short honk | G -0.05 | 2 min |
| tantrum | reaction: G above its 90th percentile plus a trigger; or random_tantrum (Wild, always after a logged petty trigger, 6.11); or a failed whim | stomps 1.2-2.5 s (mirrored alternation), steam, shakes, flings a wing | earl_tantrum_01 (alt mirror), earl_angry_01, earl_puffed_up_01 | honk ×2-4 | catharsis G -0.2 | 5 min (2 Wild) |
| sulk | sulkPressure > 3 (Needs) or grudgeSum > 0.7 | back turned; ignores items except the needed one; refuses the first 2 pets; with a taskbar present (and `taskbarHiding` not `never`) he goes behind it, eyes only, and climbs back on top when the sulk ends. Active for at most 10 min, then a resigned nap (6.3) | earl_sulk_01, earl_sit_pouty_01, earl_peek_grumpy_01 (eyes depth, sink 0.63) | rare sigh | blocks social behaviors | until resolved |
| guilt_trip | she returns while he is sulking or hungry after an absence | pointed look at the empty food spot, sigh, `guilt_trip` line | earl_stare_01, earl_sit_pouty_01 | sigh | none | once per return |
| forgive | a single gesture after an absence (feed OR pet), or need tended + 1 pet, or G falls below its 60th percentile from above its 88th | looks at you, sigh, "...fine.", small hop | earl_look_01, earl_sit_idle_01, earl_hop_air_01 | soft quack | fo +0.002 | none |
| content_wiggle | 0.3·A·step(G below its 50th percentile) | eyes-closed smile, wiggle, heart | earl_wiggle_01 (alt mirror), earl_petted_01 | trill | none | 3 min |
| sad_moment | 0.15·(1-valence)·step(fo>0.4)·missedYou | droops, big wet eyes, tiny sigh | earl_sad_01 | soft peep down | A up | 15 min |
| startle | reaction: something dropped within 3 bl, a sudden window, a fast cursor | small jump, feathers puff 200 ms, "!", then investigate (C > wy) or flee | earl_startle_01, earl_puffed_up_01 | "wak!" | C +0.1 or G +0.05 | 20 s |
| caught | reaction: FLOOR_CHANGED exposed, or the auto-hide taskbar revealed over him | freezes, looks around, shakes it off ("i wasn't hiding.") | earl_startle_01, earl_look_01, earl_shake_01 | "wak!" | G +0.03 | none |

### 7.5 Terrain

**7.5a Behind-lane behaviors** (taskbar present, `taskbarHiding != never`; `climb_onto_taskbar` and `return_to_range` are listed here but run at every level and on every ground). His home is the taskbar top (D1); at the default `sometimes` these are occasional visits (5.6 "Visits"), at `mostly` and `always` they are where he lives. All of them stay inside the roam range (D35):

| id | Trigger / utility | Player sees | Shots | Sound | Effects | CD |
|---|---|---|---|---|---|---|
| slip_behind_taskbar | behindShare pull (5.6, contextual) + sulk + shy (A and G both mid) + scared (wy) + a busy user (peek) + curiosity (a wade-depth look along the taskbar); with `always`, automatically 1-3 s after any surface behavior ends; never automatic at `sometimes` | hops down and sinks behind the edge to the context's depth | earl_hop_squat_01, earl_stand_front_01 (sinking), then wade clips or earl_peek_01 | bloop | G -0.03 if scared | 1 min at `mostly` / `always`, 4 min at `sometimes` (none for the automatic return) |
| wade_walk (was periscope_walk) | wander, trot or follow while behind; the **default wander in the taskbar lane** under `mostly` and `always`; at `sometimes` only to move along during a visit | a real waddle along behind the edge at wade depth; head, wings and chest show, the walk cycle bobs | earl_walk_01..03 (clipped, feet on the virtual floor) | none | novelty | none |
| peek_pop | the cursor **lingers** within 2 bl for at least 600 ms at under 300 px/s, and is **not** heading down into the taskbar: gremlin pops up (P > A) or shy ducks lower (A > G) | pops up "boo", or sinks to eyes only | earl_hop_air_01, earl_peek_01, earl_peek_grumpy_01 | "boo" honk | F +2 | 2 min |
| whack_a_mole | clicked while behind, or the same lingering-cursor rule while G is above its 75th percentile | ducks fully (sink 1.0 in 120 ms), re-emerges 1-4 s later somewhere else along the taskbar (inside the roam range) | earl_peek_01, earl_peek_look_01 | bloop | F +1 if P | 30 s |
| climb_onto_taskbar | any behavior tagged `surface`, pop-out, or the end of a visit at `sometimes` (its reason ended, or the stay ran out) | hops up onto the taskbar top, home | earl_hop_squat_01, earl_hop_air_01 | hop chirp | none | none |
| return_to_range | he is on the ground outside the roam range (after a drag, throw, fall or fullscreen) | glances around, walks back inside | earl_stand_look_01, earl_walk_01..03 | none | none | none |

**7.5b Windows, walls, falls:**

| id | Trigger / utility | Player sees | Shots | Sound | Effects | CD |
|---|---|---|---|---|---|---|
| perch_jump | 0.25·C·(1+P)·nov(window)·step(E>0.35), target reachable (15% deliberate overreach, 6.6); zero with `earl.windowPerching` off (D35) | looks up, crouches and holds 300-700 ms, jumps, lands with a squish; on an overreach falls short, slides, embarrassed glance, retries | earl_stand_look_up_01, earl_hop_squat_01, earl_jump_up_01, earl_land_squish_01, earl_flail_01..02 | effort grunt, landing thump | E -2 | 3 min |
| perch_walk / perch_sit | on a window | walks along it, peers over the ends, sits with his feet over the edge | earl_walk_01..03, earl_sniff_01, earl_sit_idle_01 | none | novelty | none |
| perch_hop_across | an adjacent segment is reachable | jumps between windows | earl_jump_up_01, earl_hop_air_01 | hop chirp | F +2 | 1 min |
| jump_down | leave a perch (boredom, a need, an item calling) | peers down, teeters, jumps; chute if the drop is over 5 bl | earl_teeter_01..02, earl_hop_air_01 | "wheee" if P | none | none |
| ride_window | window moving slower than 150 px/s and **not** a user drag (no `surfaces://grabbed`) | surfs it with a wobble | earl_tada_01 (+ tilt) | delighted peep if P, else alarmed | F up, or G up if not P | none |
| fall_off (reflex) | PERCH_LOST, or `surfaces://grabbed` on his window (after a 150-300 ms scramble) | alarmed flail, fall, chute if high enough; logged to the episodic log | earl_flail_01..02, earl_hang_alarm_01 | "wak!" | G +0.08 | none |
| hide_behind_window (Messes) | a `hideable` window (bottom edge below his eye line, or he is perched on it) | sidesteps behind the window's side edge (clipped); **at least one eye always stays visible** (feet showing under the window is part of the gag); at most 90 s; ends with a "found me!" reaction when the cursor comes within 3 bl | earl_walk_01..03, earl_sit_side_01 (clipped at the edge), earl_startle_01 | "found me!" peep | F up | 5 min |
| wall_bump | walked into an edge (made rarer by wall memory) | bonk, dizzy stars | earl_wall_bump_01, earl_dizzy_01..02 | bonk | G +0.05 | none |
| wall_bounce (Wild) | the same, while running | ricochets with a spin, no dizziness | earl_tumble_01 (spun) | boing | F up | none |
| wall_climb (`earl.wallClimbing`, D35) | default `wildOnly`: 0.2·(P+C)/2 at a screen edge inside a Wild gremlin episode. `anytime` adds a calm version outside Wild: 0.05·C at an edge, 15 min CD, up to 40% height, always a gentle slide back down. `never`: zero. Only at an edge the roam range touches | Wild: scrambles up to 30-70% height; then slides down (40%), backflips off with the chute (35%), or sits proudly on nothing, looks down, falls (25%). Calm: climbs a little, looks around, slides down | earl_climb_01..02, earl_tada_01, earl_flail_01..02, earl_tumble_01 | scrabble clicks | F +5, E -3 | 6 min |

### 7.6 Items (Earl's side; item physics in section 8)

| id | Trigger / utility | Player sees | Shots | Sound | Effects | CD |
|---|---|---|---|---|---|---|
| trampoline_bounce | 0.4·P·step(E>0.3)·like, or dropped on it | climbs on, 3-8 rising bounces, tuck-flip or star jump at the top, 20% bounces off sideways | earl_hop_squat_01, earl_bounce_tuck_01, earl_bounce_star_01, earl_hop_air_01 | boing, pitch rising | F +1.5/s, E -3/min | 3 min |
| eat_bread | Needs: 0.8·urg(H). Pure: 0.2·P + 0.15. G above its 88th percentile: one nibble, then walks off with his back turned. Fed while hungry: gratitude beat (6.3) | tears and pecks, gulps with a look up, crumbs | earl_peck_01..02, earl_stand_look_up_01, earl_chew_01 | nom clicks | H +10 per bite, K -3, A +0.03, G -0.05 | 30 s between bouts |
| eat_seeds | same score ×0.8 | irregular pecking rhythm | earl_peck_01..02 | tick-tick | H +5 per bout | 30 s |
| bath_splash | Needs: 0.6·urg(K)+0.3·P. Pure: 0.3·P·like. Refuses if G > 0.7 (pokes the water, walks off) | wades into the tub, splashes (droplets), hops out, shakes dry with spray, wet footprints for 10 s | earl_hop_air_01, earl_splash_01 (alt mirror), earl_shake_01 (alt mirror), earl_puffed_up_01 (fluffy after) | splash grains, shake rattle | K up to 100, F +10, G -0.1, like +0.03 | 5 min |
| drink | 0.2 when passing the tub | dips his bill, looks up swallowing | earl_peck_01, earl_stand_look_up_01 | sip | none | 2 min |
| ball_play | 0.45·P·like(ball) | runs at it, kicks, chases, dribbles; 20% keep-away from the cursor; headbutts | earl_run_01..04, earl_kick_01..02, earl_hop_air_01 | thunk on kick, peeps | F +2/s, E drain | 2 min |
| rubber_duck | phase by like: **suspicious** (below 0: circles, squints, pecks once, jumps back), **jealous** (the user pets or drags the duck: huffs, shoves it away, grudge duckFavoritism), **friend** (above 0.4: sits beside it, peeps, naps next to it, pushes it along) | per phase | earl_suspicious_01, earl_peck_01, earl_side_eye_01, earl_push_01..02, earl_nuzzle_01, earl_sit_side_01 | squeak when pecked, "hmph", friendly peeps | like +0.05 per calm interaction, -0.1 per favoritism | 4 min |
| fan_reaction | fan on within 8 bl | leans into the wind, feathers jitter, slides; P: stands in it flapping; G: glares, then kicks it off | earl_windblown_01, earl_kick_01..02, earl_sit_huffy_01 | none (the fan hums) | F up or G up | 3 min |
| fan_switch | 0.2·C·like(fan) + 0.3 after a tantrum (cool off) | walks up, pecks the switch on, stands in the breeze | earl_peck_01, earl_windblown_01 | click | G -0.05 | 5 min |
| umbrella_hide | 0.35·max(sulk, wy, 0.5G), also under fan wind | stands under the open umbrella, peeks out | earl_sit_idle_01 / earl_sit_pouty_01 (+ prop_umbrella_open_01 front layer) | none | G -0.05 | 4 min |
| umbrella_ride | **v2.0 scope:** `jump_down` from a perch or the trampoline while standing next to an open umbrella; he grabs it on the way off (no walking carry, since no overhead-carry art is in P0/P1; `earl_carry_overhead` is P2) | floats down Mary-Poppins style | earl_hang_01 (+ prop_umbrella_open_01) | "wheee" | F +5 | none |
| item_steal | 0.15·P·(0.5+G) (×2 Messes; also a whim, "stash the bread") | pushes an item across the screen, or drags a **small** item (bread, seeds, ball, rubber duck) into his **stash** behind the taskbar (8.2) and guards it, peeking over it; the stash is logged as a callback target | earl_push_01..02, earl_kick_01..02, earl_peek_01 | gremlin chuckle (staccato quacks) | F +5 | 6 min |
| king_of_hill | 0.1·P | sits on top of an item (bed, tub rim, fan) | earl_sit_idle_01, earl_tada_01 | none | none | 5 min |
| on_dropped_onto_item | reaction: released over an item's use zone | the affordance runs: bounce; sleep if S > 0.4 (else hops off); splash; eat; grab the umbrella | per item | per item | per item | none |

### 7.7 Airborne (reflex and reaction)

| id | Trigger | Player sees | Shots | Sound | Effects |
|---|---|---|---|---|---|
| picked_up | drag threshold | tr > 0.6: relaxed dangle with swing. tr < 0.35: squirms, maybe wriggles free | earl_held_01, earl_held_grumpy_01, earl_held_side_01, earl_flail_01..02 | pickup chirp (pitch by mood) | G +0.05·(1-tr) |
| thrown | released faster than 200 px/s | spins, flails; upward velocity kept | earl_tumble_01 (spun), earl_flail_01..02 | "wak!" or "wheee" | per 6.4 |
| parachute_glide | 5.5 arming | the canopy pops (scale-in 0.2 to 1), sways down, the fan pushes it; G glares while gliding, P kicks his feet | earl_hang_01, earl_hang_alarm_01, prop_parachute_01..05 | pop, rustle | soft landing, no hard-landing penalty, F +5 if P |
| land | touchdown | squish scaled by impact; big hits: dizzy; bonded and playful: sticks the landing | earl_land_squish_01, earl_dizzy_01, earl_tada_01 | thump (pitch by impact) | per 6.4 |

### 7.8 Chaos-only and special

| id | Trigger | Player sees | Shots | Sound | Notes |
|---|---|---|---|---|---|
| grab_cursor (Messes) | 0.3·P·(0.5+G)·cursor idle at least 2.5 s within 2 bl, all guardrails met (D27, 4.8) | **telegraphs for 0.8-1.5 s** (stare, butt wiggle, creep), then clamps the cursor in his bill and drags it 80-200 px, horizontal-dominant, over 0.6-1.0 s, lets go, looks smug. The click shield catches any click for 600 ms ("hey!"). If the user pulls against him (opposing delta over 30 px), he releases at once and tumbles back | earl_stare_01, earl_tug_01..02, earl_walk_01..03 | muffled honk | F +5, 10 min CD |
| flee_cursor (Messes) | a **fast** approach (over 800 px/s), P > 0.4; a slow approach never triggers it | a game of tag: runs off, looks back taunting; after 1-3 dodges he lets himself be caught, and a pet then gets the melt reaction ("fine. you got me.") | earl_run_01..04, earl_stand_look_01, earl_petted_01 | "nyeh" quacks | F +2, 1 min CD |
| typing_honk (Messes) | typing burst of 4 s or more; at most 3 per hour; chance 20% halving after each honk within a typing session; prefers the first burst after 10 min without typing | turns to the screen: "HONK." | earl_honk_01..02 | honk | 3 min CD |
| herd_ducklings (Swarm) | visit active | P or A: leads a parade; herds the wanderer back from the cursor. G: honks and herds them | earl_walk_01..03, earl_honk_01..02, baby_walk_01..02, baby_peep_01 | duckling peeps (+70%) | the visit ends with the ducklings waddling off an edge |
| bounce_play / moon_hop (Physics) | 0.3·P | slow floaty repeated hops | earl_hop_squat_01, earl_hop_air_01, earl_bounce_star_01 | boing | F up |
| first_meeting | fresh install with no v1 config, once | pops up from behind the taskbar (or the bottom edge; this one-off entrance runs at every `taskbarHiding` level) onto his home on the taskbar top, looks around, stares at the cursor: "...hi.", then the honeymoon arc (6.18): curious, approaching, a pretend-grumpy warm-up that melts by the 3rd pet | earl_peek_01, earl_hop_air_01, earl_stare_01 | quack | sets firstMeetingDone |
| reunion | v1 config migrated, once | pops up, stares, trots over, heart: "oh. it's you. ...good." | earl_peek_01, earl_stare_01, earl_walk_01..03, earl_nuzzle_01 | quack | sets firstMeetingDone |
| morning_greeting | first wake or input of the day | stretch, "mornin'." or a callback line about yesterday's top event (6.17) | earl_stretch_01, earl_sit_idle_01 | quack | A +0.05 |
| goodnight | after 23:00, 30% before a nap | yawns, "night.", and goes to sleep: in the bed if there is one; otherwise behind the taskbar at `mostly` and `always`, about half the time at `sometimes` (the rest on top, so night naps follow hide_nap's "occasional" rule), and always on top with `taskbarHiding = never` | earl_yawn_01..02, earl_peek_sleep_01 | yawn squeak | none |
| birthday_party | 4/4 and 6/23 | party hat on every pose, confetti on hops, party dance (hops + facing flips), special lines | acc_party_hat_01 + any, earl_hop_air_01 | birthday arpeggio (v1 `playBirthdaySound`), jittered | bypasses the speech budget |
| quiet_nap | Quiet time active | naps where he is | earl_sleep_sit_01 / earl_peek_sleep_01 | none | no chaos, no sound |
| bring_back | tray or Settings "Bring Earl back" | puff and teleport onto his home ground line (the taskbar top, or the screen bottom) near the tray, at the in-range spot nearest it (D35); unsticks him from windows or off-screen; also returns stashed items to the floor | earl_land_squish_01 | pop | none |
| stalk_critter | the ambient critter lands within reach (6.19) | stalks low, pounces, pecks, misses, glares; sometimes catches it (tada) | earl_sniff_01, earl_hop_squat_01, earl_peck_01..02, earl_sit_huffy_01 | peck clicks, "hmph" | C down, a petty cause | per critter |
| forage | Needs mode, H < 40, at most once per 20 min | pecks at the ground and finds a crumb (+5 H) | earl_peck_01..02, earl_sniff_01 | nom | H +5 | 20 min |

---

## 8. Toolbox and items

### 8.1 Drawer

**Placement and look:**
- **Position:** docked bottom-right, sitting on the ground line (the taskbar top, or the screen bottom in fullscreen), 16 px from the right edge.
- **Size:** fixed UI size, not scaled with Earl. A 3x3 grid of 64 px slots, about 252x286 px including the lid.
- **Look:**
  - A red-orange tin (#D9483B) drawn with CSS, with a brown handle.
  - Rims in their own darker colour, no black outlines.
  - Cream wells for the slots.
  - The header uses `icon_toolbox_01`, plus three need bars (hunger, energy, fun) in Needs mode; clean stays hidden (D2).
- **Animation:** the lid flips open over 160 ms; icons pop in with a 20 ms stagger.
- **Each slot:** the item icon (auto-generated from prop frame 01), a name tooltip, and a count badge like "1/2".
  - At the per-type cap the slot drops to 45% opacity. Pressing it wiggles it and shows "Earl only needs two of these".
- **First open only:** the hint "Drag things out for Earl" (`onboarding.toolboxHintShown`). On a fresh install the day-1 discovery beat (6.18) opens it once by itself and Earl drags out a ball.
- **Personality touch:** curious Earl may waddle over and peek in (only when the drawer is inside his roam range, D35).

**Open and close:**
- **Open or toggle:** tray, `toolbox.hotkey`, or Settings > Toolbox > Show toolbox.
- **Close:**
  - the hotkey again;
  - the lid button;
  - tray;
  - a click outside the overlay regions (`pointer://outside-down`).
- Esc is not bound globally.

**Interaction:**
- The drawer is a `ui` hit region while open.
- `toolbox_set_open(bool)` keeps the tray label in sync.

### 8.2 Item lifecycle

| Action | Behavior |
|---|---|
| Place | Press a slot. The item spawns under the cursor, grows from slot size to world size over 120 ms, and follows the cursor with the same pendulum as a held Earl. On release it keeps the throw velocity, falls, bounces and settles on the ground. |
| Big-item clearance | Trampoline, bed, tub, fan and the open umbrella may not overlap each other's floor footprint. On landing they slide to the nearest free gap; with no gap they hop back into the box ("no room" wiggle). Small items (bread, seeds, ball, rubber duck, closed umbrella) can overlap anything. |
| Move | Press on the item's mask hit region and drag. Thresholds as in 4.4. |
| Click | The item's primary action (8.3). |
| Right-click | DOM context menu in the overlay: per-kind actions plus "Put away". |
| Remove | Drag onto the open toolbox (poof into the box), right-click > Put away, or Settings > Toolbox > "Put everything away". Supply is infinite. |
| Drop Earl on an item | If his feet land inside the use zone, the affordance runs (7.6 `on_dropped_onto_item`). |
| Drop an item on Earl | Bonk reaction (startle); food may be eaten. |
| Over windows | Items are floor-only. An item released over a window falls through to the ground. Earl never kicks items off windows. |
| Stash (small items only) | Bread, seeds, ball and rubber duck can be in a `BehindTaskbar` depth when **Earl** puts them there (item_steal, the "stash the bread" whim). They are clipped at the taskbar edge like Earl and their hit region is clipped the same way, so only the visible part is clickable. The user never places items there. "Bring Earl back" and "Put everything away" empty the stash. Big items are never behind the taskbar. No stash with `taskbarHiding = never`; the stash is always inside the roam range (D35). |
| Outside the roam range | Allowed: the user can place items anywhere along the ground. Earl does not walk out to them; he uses one only if he is dropped onto it, then walks back inside (D35). |
| Ground change | Items fall when the taskbar vanishes (stashed items included); they are lifted with a 250 ms ease-out when it returns (5.6). |
| Fullscreen `app` | Items are hidden and non-hittable; they come back when fullscreen ends (D6). With `general.fullscreen = stayWithItems` they stay visible, display-only (hover-to-arm, like Earl). |
| Earl hidden | Items hide with him. |
| Quiet time | Items stay; fans spin down. |
| Resolution or DPI change | `xFrac` of the monitor width is clamped on load. |

**Caps:** at most 12 items total. Per type: trampoline 2, bed 1, food (bread + seeds) 3, tub 1, ball 2, rubber duck 1, fan 2, umbrella 1.

**Consumables:** no stock or refill timers. Finished food gives a crumb puff and frees its slot. Ducklings may steal a bite.

**Persistence:** placed items are in `state.items`, sent via `state_put` immediately on place, remove or state change. A moving body is sent once it has been still for 500 ms.

**Settings gates:**
- `toolbox.earlUsesItems` off: Earl ignores items unless dropped onto one.
- `toolbox.earlMovesItems` off: no kick, push, carry or item_steal.

### 8.3 Per-item spec

E = Earl's display size × `toolbox.itemScale`. The minimum hit size is 24 px.

**The art is the single source of truth for sizes.** `art:build` measures each prop's alpha bbox (at the same world scale as Earl, ART_SHOTLIST section 3) and writes the physics footprint and the required attach lines into `sprites.gen.ts`: trampoline `mat`, bed `mattress`, tub `waterline`, fan `hub`, umbrella `handle`, parachute `hemL`/`hemR`. Collision boxes, the mat and mattress surfaces, the water line and the umbrella and parachute attach points all come from there, so Earl never floats over or sinks into what is drawn. The footprints below are **targets for the art** (and for the canvas placeholders), not code constants; the art lint fails a prop whose measured footprint is more than 15% off its target or whose attach lines are missing.

| Kind | Target footprint (E; measured value wins) | Body | e | Click | Right-click extras | Affordance and needs | Earl behaviors | States and shots | Physics party |
|---|---|---|---|---|---|---|---|---|---|
| trampoline | 1.15 × 0.45 (art about 290 wide on a 320x128 canvas) | static platform, heavy (thrown at 0.3× velocity); mat is a bouncy surface: `vy = -max(impact·0.95, v(2.5·bodyH))` | mat 0.95 | boing wobble | - | bounce: F +1.5/s, E -3/min | trampoline_bounce, king_of_hill | prop_trampoline_01 (rest), _02 (pressed), procedural mat squash | launch ×2; launches nearby items at random |
| bed | 1.35 × 0.6 (art about 340 long on 384x192) | static, heavy; mattress surface at 0.3·h | 0.1 | fluffs the pillow (Earl in bed grumbles) | - | sleep: E +5/min; sulking: hides under the blanket | bed_sleep, king_of_hill, sulk variant | prop_bed_01 (back), prop_blanket_01 (empty) / _02 (occupied) front layer | hops occasionally |
| bread | 0.4 × 0.25 (about 96 wide) | dynamic, light | 0.2 | tears off a crumb (tossed; Earl may chase it) | - | 4 bites, H +10 each; grumpy Earl nibbles or ignores | eat_bread, item_steal | prop_bread_01..04 (whole, bitten, half, crust), crumb particles | slides around |
| seeds | 0.45 × 0.2 (128x64 canvas) | dynamic, light (dish) | 0.1 | rattle | - | 6 pecking bouts, H +5 each | eat_seeds | prop_seeds_01 (6-5 left), _02 (4-3), _03 (2-1), then fades | scatters |
| tub | 1.15 × 0.65 (320x192 canvas) | static, heavy; water volume: buoyancy, strong drag, splash ∝ impact | water 0 | ripple splash | - | bathe: K to 100, F +10, G -0.1; drink | bath_splash, drink, king_of_hill; the rubber duck floats | prop_tub_back_01, prop_tub_front_01, procedural wave and bubbles | sloshes, spits droplets |
| ball | 0.33 circle (about 84 across) | dynamic circle, rolling decel 120 px/s² | 0.72 | small upward flick | - | kick and chase: F +2/s | ball_play, item_steal | prop_ball_01, rotated and squashed | e 0.95, self-bounces |
| rubber duck | 0.5 × 0.62 (75% of Earl's height, duck framing, ground 240) | dynamic, light, floats | 0.4 | squeak (Earl jealous if watching) | - | liking -1..1 persisted (suspicious, jealous, friend) | rubber_duck | prop_rubber_duck_01, _02 (squeezed), flipped in code | bounces, floats |
| fan | 0.8 × 0.85 (about Earl's height on 256x256) | static, medium; wind box field in the facing direction, range 6E, linear falloff, optional oscillation | 0.2 | on / off | Turn around, Speed low/high | wind: chute 3×, light items, airborne bodies; grounded Earl leans and slides above a threshold | fan_reaction, fan_switch, umbrella_hide | prop_fan_01..03 blade positions, fast blur in code | force ×3, spins and turns on its own |
| umbrella | closed 0.95 × 0.25 (256x96), open 1.17 × 1.3 (about 300 wide on 384x384) | dynamic when closed, static when open; holdable on the wing attach | 0.3 | open / close | - | shelter; carry; parasol glide | umbrella_hide, umbrella_ride | prop_umbrella_closed_01, prop_umbrella_open_01 (drawn above his head when carried, rotated) | tumbles in fan wind |

**Earl sprites needed only by items:** `earl_peck_01..02`, `earl_chew_01`, `earl_kick_01..02`, `earl_push_01..02`, `earl_splash_01`, `earl_shake_01`, `earl_windblown_01`, `earl_suspicious_01`, `earl_nuzzle_01`, `earl_side_eye_01`, `earl_sleep_lie_01`, `earl_bounce_star_01`, `earl_bounce_tuck_01`.

"Under the umbrella", "in bed" and "in the tub" come from back and front layering.

---

## 9. Settings

### 9.1 Schema

Rust (`earl-core/src/settings/schema.rs`), `schema: 2`, frozen in M1.0. Keys are camelCase in JSON and TS.

| Group | Key | Type | Range / values | Default | Notes |
|---|---|---|---|---|---|
| General | *launch at startup* | OS state (not stored) | - | enabled on first run | `autostart_get/set`; re-reads the OS after toggling |
| General | `general.hideInGamesAndSlideshows` | bool | - | true | label "Hide in exclusive games and slideshows": exclusive D3D, presentation mode, known slideshow classes (4.6) |
| General | `general.hideFromScreenCapture` | bool | - | false | `WDA_EXCLUDEFROMCAPTURE`: Earl is invisible to screen shares and screenshots (4.1) |
| General | `general.showHideHotkey` | `{enabled, accel}` | - | `{enabled:false, accel:""}` | never JSON null (D22) |
| General | `general.autoCheckUpdates` | bool | - | true | checks only, never installs on its own |
| General | *Bring Earl back* | button | - | - | `earl_command bringBack` |
| Earl | `earl.size` | u16 px | 48-256, step 8, snaps 48/64/96/128/192/256 | 96 (Q3 accepted) | live rescale about the foot anchor |
| Earl | `earl.activity` | u8 | 0-100 (Couch potato / Chill / Normal / Lively / Gremlin) | 50 | replaces "animation speed" |
| Earl: Where Earl can go | `earl.taskbarHiding` | enum | `never` / `sometimes` / `mostly` / `always` | `sometimes` (Q1 answered) | label "Behind the taskbar"; behind share 0 / 0.15 / 0.6 / 0.85; meaning per level in 5.6; his home is the taskbar top (D1) |
| Earl: Where Earl can go | `earl.windowPerching` | bool | - | true | label "Perch on windows" (D35) |
| Earl: Where Earl can go | `earl.wallClimbing` | enum | `never` / `wildOnly` / `anytime` | `wildOnly` | label "Climb the screen edges"; replaces `chaos.wild.wallClimbing` (D35) |
| Earl: Where Earl can go | `earl.roamRange` | `{from: u8, to: u8}` | 0-100 % of the monitor width, `from < to`, span ≥ 25 | `{from:0, to:100}` | label "How far he roams along the taskbar"; presets Whole width / Clear of the clock (0-85) / Left side (0-45); clamp widens a too-narrow span around its centre (D35) |
| Earl: Where Earl can go | `general.fullscreen` | enum | `stayAtBottom` / `stayWithItems` / `hide` | `stayAtBottom` (Q6 accepted) | Cameron's request; label "When something is fullscreen"; key kept under `general` for continuity, shown in this group (D6, D35) |
| Earl | `earl.speech` | enum | `off` / `rare` / `normal` / `chatty` | `normal` | |
| Mood | `mood.mode` | enum | `personality` / `needs` | `personality` | both modes keep their state. In builds before M3.2 merges, the Needs card is shown as "arrives with the toolbox" and cannot be selected (hunger could not be refilled) |
| Mood | `mood.swings` | u8 | 0-100 (Mellow to Dramatic) | 50 | dimmed in Needs mode but still applies |
| Mood | `mood.needsMeters` | enum | `never` / `onHover` / `always` | `onHover` | also shown below 25 unless `never` |
| Mood | `mood.needsPace` | enum | `gentle` / `normal` / `demanding` | `gentle` | decay ×0.7 / 1.0 / 1.4 |
| Mood | `personality.grumpiness` | u8 | 0-100 | 60 | the card is exposed (Q4 accepted) |
| Mood | `personality.playfulness` | u8 | 0-100 | 55 | |
| Mood | `personality.curiosity` | u8 | 0-100 | 65 | |
| Mood | `personality.sleepiness` | u8 | 0-100 | 45 | |
| Mood | `personality.clinginess` | u8 | 0-100 | 40 | |
| Mood | `personality.gremlin` | u8 | 0-100 | 35 | scales item_steal, peek_pop scares, grab weight |
| Chaos | `chaos.enabled` | bool | - | false | master switch |
| Chaos | `chaos.wild.enabled` | bool | - | true | |
| Chaos | `chaos.wild.tantrums` | bool | - | true | |
| Chaos | `chaos.messes.enabled` | bool | - | true | |
| Chaos | `chaos.messes.grabCursor` | bool | - | true | Rust limits as in D27 |
| Chaos | `chaos.messes.runFromCursor` | bool | - | true | |
| Chaos | `chaos.messes.hideBehindWindows` | bool | - | true | |
| Chaos | `chaos.messes.honkOnTyping` | bool | - | true | help text: "Earl only notices *that* you're typing, never what" |
| Chaos | `chaos.swarm.enabled` | bool | - | true | |
| Chaos | `chaos.swarm.maxDucklings` | u8 | 1-3 | 2 | |
| Chaos | `chaos.swarm.frequency` | enum | `rare` / `sometimes` | `rare` | |
| Chaos | `chaos.physics.enabled` | bool | - | true | |
| Chaos | `chaos.physics.gravity` | f32 | 0.3-1.0 (Moon to Earth) | 0.4 | |
| Chaos | `chaos.physics.bounciness` | u8 | 0-100 | 80 | |
| Chaos | `chaos.physics.haywireItems` | bool | - | true | |
| Toolbox | `toolbox.hotkey` | `{enabled, accel}` | - | `{enabled:true, accel:"Ctrl+Alt+Shift+D"}` (Q12 accepted) | inline status: ok / in use / invalid; "off" keeps the accelerator (D22) |
| Toolbox | `toolbox.earlUsesItems` | bool | - | true | |
| Toolbox | `toolbox.earlMovesItems` | bool | - | true | |
| Toolbox | `toolbox.itemScale` | f32 | 0.75-1.5 | 1.0 | |
| Toolbox | *Show toolbox* / *Put everything away* | buttons | - | - | plus read-only counts per type |
| Sound | `sound.enabled` | bool | - | true | |
| Sound | `sound.volume` | u8 | 0-100 | 35 | |
| Sound | `sound.footsteps` | bool | - | false | |
| Sound | `sound.muteWhenBusy` | bool | - | true | `QUNS_BUSY`, presentation, D3D |
| Sound | `sound.quietHours` | bool | - | true | 22:00-07:00, ×0.6 volume |
| About | *Check for updates*, *Reset stats*, *Reset relationship*, *Reset personality* | buttons | - | - | the resets are ConfirmButtons in a "Danger zone" card |

**Chaos rules** (Rust `validate()`):
- effective = master && sub;
- turning master on while all four subs are off turns all four on;
- turning the last sub off turns master off;
- turning a sub on while master is off turns master on.

**Clamps:** every range above. An invalid accelerator sets `enabled:false` and keeps the last valid `accel`; null is never written. `settings_patch` rejects null for every key (D22).

### 9.2 Runtime state

`state.json`, `schema: 2`:
```rust
RuntimeState { schema, first_launch_at_ms: u64, v2_installed_at_ms, last_seen_at_ms, quiet_until_ms: Option<u64>,
  migrated_from_v1_at: Option<u64>,
  onboarding: { welcomed, autostart_initialized, toolbox_hint_shown, discovery_beat_done, chaos_hint_shown },
  position: { x_frac: f64, facing: Left|Right, lane: String, sink: f32 },
  brain: serde_json::Value,          // TS-owned: {version, affect, needs, relationship, memory, episodic, whims,
                                     //             dayTemperament, legacySeed?}
  items: Vec<PlacedItem{ id, kind, x_frac, facing, depth: Floor|Stash, state: Plain|Food{left}|Fan{on,high}|Umbrella{open}, placed_at_ms }>,
  stats: Stats{ hops, distance_px, pets, pickups, throws, highest_throw_px, parachute_landings, naps, nap_ms,
                bites, baths, bounces, ball_kicks, tantrums, window_perches, honks, cursor_grabs, items_placed,
                item_uses: BTreeMap<String,u64>, days_active, last_active_day } }
```

**Ownership** (one writer per field):

| Data | Live owner | Path to disk |
|---|---|---|
| Settings | Rust store | `settings_patch` from the panel and tray |
| position, brain, items, quietUntil | overlay world, in memory | `state_put` |
| stats | Rust | `stats_add(delta)`, sent every 10 s when non-empty and on `state://flush-request` (not `pagehide`, which is unreliable at logoff) |
| onboarding | Rust | commands |

**Resets:** panel → `earl_command` → world, which applies the change and syncs back. "Reset stats" is done in Rust directly.

**Stats sources:**

| Stat | Incremented by |
|---|---|
| `distancePx` | integrated walking and running distance |
| `hops` | hop start |
| `pets` | pet accepted |
| `pickups` / `throws` | drag start / release above the throw threshold |
| `highestThrowPx` | apex tracking |
| `naps` / `napMs` | sleep enter / exit |
| `bites` | food bite |
| `baths` | tub use |
| `bounces` | trampoline launch |
| `ballKicks` | kick |
| `parachuteLandings` | chute landing |
| `tantrums` | tantrum enter |
| `windowPerches` | perch land |
| `honks` | honk sound |
| `cursorGrabs` | grab |
| `itemsPlaced` | place |
| `itemUses[kind]` | any affordance use |
| `activeDay` | sent once per local day; Rust bumps `daysActive` on change |

### 9.3 Panel UX

**Palette (light):**
- background #FFF8E7 (cream)
- sidebar #FFEFC2 (butter)
- cards #FFFFFF with a 1 px #F0E0B8 border, radius 14
- text #3B2A1A
- help text #8A7560
- accent #FFD666 / #FFB938
- beak orange #E8943A
- focus rings and control outlines #5A3E2B

**Dark mode** ("night pond", follows `prefers-color-scheme`): background #1F1A14, surface #2A231B, text #F5E9D3, accent #FFC94A. Tokens live in `theme.css`.

**Type:** Segoe UI Variable. Body 14/1.45, help 13, headings 16 semibold.

**Layout:**
- A fixed 168 px sidebar with inline-SVG icons. The active tab is a yellow pill with a 2 px brown outline.
- The header shows an animated 64 px Earl and a mood line ("Earl is feeling: grumpy but fine").
- Rows: label and help on the left, control on the right, minimum height 48, `flex-wrap`, so at minimum width the control drops under its label. No fixed-width text.
- Verify at 100/125/150/175% scaling and at 520x480 **(W)**.

**Controls:**
- Toggle: 40x22 pill.
- Slider: filled track, duck-head thumb, value readout, snap ticks.
- Segmented control for enums.
- HotkeyRecorder: validates via `hotkey_try`.
- ConfirmButton: inline two-step.
- ModeCard: the two big illustrated Mood cards.

**Earl tab:** size, activity and speech rows, then the **"Where Earl can go"** card (D35), five rows in this order, each with one line of help text:
1. **Behind the taskbar** - segmented Never / Sometimes / Mostly / Always. Help: "His home is on top of the taskbar. Sometimes he slips behind it to peek, sulk or nap."
2. **Perch on windows** - toggle. Help: "He can jump up and sit on top of your windows."
3. **Climb the screen edges** - segmented Never / Only in Wild Earl / Anytime. Help: "He can scramble up the sides of the screen. 'Only in Wild Earl' keeps it to chaos episodes."
4. **How far he roams along the taskbar** - a two-thumb slider drawn over a small taskbar picture (Start and icons in the middle, clock on the right), with chips Whole width / Clear of the clock / Left side. Help: "He walks, rests and plays only inside this stretch."
5. **When something is fullscreen** - segmented Earl stays at the bottom / Earl and his toys stay / Hide Earl. Help: "He never covers a video's controls: clicks go through him unless you rest the pointer on him."

**Mood tab:** two big selectable cards. "Pure personality: he feels what he feels." "Needs: keep him fed, rested and entertained." Then the Personality card with 6 sliders and "Reset to Earl".

**Chaos tab:**
- The master switch is a large card with a playful yellow and brown hazard-stripe edge.
- Four sub-cards sit below it, each with its own toggle and sub-options expanding underneath.
- With master off, the sub-cards are dimmed to 55% but still clickable (the rules apply).
- The Wild Earl card has no wall-climbing toggle; it shows a read-only line "Wall climbing: <current value>" linking to Earl > Where Earl can go (D35).

**No Save button.** Every change applies instantly.

**Live preview:**
- **Size:** patches throttled to rAF (at most about 30 Hz); the real Earl rescales about his feet with a CSS scale while the slider moves and re-prescales 200 ms after it settles (5.10).
- **Volume:** releasing the slider plays a sample honk.
- **Speech toggled on:** a sample bubble.
- **Chaos toggled on:** "hehehe".
- **Mood switched to Needs:** the meters show for 3 s.
- **Item scale:** items resize live.
- **Behind the taskbar set to `always` or `mostly`:** he slips behind at once; set to `sometimes`: he stays where he is (a visit in progress ends normally); set to `never`: he hops up onto the taskbar top.
- **Perch on windows turned off:** if he is on a window, he hops down.
- **Climb the screen edges:** a climb in progress finishes with a slide down when the new value forbids it.
- **Roam range:** while a thumb is dragged, the allowed stretch is tinted along the bottom of the screen for 3 s; if he is outside it he walks back in.
- **When something is fullscreen:** no immediate effect unless fullscreen is active, where it applies at once.

**Sync:**
- The rev guard: a client ignores `settings://changed` with `rev <= lastRev`.
- A control being dragged keeps a local optimistic value until its patch's rev returns.

**About tab:**
- 128 px animated portrait, "Earl v2.x.y (build id in preview builds)", the backstory, "Made with love by Cam".
- "Together since April 4, 2026 - N days" (local calendar-day difference).
- Trust shown as 5 hearts, plus a wariness line when it is high. Crossing into buddy or bonded fills a heart with a small animation, mirroring the tier scene (6.20).
- Favourite toy (the argmax of `itemUses`).
- A 2-column stats grid in friendly units: distance in m or km at 3780 px/m; highest throw in "screens".
- The UpdateCard and the Danger zone.
- The privacy note: "Earl never sees what you type or what your windows are called."

### 9.4 Persistence and migration

**Files** in `%APPDATA%\com.threxai.earl\`:
- `settings.json`, `state.json`, and `.bak` of each;
- `config.v1.bak.json`;
- `*.corrupt-<ms>.json`.

**Loading (one code path with `settings_patch`, D22):**
- Value-level migration chain first.
- Then start from `Settings::default()` (the schema defaults, not `T::default()`) and apply the file's JSON as a merge patch through the same per-field `validate()` that `settings_patch` uses. Each field that fails to parse or validate is dropped and logged, so it keeps its **schema default**: a garbage `sound.volume` is 35, a garbage `sound.enabled` is true, a garbage `earl.size` is 96. No `lenient` / `unwrap_or_default` deserializer exists.
- `#[serde(default, rename_all="camelCase")]` stays on the containers for struct shape.
- A file that won't parse as JSON at all is renamed to `.corrupt-<ms>`; defaults load and a notice shows on the About tab. The app **never** gets stuck on "Loading".
- `earl-core` tests: a garbage value per field yields that field's schema default; `toolbox.hotkey` set to off survives a save and reload; a patch containing null is rejected.

**Writes:**
- Atomic: tmp, `sync_all`, `rename`. A `.bak` of the last good file once per launch.
- Settings save 400 ms after the last patch. State saves as in D23.
- A write is skipped when the bytes are identical.

**v1 migration** runs when `config.json` exists **and `state.migratedFromV1At` is unset** (not "when settings.json is absent", which would skip a migration interrupted between the two writes). The steps are ordered and idempotent:
1. parse v1 `config.json`;
2. write `state.json` (atomic) with stats, `first_launch_at_ms` and `brain.legacySeed`;
3. write `settings.json` (atomic);
4. set `state.migratedFromV1At` (atomic write of `state.json`);
5. rename `config.json` to `config.v1.bak.json`, last.

A core test simulates a crash after each step and asserts that the next launch ends with the same result as an uninterrupted run. The v1 MSI is handled by the NSIS pre-install hook (4.12).

Field mapping:

| v1 field | v2 destination |
|---|---|
| `display.size` | `earl.size` (clamped; same on-screen size) |
| `display.animationSpeed` chill / normal / hyper | `earl.activity` 30 / 50 / 75 |
| `sound.enabled` | `sound.enabled` |
| `sound.volume` 0-1 | `sound.volume` 0-100 |
| `behavior.launchOnStartup` | re-enable autostart if true (refreshes the Run key path) |
| `stats.totalHops` | `stats.hops` |
| `stats.totalPixelsWaddled` | dropped (never incremented) |
| `mood.value` | `brain.legacySeed`. Fondness is seeded at `0.55 + 0.1·min(1, days/180) + 0.05·(v-50)/50` (buddy tier; days since the recovered first launch), trust 0.55, and `reunion` replaces `first_meeting` (D29) |
| `position` | dropped (he starts near the tray) |

**Recovering the first-launch date:**
- `epochDay = (Y-1970)*365 + (M-1)*30 + (D-1)`, then `firstLaunchAtMs = epochDay*86_400_000`. This also covers "month 13".
- If the result isn't within [2026-01-01, now], fall back to the file's `created()`, then to now.
- `config.json` is renamed to `config.v1.bak.json` as the last step (above).

---

## 10. v1 bug fix list

| # | v1 bug (location) | Fix | Unit |
|---|---|---|---|
| 1 | Settings "Rendered more hooks" crash (`SettingsPanel.tsx:17-30`) | New panel with no early return before hooks; ESLint rules-of-hooks | M1.7, M0.1 |
| 2 | Settings save a whole stale config, clobbering stats | Patches plus rev; stats owned by Rust | M1.2 |
| 3 | Tray Sound label not synced (`tray.rs:24-27`) | `tray::sync` on every change | M1.2 |
| 4 | Autostart checkbox shows config, not OS state | `autostart_get` reads the Run key and StartupApproved (`byte0 & 1`); `autostart_set(true)` clears a Task Manager disable | M1.2 |
| 5 | Only `mood` has `#[serde(default)]` (`config.rs:142-152`) | Schema defaults plus the file applied as a validated patch, per field (9.4) | M1.2 |
| 6 | `getConfig().catch` swallows errors, stuck on Loading | Corrupt quarantine; `platform_init` always returns defaults | M1.2, M1.7 |
| 7 | `firstLaunchDate` fake calendar, month 13 (`config.rs:135-148,271-284`) | Epoch ms plus exact inversion in migration | M1.2 |
| 8 | "Animation speed" scales only frame durations | Activity setting; `rate:'speed'` clips | M1.3, M1.4, M1.5 |
| 9 | SLEEP never fires (`stateMachine.ts:136-147,354-379`) | Nap is a scored behavior; the 8 h sim asserts a sleep share | M1.5 |
| 10 | STRETCH never fires (needs 60 s idle, idle max 30 s) | Stretch on waking, long sits and the morning wake | M1.5 |
| 11 | Every pointerdown is a pickup (`useDrag.ts:46`) | Gesture thresholds; every tier's click reaction starts with a hop-class move | M1.3, M1.5 |
| 12 | HOP_OFFSETS sign: he sinks 20 px (`physics.ts:81`, `constants.ts:38,449`) | Real ballistic hops, `hold:'landed'` | M1.3, M1.4 |
| 13 | Upward throws discarded (`useEarlBehavior.ts:619`) | 2D LSQ throw | M1.3 |
| 14 | FALLING ignores vx; `bounceCount` unused | Full 2D integration; bounce cap | M1.3 |
| 15 | 12 missing sprites resolved through `SPRITE_FALLBACKS` | Fallback chain from `shots.json`; placeholders; new art | M0.3, M5 |
| 16 | Hit test paused while falling; the expanded window eats clicks | Never paused; one overlay; Rust capture latch; hang watchdog | M1.1 |
| 17 | expand/shrink races; the loop restarts on every drag | Deleted; one overlay | M1.1, M1.4 |
| 18 | `shrinkWindow` always passes taskbarVisible=true | Deleted; ground from Rust | M1.1 |
| 19 | `TASKBAR_HEIGHT = 40` (Win11 is 48) | Measured rect | M1.1 |
| 20 | `work_area()` ignored | `rcWork` plus appbar | M1.1 |
| 21 | Physical monitor position passed as logical (`lib.rs:43-46`) | Physical set_position; `Space` transform | M1.1 |
| 22 | No fullscreen detection | `fullscreen::classify` | M1.1 |
| 23 | AudioContext never resumed (`sound.ts:3-8`) | `--autoplay-policy=no-user-gesture-required` in the shared browser args; resume on first gesture as a fallback | M1.1, M1.4 |
| 24 | Updater endpoint `releases/download/latest/...` (404) | `releases/latest/download/latest.json` | M0.2 |
| 25 | Silent install and relaunch (`updater.ts:5-16`) | Rust consent flow | M1.8 |
| 26 | Tray and app icons are RGB, opaque grey (`tray.rs:44`, `src-tauri/icons/*`); this also breaks the Linux `cargo check` | Regenerate RGBA; `icons/tray_32.png` | M0.2, M5.2 |
| 27 | Two diverged `sprites.json` | One generated `sprites.gen.ts` | M0.3 |
| 28 | `sprites.json` references 12 missing files | The `FrameId` union makes a reference to a missing frame a type error | M0.3 |
| 29 | Mixed sprite naming case | snake_case shot ids, enforced by `art:check` | M0.3 |
| 30 | `process_sprites.mjs` (hardcoded paths, near-white keying that punched eye holes) and `scripts/fix-sprites.mjs` | Deleted; the magenta keyer in `scripts/art.mjs` | M0.3 |
| 31 | npm deps not installed (2 tsc errors) | `npm ci` in CI; the plugin JS deps removed | M0.1 |
| 32 | Robotic behavior: uniform timers, coin-flip direction, constant speeds, the 5.56 s blink, identical sounds, `getMoodSpeech` and `shouldAvoidWall` unused, mood almost always "normal" | Brain (section 6), fidgets, blink channel, voice variation, affect engine | M1.5, M2.1-M2.5 |
| 33 | 6 setState per rAF frame | No React in the sim | M1.4 |
| 34 | Canvas redraws every frame, with `getImageData` readback | Layers plus signatures; readback deleted | M1.4 |
| 35 | devicePixelRatio ignored (blurry at 125-150%) | DPR backing stores and snapping | M1.4 |
| 36 | CSS left/top layout per frame | `translate3d` | M1.4 |
| 37 | 20 Hz IPC hit test forever | Rust pointer thread, transitions only | M1.1 |
| 38 | No frame cap, no pause when hidden | Scheduler ACTIVE/IDLE/PAUSED | M1.4 |
| 39 | Per-frame allocations (`physics.ts` returns new objects) | Mutable bodies, event ring buffer | M1.3 |
| 40 | Config saved every 30 s regardless (`useEarlBehavior.ts:453-465`) | Dirty-only debounced writes | M1.2 |
| 41 | `useBirthday` interval leak | Removed; birthday from the sim clock | M1.4, M1.5 |
| 42 | Confetti frame-rate dependent | Fixed-step particles | M1.4 |
| 43 | Earl floats about 7% above the ground; April sprites drift | Anchors; art alignment | M1.4, M0.3 |
| 44 | April sprites off-style (outline, halo, scale, eye holes) | Regenerated per the art shot-list | M5 |
| 45 | `src-tauri/gen/schemas` tracked; wrong `$schema` URL; CSP allows GitHub | Untrack and ignore; fix the URL; tighten the CSP | M0.2 |
| 46 | No single-instance guard | Plugin | M0.2 |
| 47 | Raw user32 FFI without `#[link]` (`commands.rs:19-24,73-96`); unused `dirs` crate | `windows` crate; removed | M1.1 |
| 48 | `set_always_on_top` is a no-op when already set | `SetWindowPos` reassert policy | M1.1 |
| 49 | "Restart Earl" debug tray item; tray tooltip dash; Settings panel always-on-top (`tray.rs:92`) | Removed / fixed; the panel is an unowned normal window, never owned by the topmost overlay (D9) | M1.2 |
| 50 | Stale docs (TODO, HANDOFF wrong config path, PROMPT, README "fully offline") | Rewritten or removed | M0.3 |

---

## 11. Efficiency targets

Measured on Win11, a mid laptop, 1080p at 125%, with the perf tab of the debug overlay and WebView2 DevTools **(W)**.

| Scenario | Draw work | CPU (all Earl + WebView2 processes) | IPC |
|---|---|---|---|
| Asleep or behind the taskbar, size ≤ 96 | ≤ 2 layer repaints/s (blinks, frame changes) | < 0.3% renderer + < 0.5% GPU; TaskDuration ≤ 20 ms/s | 0 from JS (heartbeat piggybacks on the rare region push; a 1 Hz heartbeat only when nothing else is sent) |
| Idle, any size | ≤ 2 repaints/s (breathing is a CSS transform, 5.10) | < 0.6% | ≤ 1/s |
| Walking / normal activity, cursor far | transforms at the paced rate (5.2), repaints only on frame changes (about 7/s, whatever the procedural motion) | < 3%; sim ≤ 0.3 ms/step; render ≤ 1.5 ms/frame; TaskDuration ≤ 60 ms/s | 0-2/s (coarse region only, 4.3) |
| Cursor near Earl, or chase / flee / gag | as above | as above | exact regions ≤ 30/s + 30 Hz cursor stream |
| Chaos peak (swarm + party burst + particles) | paced rate (about 60 fps) | < 8%; render ≤ 4 ms | ≤ 30/s + 30 Hz cursor while near |
| Hidden, locked, D3D | 0 | ~0 (pointer thread parked, hooks removed) | 0 |

**Other targets:**
- **Memory:**
  - JS heap < 25 MB steady, with no growth over 24 h.
  - Encoded atlas pages plus the LRU of prescaled frames < 64 MB (no fully decoded pages are kept, 5.10).
  - WebView2 renderer < 120 MB.
  - Total < 200 MB after an 8 h run.
- **Startup:** first frame < 800 ms. Only the `core` atlas page loads before first paint.
- **Pointer thread:** about 10 wakeups/s when the cursor is far away (no Condvar wake from coarse region pushes more than 2/s).
- **WinEvent callbacks:** an integer filter before any syscall; fewer than 5 per second at steady state while the mouse moves continuously (4.7).
- **Frame pacing:** even cadence at 60, 75, 90, 120, 144 and 165 Hz (5.2).

**How they are met:**
- the layered renderer (compositor-only moves, transforms and clip-paths);
- repaints gated on frame id, flip and DPR only;
- the IDLE scheduler;
- no React on the hot path;
- low allocation in step and render (pools, ring buffer, reused BrainContext), measured as heap growth < 1 MB over 1 M steps with `--expose-gc` and fewer than 2 minor GCs per minute in the sandbox. Zero allocation is not claimed, since generator coroutines allocate an iterator result per `.next()`;
- event-driven platform code;
- the adaptive pointer poll;
- transitions-only click-through;
- subscribe-on-demand streams;
- the pause-everything lifecycle;
- lazy atlas pages;
- per-DPR pre-scaled ImageBitmaps.

**Regression gates:** CI gates **only on counts measured in sim time**: draws/s, repaints/s, React commits/s, IPC/s, allocations (heap growth) and WinEvent-equivalent callbacks in the sandbox. A breach fails the `e2e` job. Wall-clock timings (TaskDuration, ms/step, ms/frame, p95 latency) are recorded in `metrics.json` and the step summary but never fail CI on shared runners with software GL; they are checked on Windows in M0.4 and M5.3.

---

## 12. Testing and dev loop

### 12.1 Browser sandbox (Linux, `npm run sandbox` = `vite --mode sandbox`)

**Setup:**
- `sandbox/index.html` calls `mockWindows(label)` and `mockIPC(handler, {shouldMockEvents:true})` before importing the real app entry. `?window=overlay|panel`.

**Fake desktop:**
- wallpaper;
- a 48 px taskbar with toggles: visible / auto-hide (with slide animation) / fullscreen app / d3d; height 48 or 72; edge bottom, left or top; scale 100-200%;
- draggable, closable, minimizable fake windows with z-order and cloak;
- the real mouse as the cursor;
- keyboard events that turn into `typing://burst` and `userBusy`.

**Mock backend** (`sandbox/mockIpc.ts`):
- implements every command;
- `state_put` goes to localStorage, so items survive a reload;
- counts IPC calls per second;
- simulates click-through (hit masks drawn as outlines);
- includes a scripted fake update.

**Controls:**
- **Time:** pause, step, 0.25-600×, seed, trace replay; `?scenario=<name>&t=<ms>`.
- **Debug layers:** bodies, surfaces, occluders, dirty and repainted layers, brain utilities.
- **Test hook** (sandbox only): `window.__earl = {step, fastForward, setTimeScale, setSeed, forceBehavior, setDrives, getTrace, getMetrics, desktop:{setTaskbar, setFullscreen, addWindow, moveWindow, closeWindow, type}}`.

**Art tools:**
- `/?lineup`: every frame on a baseline grid, with anchors, onion-skin over `earl_sit_idle_01`, and click-to-set attach points.

**Playwright specs** (`e2e/`):
- startup screenshots at DPR 1 / 1.25 / 1.5 (sharpness), plus size 256 at DPR 1.5 with a sharpness check (the 512 level is used, D19);
- a click triggers a hop-class reaction, never a pickup, on a fresh state (stranger tier) and at buddy tier;
- a flick-throw starting at Earl's edge at more than 3000 px/s is caught and thrown (the capture latch);
- an upward throw deploys the chute and lands;
- **taskbar:**
  - **default setting (`sometimes`):** at startup and after any pop-up (a trampoline bounce, a drag and drop onto the taskbar top) his feet are on the taskbar top (pixel sampling of the feet row), and he stays there;
  - `sometimes`: a forced `sulk` sinks him to eyes depth behind the taskbar, and when it resolves he climbs back on top within 3 s;
  - `always`: after any pop-up he returns behind the taskbar within 3 s of the action ending;
  - wade depth shows head, wings and chest and the walk cycle bobs (pixel sampling of the head's y across a wade walk);
  - feet on the taskbar top in `never` and `sometimes`;
  - peek clipped exactly at the edge (pixel sampling, no bleed);
  - fullscreen or auto-hide moves the ground to the bottom within 1 tick of the event;
  - in fullscreen, a click on Earl without a 600 ms hover passes through (hover-to-arm);
  - taskbar return puts him in the behind lane at the right sink, and at the default he climbs back on top within 3 s (unless he was sulking or napping); at `never` he climbs back at once;
  - a fake shell popup over the edge makes him duck and clips him;
- **where Earl can go (D35):**
  - roam range "Clear of the clock" (0-85): over a 10 simulated minute run his feet x never enter the right 15% except while held or airborne, and after a throw there he walks back in within 10 s;
  - perching off: a forced `perch_jump` is refused, and dropping him on a fake window makes him hop down;
  - wall climbing: `never` gives no climb in a forced Wild episode; `anytime` gives a calm climb (at most 40% height) with chaos off;
  - fullscreen `stayWithItems`: items stay visible and a click on one passes through without a 600 ms hover;
- every settings control changes the world; size 256 gives a 256 CSS bbox;
- chaos toggles gate their features;
- a toolbox item survives a reload;
- perched then window moved: he falls; perched then the user starts dragging the window slowly: he falls;
- the panel window is not topmost (the mock records z-order flags);
- a 10 simulated minute metrics run per scenario.

### 12.2 Unit and simulation tests (vitest)

**Harness:** `simulate({seed, hours, moodMode, activity, chaos, desktop, script, settings})` returns `{trace, metrics}`. Physics runs at 60 Hz, and `world.advanceTo(t)` jumps straight to the next scheduled wake whenever all bodies are asleep and nothing is due (the same logic as the IDLE scheduler and `onResume`), so long sims skip the idle stretches instead of stepping 1.7 M ticks.

**Statistics over seeds:** every statistical assertion (time shares, sulk timing, behind share, activity budgets, expression shares, callback rates) runs over a fixed set of 16 seeds (32 in the nightly soak) and asserts on the mean, with a tolerance derived from the observed spread. No statistical assertion depends on a single seed.

**Missing features:** assertions for features that are not merged yet land as `test.fails(...)` or `test.todo(...)`, each tagged with the unit id that turns it on (for example `// unit: M2.1`). Each feature unit's acceptance includes flipping its tests to `test(...)`. A CI check fails if a `test.fails` remains for a unit marked merged in `docs/ROADMAP.md`. CI therefore stays green while M2.6 lands first.

**Physics:**
- throw apex = v²/2g within 1%;
- bounce decay and the bounce cap;
- no tunnelling at 5000 px/s;
- chute terminal velocity 110 ± 5;
- fan drift on the chute more than 5× bare Earl;
- water splash ∝ impact;
- hop sign regression.

**Taskbar:**
- taskbar gone: he falls exactly the taskbar height, and `exposed` fires if he was behind;
- taskbar back: `BehindTaskbar` with the right sink;
- auto-hide reveal: occluder only, floor unchanged;
- behind-share per setting within ±10% over 8 h (and at the default `sometimes`, at least 2 visits per awake hour);
- roam range: the walkable interval follows `earl.roamRange` on every ground mode, soft walls at range ends that are not screen edges, clamp of a span under 25.

**Brain:**

| Scenario | Assertion |
|---|---|
| Normal activity, no user, 8 h | sleep share 12-30%; no non-rest behavior above 22%; no identical behavior 3 times in a row; blink interval CV above 0.4 |
| Day and night | night sleep share above day sleep share |
| Needs mode, no items, user present, each activity row 0/25/50/75/100 (normal pace) | first sulk at 90-150 min |
| Needs mode, user away 1 h | no sulk on return; guilt beat plays; one feed or pet forgives |
| Needs mode with bed, bread and ball (M3.2/M3.3) | every meter above 25 for 8 h |
| Mode switch | no sulk within 10 min |
| 20 throws on day 1 (soft landings), then 30 min of gentle play | wariness below 0.4 |
| 10th chute throw in a session | "wheee" reaction in at least 50% of seeds |
| 10 wall slams in 10 min | wariness above 0.6 |
| Fresh install, day 1 | melt beat within 3 pets; no `avoid_cursor` without a slam; discovery beat once |
| v1 config migrated | `reunion` instead of `first_meeting`; buddy tier on first launch |
| Scripted slam | a callback behavior within 2 sim-hours in at least 60% of seeds |
| Every activity row | hits its time budget ±8% |
| Defaults (`sometimes`), user present | full-body ≥ 75% of awake time; expressive visibility ≥ 85%; head-only ≤ 12%; ≥ 2 behind visits per awake hour; behind share within ±10% of the setting (5.6) |
| Each `taskbarHiding` level, user present | the per-level visibility floors of the 5.6 table (`always` keeps expressive ≥ 55%, head-only ≤ 35%) |
| Zones: each "Where Earl can go" zone disallowed in turn, 8 h | zero time in that zone (outside held, airborne and `return_to_range`); zero selections of zone-gated behaviors, including by the ε pick; no whim targets it |
| Zones restricted (range 0-45, perching off, `taskbarHiding = never`), 8 h | the variety, static-stretch and repetition budgets of 12.6 still pass (he must not feel caged) |
| Defaults | expression shares per 6.2 (neutral ≤ 50%, grumpy family 15-30%, affectionate family by tier) |
| Reachability | every non-special behavior fires at least once per 8 sim-hours in some default-tier scenario |
| Whims | at least 3 per awake hour; at least 25% succeed |
| Chaos off | zero chaos-only behaviors |
| Messes | zero `grab_cursor` while a button is down, while typing, in fullscreen, without a telegraph, or with the cursor moved in the last 2.5 s; `typing_honk` ≤ 3 per hour; `peek_pop` never while the cursor heads into the taskbar; `hide_behind_window` always leaves an eye visible and lasts ≤ 90 s |
| Wild, chaos-1h | at least 80% of tantrums have a logged cause within 5 s before them; per-hour behavior entropy ≥ 0.5 bits above the chaos-off baseline |
| Swarm | ducklings ≤ `maxDucklings`, visits ≤ 60 s, cooldown ≥ 15 min; each duckling has a quirk; only baby clips are used |
| Offline gap of 3 days (Needs) | decay capped; he is grumpy but not stuck |

**Property fuzz** (fast-check, random scripts and desktop changes):
- no NaN;
- he stays inside the monitor or a legal hidden or behind state, and inside the allowed zones (D35) except while held, airborne or returning to range;
- no behavior outlives its maximum;
- sleep and stretch are reachable.

**Determinism:** the same seed and script give the same trace hash when run twice **in-process**; there are no committed brain golden files (brain tuning would churn them). Committed golden traces exist only for stable physics scenarios, in `test/traces/physics-*.golden.json`.

**Purity:** the `src/sim` tsconfig (no DOM lib) plus the scoped ESLint `no-restricted-globals` and `no-restricted-properties` rules (D16). No text grep.

**Frame pacing:** `pacing.ts` unit test at 60, 75, 90, 120, 144 and 165 Hz (5.2).

**Anim:**
- clip data is valid (every frame id is in the union, fallbacks resolve, durations > 0);
- anchors are present;
- the art lint (5.11).

### 12.3 Rust tests

- `cargo test -p earl-core` on Linux: geom, taskbar, fullscreen (including the presenter class table), surfaces, occlusion, hit (masks, clips, affine inverse transform, arm-on-hover), capture latch, gag rules (including the click shield and path rules), typing burst and honk caps (key-downs only; a held key counts once through the `upSinceLastDown` filter), settings merge/validate/chaos rules, the `earl.roamRange` clamp (from < to, span ≥ 25) and the null rejection, per-field schema-default fallback, migration including a simulated crash after each step, StartupApproved parsing (`byte0 & 1`).
- App-crate config tests: `tauri.conf.json` has `bundle.windows.nsis.installMode: "currentUser"`, `plugins.updater.windows.installMode: "passive"` and overlay `focus:false`; both window builders use the one `BROWSER_ARGS` constant.
- `commands.json` export and the capability cross-check (D32).
- **Fixtures:**
  - taskbar 48 px at 100% and 72 phys px at 150%;
  - auto-hide mostly off-screen;
  - `QUNS_*` states and a foreground window covering the monitor;
  - left and top taskbars;
  - a negative-coordinate second monitor;
  - window lists with minimized, cloaked, tool, zero-size, maximized and overlapping windows;
  - real v1 configs: no `mood`, month 13, extra fields, garbage.
- **Real Windows snapshots:** diag dumps from Cameron become fixtures.
- **ts-rs:** bindings are regenerated in `cargo test`. CI fails on `git diff --exit-code src/shared/bindings`.
- **Windows code on Linux:** `cargo xwin clippy --target x86_64-pc-windows-msvc -- -D warnings` before pushing.

### 12.4 CI

**Node version:** `.nvmrc` and `package.json` `engines.node` pin Node 24 (the server runs 24.16); every workflow reads `.nvmrc`.

**`ci.yml`:** concurrency cancels in-progress runs.

| Job | Runner | Steps |
|---|---|---|
| `web` | ubuntu, Node from `.nvmrc` | `npm ci`, art codegen (`sprites.gen.ts`, atlases, registries), lint (ESLint, Prettier, `check-dashes`), typecheck, vitest with coverage, `art:check`, the `test.fails`-vs-ROADMAP check, build |
| `e2e` | ubuntu, after `web` | Playwright; uploads the report, screenshots, contact sheet and `metrics.json`; writes a budget table to the step summary (count gates only, 11) |
| `ipc-contract` | ubuntu, xvfb | builds the real app with `platform/stub`, opens both windows, invokes every command and listens to every event from each; fails on "not allowed" or deserialization errors (D32) |
| `audit` | ubuntu | `npm audit --audit-level=high`, `cargo audit` |

Dependabot is enabled for npm, cargo and GitHub Actions.

**`ci-rust.yml`:**

| Job | Runner | Steps |
|---|---|---|
| `rust` | ubuntu (webkit2gtk-4.1 etc.) | fmt, clippy `-D warnings`, test, bindings and `commands.json` diff |
| `windows` | windows-latest | clippy, `cargo test` (plus `#[ignore]` real-probe smoke tests), `tauri build --bundles nsis` with `EARL_BUILD=<branch>@<sha7>`; signs if signing is set up (4.12); uploads the setup exe plus a raw `earl.exe` (14 days). Branch builds carry no updater key. |
| `preview` | push to `v2` only | sets version `2.0.0-preview.<run_number>`, signs with the **preview** updater key, uploads to the rolling `v2-preview` pre-release with a signed `latest.json` |
| `soak` | nightly | 48 h × 32 seeds (using `advanceTo`) |

**`release.yml`:** triggered by a `v*` tag; Node from `.nvmrc`; NSIS only; the production updater key (only here); `releaseDraft: true`.

### 12.5 Windows checklist (`docs/TESTING.md`, a checkbox and build id per item)

| # | Area | Check |
|---|---|---|
| W0 | Spike (M0.4) | Idle CPU and GPU of the overlay; hover flicker; focus kept in Notepad; PresentMon "Hardware: Independent Flip" vs "Composed" for a borderless-fullscreen video with Earl visible; layers vs canvas cost. Decides D13 and D14. |
| W1 | Install | NSIS per-user with no UAC; SmartScreen noted; **on a clean Win11 VM with Smart App Control On** (signed build required if it blocks); Start menu entry; uninstall. Upgrade over v1 NSIS and over v1 MSI (the pre-install hook offers to remove the MSI): settings and stats carried over, `reunion` plays, one "Installed apps" entry, autostart path updated. |
| W2 | Transparency | No border or black box at 100/125/150/175%, mixed DPI, runtime scale change, text scaling 125%, after sleep/resume, HDR. |
| W3 | Hover | No flicker on hover transitions (LAYERED is permanent; only TRANSPARENT toggles). |
| W3b | Occlusion | YouTube playing in Chrome and a Teams call behind Earl keep rendering (`document.visibilityState` stays `visible`) while hovering and dragging him. |
| W4 | Focus | Type in Notepad and Word while clicking and dragging Earl: no keystroke lost; Focus Assist does not turn on; the taskbar stays put; `platform://ground` does not change. Earl absent from Alt+Tab and the taskbar; present on every virtual desktop. Right-click shows no browser menu; F5 and Ctrl+P do nothing. |
| W5 | Click-through | Desktop icons clickable beside his transparent corners and his tilted or tumbling body; the desktop works mid-throw and mid-chute; a flick-throw from his edge at more than 3000 px/s is not lost; swapped mouse buttons behave; 20 drags leave nothing blocked; killing `msedgewebview2.exe` frees the desktop within 2 s and the overlay reloads. |
| W5b | Hang | A dev-only command sleeps the main thread 10 s while the cursor is over Earl: the desktop is usable within 2 s and the app restarts via `--recovered`. |
| W6 | Taskbar | At default settings he lives on the taskbar top and only occasionally slips behind; feet exactly on the edge (zoomed screenshot) at every scale; roam range "Clear of the clock" keeps him off the tray and clock at every scale; peek clip pixel-exact; wade walk looks like a waddle; taskbar icons under his hidden body clickable; auto-hide slide in and out; small, tablet and top/left taskbars; `explorer.exe` restart; Start, notification centre, **jump lists, thumbnail previews, tray overflow, quick settings and taskbar context menus** drawn over him and fully clickable. |
| W7 | Fullscreen | Browser F11, YouTube fullscreen (scrub bar under Earl is clickable without hovering 600 ms), a borderless game, an exclusive D3D game, a PowerPoint slideshow (hidden via the class table), maximized with auto-hide: bottom placement and back within 1 s after exit. Each of the three "When something is fullscreen" choices: stay at the bottom (items hidden), toys stay (items visible, clicks pass through), hide Earl. |
| W8 | Sharpness | No blur at 125%, 150% and 200%, including size 256 (512 level); 256 px setting gives the right physical size. |
| W9 | Perching | Explorer, Chrome, VS Code, maximized and snapped windows; falls on move (including a slow user drag), minimize, close; ghost windows (Steam, GeForce and Discord overlays, UWP, Teams toasts, Chrome popups) never perched; rounded-corner clip; WinEvent counter < 5/s while moving the mouse. |
| W10 | Chaos | Cursor gag at most 1 s, telegraphed, aborts on a nudge, never with a button held, a click right after lands on the shield, behaviour over an elevated window; typing honk works unfocused, is silent for elevated windows, at most 3 per hour; raw input still works after toggling the feature off and on; Defender scan clean. |
| W11 | Sound | A sound plays on launch **before any click** (autoplay flag); tray and settings stay in sync. |
| W12 | Settings | Every control that exists in the build is live and persists, including the five "Where Earl can go" controls; autostart reflects Task Manager Startup state, and **disable in Task Manager, re-enable in Settings, reboot: Earl starts**; hotkey conflicts reported; hotkey "off" survives a restart; open Settings, click a browser: the browser covers Settings. |
| W13 | Lifecycle | Lock, sleep and resume, display off, RDP: no frozen or blank canvas, sane needs after a long absence, evidence-of-absence beat; logoff keeps `state.json` intact (flush request); no freeze from occlusion throttling. |
| W14 | Performance | Idle < 1% CPU total; < 200 MB after 8 h; walking cadence even on a 75 Hz or 144 Hz display if available. |
| W15 | Updater | Preview N to preview N+1 via the preview endpoint (`2.0.0-preview.<run>` versions): prompt, Later / Skip / Install, relaunch, state preserved. |
| W16a | Single instance | Single instance with autostart; a second launch opens Settings. |
| W16b | Toolbox (M3.1) | Toolbox hotkey and drawer; items persist across a restart; stash items return on "Bring Earl back". |
| W17 | Privacy | `hideFromScreenCapture` hides Earl from a Teams share and a screenshot on the layered overlay; the cursor gag is suppressed while Teams or Zoom is foreground. |

### 12.6 Behavior-quality metrics (`src/sim/metrics/metrics.ts`)

Baselines live in `test/baselines/behavior-metrics.json` (a hot file owned by M2.6 and the milestone integration units). Changing one is a deliberate edit that shows up in the PR diff. All metrics are means over 16 seeds (12.2).

**Visual signature.** Variety and repetition are computed on what is seen, not on behavior ids: the stream of `(resolved frame id, proc tags, lane and depth, facing)`. Many behavior ids look alike on screen (sit, stand_idle, pout, doze_off, rest_behind), and fallback frames make more of them alike, so id-based metrics could pass while the screen shows "duck sits there".

| Metric | Budget (default activity) |
|---|---|
| Repetition (visual signature): share of consecutive repeats; longest run | < 15%; longest run < 5 (hard) |
| Variety (visual signature): entropy per sim-hour; distinct signatures per hour | ≥ 2.5 bits; ≥ 10 |
| Longest visually static stretch while awake and visible | ≤ 90 s at activity 50 |
| Rhythm: CV of inter-behavior gaps; blink CV | ≥ 0.6 (v1 is about 0.29); blink ≥ 0.3 |
| Time shares over 8 h | idle ≤ 60%, sleep 5-30%, locomotion 10-35%, behind-taskbar within ±10% of setting, nothing else > 50% |
| Visibility (defaults, user present; re-derived for the on-top home in revision 3) | full-body ≥ 75% of awake time; expressive ≥ 85%; head-only ≤ 12%; ≥ 2 behind visits per awake hour (5.6). Per level: the 5.6 table (`always`: expressive ≥ 55%, head-only ≤ 35%) |
| Zones (D35) | zero time and zero selections in a disallowed zone; the restricted-zones scenario still meets the variety, static-stretch and repetition budgets |
| Expression (defaults) | neutral resting face ≤ 50%; grumpy family 15-30%; affectionate family ≥ 5% stranger, 12% buddy, 20% bonded (6.2) |
| Mood: 1-min autocorrelation; share of the most common label | 0.8-0.98; < 70% |
| Causes (chaos-1h) | ≥ 80% of tantrums have a logged cause within 5 s before them |
| Voice | ≤ 20 vocalizations per hour; ≤ 8 while busy |
| Reaction latency | ≤ 2 ticks in sim (gated); p95 to first drawn frame in the sandbox (reported only) |
| Draws/s, repaints/s, React commits/s, IPC/s | per section 11; commits 0 at steady state |
| Fallback share (reported, not gated) | per behavior, the fraction of time on fallback frames; printed by `npm run sim` and the debug HUD |

**Standard scenarios:** `idle-8h` × both mood modes × taskbar {visible, fullscreen}, `levels-8h` × `taskbarHiding` {never, sometimes, mostly, always}, `zones-8h` (each zone off in turn, plus the restricted set: range 0-45, perching off, `never`), `default-1h` at 0/50/100, `chaos-1h`, `interaction-script`, `day1-fresh`, `day1-throws`, `v1-reunion`, `away-1h`.

### 12.7 Dev loop for Cameron

1. Push to `v2`, and CI builds `v2-preview`.
2. Cameron runs `earl.exe` or the setup.
3. **On a problem:** `Ctrl+Alt+Shift+F12` shows the debug overlay; "Dump diagnostics" writes `diag-<ts>.json`.
4. `EARL_RECORD=1` writes every platform event to JSONL, which the Linux stub and the sandbox (`?replay=`) replay. Dumps include the launch seed (D16).
5. Each dump becomes a Rust fixture or a sandbox scenario.
6. Cameron's subjective-hour notes are tagged with the fallback share per behavior, so tuning is never judged on placeholders without knowing it.

---

## 13. Milestones and work units

**Rules:**
- **Branches:** each unit is a `feat/<id>-<slug>` branch in its own tx-spawn worktree, rebased onto a freshly fetched `v2` and merged by PR when CI is green. On a rebase conflict: abort and hand it back. Regenerable outputs (`sprites.gen.ts`, registry indexes, atlases) are not committed (D19), so they never cause conflicts.
- **Concurrency:** at most 5 workers at once and at most 2 compiling Rust. Each worktree gets its own `CARGO_TARGET_DIR`.
- **Hot files are edited only in contract units:**
  - `src-tauri/src/lib.rs`, `app_state.rs`, `events.rs`, `build.rs`, `capabilities/*`
  - `core/src/settings/schema.rs` and the bindings (including `commands.json`)
  - `package.json` and its lock, `Cargo.toml` and `Cargo.lock`
  - `vite.config.ts`
  - `src/platform/types.ts`, `src/sim/core/{types,events,intent}.ts`
  - `test/baselines/**` (owned by M2.6 and the milestone integration units only)
  - `art/shots.json` approvals (owned by M5.1 ingest runs only)
- **Everything else that many units extend is split per owner and globbed:** behaviors, items, clips (`clips/<owner>.ts`), speech lines (`speech/<category>.ts`), per-behavior tuning (next to each behavior), voices and cues. No two parallel units edit the same file.
- **Missing-feature tests** land as `test.fails` / `test.todo` tagged with the unit id; the owning unit flips them (12.2). CI stays green throughout.
- **Every acceptance gate is numeric and runnable,** and each unit names its scenario file and pass condition. Every unit after M1.S also has "its sandbox scenario passes in the integrated build".

**Legend:** L = Linux checks. W = Windows checklist items (12.5). Dep = depends on. Par = parallel-safe with.

### M0 Foundation cleanup (no behavior change; CI green; the platform spike decides the risky choices)

**M0.0 Branch setup (main session, alone)**
- **Files:** pending `.gitignore` + `CLAUDE.md` commit on master, then `v2`.
- **Accept:** `git rev-parse --show-toplevel` = `/home/cameron/mini-earl`; pushed; `v2` exists on origin.
- **L / W:** - / -.
- **Dep:** none. **Par:** none.

**M0.1 JS tooling and web CI**
- **Files:**
  - `package.json` and lock, predeclaring every npm script: `art:*`, `sim`, `sandbox`, `e2e`, `docs:anim`, `check:dashes`; `engines.node` 24; `.nvmrc`
  - `eslint.config.js` (with `src/hooks`, `src/engine`, `src/components` and `src/App.tsx` eslint-ignored until M1.4 deletes them, so no v1 behavior changes), `.prettierrc`, `vitest.config.ts`, `playwright.config.ts`
  - `.github/workflows/ci.yml` (including `audit`), `.github/dependabot.yml`, `scripts/check-dashes.mjs`
  - delete `process_sprites.mjs`
- **Accept:** `npm ci`, lint, typecheck, test and build are all clean; one smoke test each for vitest and Playwright; the dash check passes (existing offenders fixed); `npm audit --audit-level=high` clean.
- **L:** CI `web`, `e2e`, `audit` green. **W:** -.
- **Dep:** M0.0. **Par:** M0.2, M0.3, M0.4.

**M0.2 Rust tooling, icons, config, signing**
- **Files:**
  - `src-tauri/icons/*` (from the RGBA `assets/sprites/tray_icon.png` until `icon_app_01` exists); `tray.rs:44` becomes `icons/tray_32.png`
  - `Cargo.toml` (workspace, empty `core` crate, `windows`, single-instance)
  - `tauri.conf.json` (`$schema`, CSP, `bundle.windows.nsis.installMode: "currentUser"`, updater URL, version from package.json) plus the config test (4.12)
  - untrack `src-tauri/gen/schemas`
  - `.github/workflows/ci-rust.yml`, `release.yml` (Node from `.nvmrc`, NSIS, draft), `scripts/bump-version.mjs`; the separate preview and production updater keypairs (D28)
  - Azure Trusted Signing in CI (Q9 answered: assume default security settings, so SAC may be in Evaluation and builds are signed)
- **Accept:** Linux `cargo check`, clippy, test and `cargo audit` green; tray icon has alpha; a second launch focuses the first; the config test passes.
- **L:** CI `rust` green; `cargo xwin clippy` if tools are approved. **W:** CI artifact runs; tray icon has no grey square; W16a.
- **Dep:** M0.0, Q9 (answered: sign), Q10 (server tools, open until Cameron confirms). **Par:** M0.1, M0.3, M0.4.

**M0.3 Docs and art pipeline**
- **Files:**
  - `docs/{SPEC,ART,TESTING,ROADMAP}.md`, README; delete TODO, HANDOFF, PROMPT; the docx moves to `docs/archive/`
  - `scripts/art.mjs`, `scripts/art/lib/*` (soft keyer with despill, both style profiles, per-frame tiers, per-shot lint overrides, prop footprint and attach-line measurement, 256 and 512 export levels)
  - `art/shots.json` (from ART_SHOTLIST), `art/reference/v1/*` (v1 PNGs moved here), `.gitattributes`
  - build-time codegen of `src/assets/atlas/*` + `src/sim/anim/sprites.gen.ts` (gitignored; placeholders: v1 art at 2×, keyed and aligned)
  - delete `assets/` and `scripts/fix-sprites.mjs`
  - **do not** touch `src/assets/sprites/` (v1 still uses it until M1.4)
- **Accept:**
  - `art:import`, `art:build`, `art:check` and `art:status` work, with per-frame status;
  - the keyer (golden image on a synthetic anti-aliased circle), magenta-fringe check, checkerboard rejection, eye-hole check, dark/grey rim ERR and alignment all have tests;
  - `art/SHOTLIST.md` regenerates and matches `ART_SHOTLIST.md`;
  - ART.md carries the stray-copy "Art Pipeline" section;
  - the coverage report reads "final 0/133, placeholder N".
- **L:** `art:check`, contact sheet. **W:** -.
- **Dep:** M0.0 (scripts predeclared by M0.1; it may start in parallel). **Par:** M0.1, M0.2, M0.4. **Batch A art waits for the Q2 lineup pick** (Q2 answered: the gate stays).

**M0.4 Windows platform spike (one worker, throwaway branch `spike/overlay`)**
- **Files:** a minimal Tauri app on the spike branch only: one full-monitor overlay with the 4.1 subclass (permanent LAYERED, `WM_APP_SETHIT`, `WM_ACTIVATE` hand-back, 1 px top inset); one 96 px canvas walking left and right with `translate3d` (layers) and the same in a full-monitor dirty-rect canvas (flag); a pointer thread with transitions-only click-through and the capture latch; ground from `ABM_GETTASKBARPOS`; a key-logger test page for focus; the shared `BROWSER_ARGS`.
- **Accept (W0, measured by Cameron on the CI-built exe):** idle CPU and GPU (Task Manager plus WebView2 perf); hover flicker; focus loss while typing in Notepad; W3b occlusion; PresentMon "Hardware: Independent Flip" vs "Composed" for a borderless-fullscreen video with Earl visible; layers vs canvas cost. The result is written into D13 and D14 before M1.0: full-monitor or bottom-band/bbox window (with the viewport origin), and which one renderer mode to build.
- **L:** builds on CI. **W:** W0.
- **Dep:** M0.0, M0.2 (CI). **Par:** M0.1, M0.3.

### M1 First playable v2 (new engine, the taskbar request, working settings, updater prompt)

**M1.0 Contracts (alone)**
- **Files:**
  - `src/platform/types.ts`, `src/shared/{ipc,events,deepPartial}.ts`
  - `core/src/settings/schema.rs` (the **full** section 9.1 schema) + `state.rs` + the ts-rs export to `src/shared/bindings/` + the `commands.json` export
  - `src-tauri/src/lib.rs` (plugin order: single-instance first, then global-shortcut, autostart, updater, log; `device_event_filter(Always)`; every command in 4.9 registered as a stub), **`app_state.rs` and `events.rs` with every field and event declared**
  - `build.rs`, `capabilities/{overlay,panel}.json`, `commands/*.rs` stubs, `platform/{mod,stub}`
  - `src/sim/core/{types,events,intent,params}.ts`, `src/sim/anim/types.ts`, `src/render/types.ts` (with the viewport origin)
  - `src/panels/shared/UpdateCard.tsx` as a typed stub (M1.8 owns the real one)
  - `vite.config.ts` (entries `overlay.html`, `panel.html`, `sandbox/index.html`), `docs/IPC.md`
  - all new dependencies (D33)
- **Accept:** everything compiles with stubs; IPC names and payloads frozen; bindings and `commands.json` diff clean; the capability cross-check passes.
- **L:** typecheck, `cargo test`. **W:** -.
- **Dep:** M0.1-M0.4. **Par:** none.

**M1.S Walking skeleton (one worker, before the fan-out)**
- **Files:** `src/sim/core/{world,loop,rng,clock}.ts` (minimal), a floor from the stub `platform://ground`, Earl walking and hopping; the one renderer mode chosen in M0.4 (minimal); `src/overlay/{boot,scheduler}.ts`; `src/platform/tauri.ts` (typed from `commands.json`); a minimal sandbox with a taskbar toggle; one Playwright spec; the Rust stub answering `platform_init`.
- **Accept:** `npm run sandbox` shows Earl walking and hopping on the floor, and he stands on the taskbar top or the screen bottom as the toggle changes; the Playwright spec passes; the `ipc-contract` job passes; the stub app runs on Windows from CI.
- **L:** e2e, `ipc-contract`. **W:** the CI exe shows him walking (smoke only).
- **Dep:** M1.0. **Par:** none. M1.1-M1.9 extend this running system.

**M1.1 Windows platform core**
- **Files:**
  - `src-tauri/src/{overlay.rs, platform/windows/{thread,overlay_style,monitor,taskbar,fullscreen,pointer,session,diag}.rs}`
  - `core/src/{geom,taskbar,fullscreen,hit}.rs` + fixtures
  - `commands/platform.rs`, `commands/diag.rs`
  - delete the old `commands.rs` code
- **Accept:** 4.1-4.6 and 4.10 are implemented: one overlay; the subclass with permanent LAYERED/TOOLWINDOW/NOACTIVATE, `WM_APP_SETHIT`, `WM_ACTIVATE` hand-back and the 1 px inset; `DisableProcessWindowsGhosting`; the shared `BROWSER_ARGS` and the WebView2 settings (no context menu, no accelerators, `ProcessFailed` reload); the pointer thread on a high-resolution timer with transitions-only toggling, the capture latch, `SM_SWAPBUTTON`, far-field events, proximity-gated precision and the affine hit test; dead-man switch, capture watchdog and hang watchdog; the ground event with debounce; the auto-hide poll; shell popups as occluders; fullscreen classification with the presenter class table and hover-to-arm; `platform://activity` from `GetLastInputInfo`; `hideFromScreenCapture`; pause and resume; the stub backend.
- **L:** `cargo test -p earl-core` (fixtures), `cargo xwin clippy`. **W:** W2-W7, W11 (autoplay), W13, W17 (capture half).
- **Dep:** M1.S. **Par:** M1.2 (Rust; max 2 compiling), M1.3-M1.8.

**M1.2 Settings, state, tray, panels plumbing**
- **Files:**
  - `core/src/settings/{validate,patch,migrate}.rs`
  - `src-tauri/src/{store,tray,panels,autostart,hotkey}.rs`, `commands/{settings,state,system}.rs`
- **Accept:** 9.1-9.4 and 4.11:
  - patch, validate, rev and broadcast; null rejected;
  - one load path with per-field schema defaults, and corrupt quarantine;
  - atomic coalesced writes, `state://flush-request` and exit flush;
  - v1 migration including month 13, ordered and crash-safe (a test per step);
  - `tray::sync`;
  - autostart OS truth (`byte0 & 1`) and `autostart_set(true)` clearing StartupApproved;
  - hotkey registration with status, `{enabled, accel}`;
  - quiet time plumbing;
  - the unowned panel window opened and navigated; its rect as an occluder.
- **L:** `cargo test` (migration fixtures and crash steps, merge, chaos rules, schema-default fallback). **W:** W1 (migration part), W12 (existing controls, autostart, panel z-order).
- **Dep:** M1.S. **Par:** M1.1, M1.3-M1.8.

**M1.3 Sim core and physics**
- **Files:** `src/sim/core/{world,loop,rng,clock}.ts` (completing M1.S), `src/sim/physics/**` (not the parachute), `src/sim/env/**`, `src/sim/input/gestures.ts`, `src/sim/particles.ts`, `src/sim/persist.ts`, `src/sim/stats.ts`, `test/sim/physics*.test.ts`, `test/sim/env*.test.ts`.
- **Accept:** 5.1-5.9 except the parachute:
  - fixed step, seeded streams, `advanceTo` and analytic `onResume`;
  - swept platforms, bounce cap, 2D throws, pendulum hold;
  - gesture thresholds;
  - floor transitions and the `taskbarLane` controller (the depth ladder, virtual floor, eye-line placement, wade walk, peek-bob, duck, pop-out) with the clip model;
  - the roam-range walkable interval with soft walls on every ground mode (5.6, D35);
  - heap growth < 1 MB over 1 M steps with `--expose-gc`.
- **L:** physics and env tests, purity (tsconfig + ESLint), determinism, `test/scenarios/physics-*.ts`. **W:** -.
- **Dep:** M1.S. **Par:** M1.1, M1.2, M1.4-M1.8.

**M1.4 Overlay shell, renderer, animation, audio base**
- **Files:**
  - `src/app/overlay-main.ts`, `src/overlay/{boot,scheduler,pacing,input,hitShapes}.ts` (completing M1.S)
  - `src/render/**` (except `hud/`, `fx/parachute`), `src/sim/anim/{animator,blink,procedural}.ts`, `src/sim/anim/clips/*.ts` for the M1 behaviors
  - `src/audio/{engine,voice}.ts`, `src/audio/cues/*.ts` (quack, honk, peep, boing, bloop)
  - delete `src/hooks`, `src/components`, `src/engine`, `src/App.tsx`, `src/utils/*`, `src/assets/sprites`, and `index.html` (replaced by `overlay.html`)
- **Accept:** 5.10-5.12 and 5.13 (base):
  - the one renderer mode chosen in M0.4, with CSS-transform procedural motion and CSS clip-path occlusion;
  - DPR, the 256/512 level choice, encoded-page sprite cache, size-slider CSS scaling;
  - no readback;
  - repaints only on frame id, flip or DPR size;
  - ACTIVE/IDLE/PAUSED with frame pacing (unit test at 6 refresh rates);
  - proximity-gated hit shapes (0-2 IPC/s when the cursor is far) with clips and affines;
  - pose-class variant resolution; procedural eyelid blink and mouth-sync pop;
  - AudioContext at boot with the resume fallback;
  - canvas-drawn bubbles, glyph bubbles and hearts;
  - crypto seeding in boot.
- **L:** e2e screenshots at 3 DPRs and at size 256 / DPR 1.5, draw, repaint, commit and IPC count budgets. **W:** W3, W8, W11, W14.
- **Dep:** M1.S, M0.3. **Par:** M1.1-M1.3, M1.5-M1.8.

**M1.5 Brain skeleton and first behaviors**
- **Files:**
  - `src/sim/brain/{index,context,perception,utility,selector,reactions,fidget,speech,tuning,debug}.ts`, `affect.ts` (full engine with slider baselines, percentile thresholds and caused swings), `behaviors/{types,registry}.ts`
  - behaviors:
    - `locomotion/{wander,trot,happy_hops,investigate,edge_peer}`
    - `rest/{sit,stand_idle,rest_behind,doze_off,nap,hide_nap,stretch,wake}`
    - `terrain/{slip_behind_taskbar,wade_walk,peek_pop,whack_a_mole,climb_onto_taskbar,return_to_range,wall_bump}`
    - `airborne/{picked_up,thrown,land}`
    - `emotional/{caught,startle,pout}`
    - `special/{first_meeting,reunion,birthday_party,bring_back,quiet_nap}`
  - click (hop-class at every tier), double-click, pet and spam reactions
  - the zone gates (`zones` in `behaviors/types.ts`, `zoneGate` in `utility.ts`, D35) for every zone, including the ones whose behaviors land later
  - `scripts/sim.ts` (run through `vite-node`)
- **Accept** (`test/scenarios/m15-*.ts`, 16 seeds):
  - 8 h sim: sleep 12-30%; stretch occurs; behind share per setting ±10%; at the default `sometimes`: full-body ≥ 75%, expressive ≥ 85%, head-only ≤ 12%, ≥ 2 behind visits per awake hour; the per-level floors of 5.6 for the other levels; no stuck state over 5 min; no triple repeats;
  - taskbar-gone produces `caught`;
  - `never` suppresses every behind behavior; `sometimes` never returns him behind automatically after a pop-up and brings him back on top when a visit ends; `always` returns him behind within 3 s after a pop-up;
  - roam range: zero ground time outside the range except while held, airborne or in `return_to_range` (at most 10 s); zone-gated behaviors are never selected.
- **L:** brain sim tests, the `npm run sim` report. **W:** subjective notes, tagged with fallback shares.
- **Dep:** M1.S (codes against M1.3 intents; integration scenarios flip from `test.fails` when M1.3 merges). **Par:** M1.1-M1.4, M1.6-M1.8.

**M1.6 Sandbox, e2e harness, metrics**
- **Files:** `sandbox/**` (extending the M1.S minimal sandbox: taskbar visible / auto-hide / fullscreen / d3d toggles, height and edge, scale, keyboard to `typing://burst` and `userBusy`, shell-popup toggle, a zones debug layer that tints the roam range and the allowed zones, JSONL replay), `e2e/**`, `src/sim/metrics/**` (visual signature, per-level visibility, visits, zones, expression, cause and voice metrics), the CI summary step.
- **Accept:** 12.1 (except fake windows, which move to M3.1b) and 12.6; `metrics.json` in the CI summary; replay of JSONL recordings.
- **L:** e2e green. **W:** -.
- **Dep:** M1.S. **Par:** all M1.

**M1.7 Panel window (Settings and About)**
- **Files:** `panel.html`, `src/app/panel-main.tsx`, `src/panels/**` except `src/panels/shared/UpdateCard.tsx` (imports the M1.0 stub; controls for later features are live but labelled "arrives in a later build" until those units merge; the Needs mode card reads "arrives with the toolbox" until M3.2), `src/shared/settingsStore.ts`.
- **Accept:** 9.3; every existing control patches and applies live, including the "Where Earl can go" card (the perching and climbing rows are live but labelled "arrives in a later build" until M3.6 and M4.1 merge, and the fullscreen row's "Earl and his toys stay" choice until M3.1 merges); rev guard; About with the real date and stats; hooks lint clean.
- **L:** an e2e test for every control. **W:** W12 (existing controls), the panel at 4 scales.
- **Dep:** M1.S. **Par:** all M1.

**M1.8 Updater**
- **Files:** `src-tauri/src/updater.rs`, `src/panels/shared/UpdateCard.tsx` (sole owner), the tray item, `EARL_UPDATE_ENDPOINT` preview handling, the preview CI version and key.
- **Accept:** 4.12 consent flow; no silent install; the preview endpoint only in preview builds; preview N+1 is offered to preview N.
- **L:** mocked updater e2e. **W:** W15.
- **Dep:** M1.S, M1.2 (tray sync API). **Par:** M1.1, M1.3-M1.7.

**M1.9 Parachute**
- **Files:** `src/sim/physics/parachute.ts`, `src/render/fx/parachute.ts` (placeholder canopy and strings), `behaviors/airborne/parachute_glide.ts`, `clips/parachute_glide.ts`, tests.
- **Accept:** 5.5; terminal velocity 110 ± 5; deploy timing by mood; drape 20% (over 16 seeds); hem attach points from `sprites.gen.ts`.
- **L:** physics tests, e2e throw. **W:** subjective.
- **Dep:** M1.3. **Par:** M1.4-M1.8.

**M1.10 Integration (alone)**
- **Files:** wiring only (the skeleton means most integration already happened unit by unit).
- **Accept:**
  - the v1 leftovers are gone;
  - the `v2-preview` build goes to Cameron;
  - W1-W8, W11, W13-W15, W12 for the controls that already work, and W16a are run. The toolbox half of W16 moves to M3.1, the chaos and toolbox parts of W12 to M4 and M5.3.
- **L:** full CI. **W:** the list above.
- **Dep:** M1.1-M1.9. **Par:** M2 (the Windows checklist runs alongside M2; findings become fix units).

### M2 Personality (the "not a robot" metrics pass; both mood modes)

**M2.0 Contracts (alone)**
- **Files:** the full `BrainContext`, the persisted `brain` blob v1 type + migrate (affect, needs, relationship with sessionWariness / roughMemory / habituation, episodic, whims, dayTemperament), the `SoundCue` and fx API, speech categories.
- **Accept:** typecheck.
- **Dep:** M1.S, M1.3-M1.5 merged and Linux CI green (not M1.10; pure-TS brain work does not wait on the Windows checklist). **Par:** none.

**M2.6 Scenario suite and baselines (merged first)**
- **Files:** `test/scenarios/**`, `test/baselines/**`.
- **Accept:** every 12.2 and 12.6 brain assertion exists over 16 seeds, as `test.fails` tagged with its unit where the feature is missing; CI green.
- **Dep:** M2.0. **Par:** M2.1-M2.5, M2.7.

**M2.1 Needs and mood modes**
- **Files:** `brain/needs.ts`, mode switching, offline decay, presence gating, diegetic asks, foraging, gratitude, the sulk arc and guilt trip.
- **Accept** (`test/scenarios/needs-*.ts`): first sulk at 90-150 min at every activity row with no items and the user present; user away 1 h gives no sulk and a guilt beat; mode switch without a sulk; at most one bubble per 8 min after the first. (The "with items" balance moves to M3.2/M3.3.)
- **L:** scenario tests. **W:** -.
- **Dep:** M2.0. **Par:** M2.2-M2.5, M2.7.

**M2.2 Relationship, memory and arcs**
- **Files:** `brain/{relationship,memory,episodic,arcs}.ts`, persistence through `state.brain`.
- **Accept** (`test/scenarios/relationship-*.ts`): 6.4-6.5, 6.17, 6.18 and 6.20 (except fetch, M3.3); 20 soft throws on day 1 then 30 min of gentle play gives wariness < 0.4; the 10th chute throw is "wheee" in ≥ 50% of seeds; melt within 3 pets on day 1; no day-1 `avoid_cursor` without a slam; reunion on a migrated config; a callback within 2 sim-hours of a slam in ≥ 60% of seeds; reload decay.
- **L:** tests. **W:** state survives a restart.
- **Dep:** M2.0. **Par:** M2.1, M2.3-M2.5, M2.7.

**M2.3 Behavior catalogue (non-item, non-chaos) and the new brain systems**
- **Files:** `behaviors/{locomotion,rest,social,emotional,special}/*.ts` for everything in 7.1-7.4 and 7.8 not done in M1.5, including `morning_greeting`, `goodnight`, `callback_*`, `guilt_trip`, `stalk_critter`, `forage`, `whim_pursuit`, `tier_scene`; `brain/{whims,attention,causes}.ts`; `fidget.ts` complete (settled and restless); `speech/<category>.ts` pools (≥ 6 lines per daily category, templated).
- **Accept:** the 12.6 budgets pass at activity 0/50/100 and in both modes (visual-signature variety ≥ 2.5 bits, static stretch ≤ 90 s, expression shares, voice budget); whims ≥ 3 per awake hour with ≥ 25% success; reachability.
- **L:** metrics. **W:** Cameron's subjective hour (fallback shares noted).
- **Dep:** M2.0 (M2.1 and M2.2 for the need- and relationship-gated scores; `test.fails` until merged). **Par:** M2.1, M2.2, M2.4, M2.5, M2.7.

**M2.4 Procedural motion and fx**
- **Files:** `src/render/fx/**` (including the ambient critter drawing and the glyph set), `sim/anim/procedural.ts` extensions, `sim/critters.ts`, particle kinds.
- **Accept:** 5.12 complete; heap growth gate holds; repaints stay about 7/s while walking with all procedural motion on.
- **L:** screenshot scenarios, repaint counts. **W:** W8, W14.
- **Dep:** M2.0. **Par:** M2.1-M2.3, M2.5, M2.7.

**M2.5 Voice and variation**
- **Files:** `src/audio/voices/*.ts`, `src/audio/cues/*.ts` additions, mood colouring, limits, the hourly budget, night factor, muteWhenBusy.
- **Accept:** 6.13; at most 1 vocalization per 1.5 s; ≤ 20 per hour, ≤ 8 while busy.
- **L:** unit tests on the parameter generation and the budget. **W:** W11, subjective.
- **Dep:** M2.0. **Par:** all M2.

**M2.7 Needs HUD and Mood tab**
- **Files:** `src/render/hud/needs.ts`, `src/panels/settings/sections/Mood.tsx` (mode cards, personality card), the toolbox header bars stub (three bars).
- **Accept:** HUD modes; live personality sliders; the Needs card label rule.
- **L:** e2e. **W:** W12.
- **Dep:** M2.0. **Par:** all M2.

### M3 World (toolbox, persistent items, window perching)

**M3.0 Contracts (alone)**
- **Files:** `sim/items/{itemDefs,affordances}.ts` types (including `depth: Floor|Stash`), `ItemView`, `WindowSurface` / `SurfacesMsg` types (`hideable`, `surfaces://grabbed`), the surfaces commands in `lib.rs` (stubs already exist).
- **Accept:** typecheck.
- **Dep:** M2.0. **Par:** none. It may run while late M2 units finish, since its files are disjoint.

**M3.1 Item framework and toolbox**
- **Files:** `sim/items/{registry,itemDefs}.ts`, `src/overlay/ui/{ToolboxDrawer,ItemContextMenu}.tsx`, item persistence, `render/props/` base, hotkey wiring to `earl://command`, the day-1 discovery beat hook.
- **Accept:** 8.1-8.2; drag out, move and put away; caps; persistence across a reload; big-item clearance; fullscreen hiding and `stayWithItems` (display-only items); items outside the roam range are ignored unless he is dropped on one; measured footprints from `sprites.gen.ts` (placeholders use the targets).
- **L:** e2e. **W:** W16b.
- **Dep:** M3.0. **Par:** M3.1b, M3.5.

**M3.1b Sandbox fake windows**
- **Files:** `sandbox/fakeDesktop/windows*.ts`: draggable, closable, minimizable fake windows with z-order, cloak, user-drag start events and a fake panel.
- **Accept:** the 12.1 fake-window controls and `__earl.desktop.{addWindow,moveWindow,closeWindow}`.
- **L:** e2e. **W:** -.
- **Dep:** M3.0. **Par:** M3.1, M3.2-M3.5.

**M3.2 Items A: trampoline, bed, bread, seeds, and the stash**
- **Files:** `sim/items/{trampoline,bed,bread,seeds}.ts`, placeholders, behaviors `trampoline_bounce`, `bed_sleep`, `eat_bread`, `eat_seeds`, `king_of_hill`, `on_dropped_onto_item`, **`item_steal` (base behavior) and the stash depth**.
- **Accept** (`test/scenarios/items-a-*.ts`): 8.3 rows and 7.6; stashed items clip and hit-clip at the edge and return on "Bring Earl back"; the stash is always inside the roam range, and there is no stash with `taskbarHiding = never` (the ball, bread or seeds are pushed instead); Needs balance with bed and bread placed (with ball after M3.3): every meter above 25 for 8 h. The Needs mode card becomes selectable.
- **L:** item tests, scenarios. **W:** subjective.
- **Dep:** M3.1. **Par:** M3.3, M3.4, M3.6.

**M3.3 Items B: tub, ball, rubber duck**
- **Files:** `sim/items/{tub,ball,rubberDuck}.ts`, water volume, behaviors `bath_splash`, `drink`, `ball_play`, `rubber_duck`, `fetch` (buddy tier).
- **Accept** (`test/scenarios/items-b-*.ts`): splash ∝ impact; the three rubber-duck phases; jealousy grudge; fetch returns the ball to the cursor in ≥ 80% of attempts; the full Needs balance with bed, bread and ball.
- **L:** tests. **W:** subjective.
- **Dep:** M3.1. **Par:** M3.2, M3.4, M3.6.

**M3.4 Items C: fan and umbrella**
- **Files:** `sim/items/{fan,umbrella,wind}.ts`, behaviors `fan_reaction`, `fan_switch`, `umbrella_hide`, `umbrella_ride` (v2.0 scope, 7.6).
- **Accept:** fan drift on the chute more than 5× bare Earl; parasol glide from a jump_down next to an open umbrella.
- **L:** tests. **W:** subjective.
- **Dep:** M3.1, M1.9. **Par:** M3.2, M3.3, M3.6.

**M3.5 Window surfaces (Rust)**
- **Files:** `platform/windows/{windows_enum,winevents,vdesk}.rs`, `core/src/surfaces.rs` + fixtures, `commands` surfaces bodies.
- **Accept:** 4.7; filtering; perch segments; occluders (including the panel and shell popups); `hideable`; watched ids and `surfaces://grabbed`; low-rate global hooks plus pid-scoped LOCATIONCHANGE only; a diag callback counter < 5/s while moving the mouse continuously.
- **L:** core fixtures, xwin clippy. **W:** W9.
- **Dep:** M3.0. **Par:** M3.1-M3.4 (Rust: max 2 compiling).

**M3.6 Perching sim and behaviors**
- **Files:** `sim/physics/{reach,surfaces}.ts` window segments, occluder clip-path per depth, behaviors `perch_jump` (with overreach), `perch_walk`, `perch_hop_across`, `jump_down`, `ride_window`, `fall_off`.
- **Accept** (`test/scenarios/perch-*.ts`): 5.7; he falls in the tick a window moves fast or closes, and after the scramble when the user starts a drag (in the sandbox); never perches on an occluded edge; with `earl.windowPerching` off, zero perch behaviors and window-top whims over 8 h, and a drop onto a window ends in `jump_down`.
- **L:** sim tests, e2e with fake windows. **W:** W9.
- **Dep:** M3.0, M3.1b (the Windows check waits for M3.5). **Par:** M3.2-M3.5.

### M4 Chaos (one master switch, four independent subs)

**M4.0 Contracts (alone)**
- **Files:** `sim/chaos/effective.ts`, the chaos gating in the registry, the gag and typing event types (the commands already exist as stubs), the episode types.
- **Accept:** typecheck; the chaos-off gate test is green.
- **Dep:** M3.0. **Par:** none.

**M4.1 Wild Earl**
- **Files:** `sim/chaos/{wild,episodes}.ts`, the wall-climb body mode, behaviors `sprint`, `random_tantrum`, `wall_climb` (Wild version and the calm `anytime` version, D35), `wall_bounce`, zoomies weight.
- **Accept** (`test/scenarios/chaos-wild.ts`, 16 seeds): gremlin episodes every 8-20 min lasting 30-90 s, ending in a flop; `earl.wallClimbing`: `never` gives zero climbs, `wildOnly` (default) gives zero climbs with chaos off, `anytime` gives calm climbs (≤ 40% height, ≥ 15 min apart) with chaos off; per-hour behavior entropy ≥ 0.5 bits above the chaos-off baseline; ≥ 80% of tantrums have a logged cause within 5 s.
- **L:** tests. **W:** subjective.
- **Dep:** M4.0. **Par:** M4.2-M4.5.

**M4.2 Messes (brain side)**
- **Files:** `sim/chaos/pranks.ts`, behaviors `grab_cursor` (telegraph), `flee_cursor` (tag), `hide_behind_window`, `typing_honk`, the `item_steal` Messes weight, peek_pop scares.
- **Accept** (`test/scenarios/chaos-messes.ts`): the guardrail property tests (zero violations; every cap in 12.2); `hide_behind_window` clip correct and an eye always visible.
- **L:** tests, sandbox. **W:** W10.
- **Dep:** M4.0, M3.2 (item_steal base), M3.6 (window depth). **Par:** M4.1, M4.3-M4.5.

**M4.3 Messes (platform side)**
- **Files:** `platform/windows/{cursor_gag,rawinput}.rs`, `core/src/{gag,typing}.rs`.
- **Accept:** 4.8; the refusal, abort, path and click-shield rules unit-tested; the key-identity pin test; raw input owned only by earl-platform, re-registered after `TaskbarCreated` and resume, with the debug assertion on `hwndTarget`.
- **L:** core tests, xwin clippy. **W:** W10, W17 (meeting-app suppression).
- **Dep:** M4.0. **Par:** M4.1, M4.2, M4.4, M4.5.

**M4.4 Duck swarm**
- **Files:** `sim/chaos/swarm.ts`, the duckling entity, the Earl-clip to baby-clip table, quirks, duckling click, tint rendering, `herd_ducklings`.
- **Accept** (`test/scenarios/chaos-swarm.ts`): D10 caps; the scatter-on-grab rule; visits start only from allowed lanes; each duckling has a quirk; a duckling click logs an episodic entry.
- **L:** swarm scenario. **W:** subjective ("not too crazy").
- **Dep:** M4.0. **Par:** M4.1-M4.3, M4.5.

**M4.5 Physics party**
- **Files:** `sim/chaos/physicsParty.ts`, the party bursts, `bounce_play` / `moon_hop`.
- **Accept** (`test/scenarios/chaos-physics.ts`): 6.11 row; bursts every 3-6 min lasting 10-20 s; the scheduler reaches IDLE between bursts; items stay on the primary monitor.
- **L:** tests. **W:** subjective.
- **Dep:** M4.0, M3.2, M3.3, M3.4 (the real item kinds). **Par:** M4.1-M4.4.

### M5 Art and polish (continuous from M0; its exit gates M6)

**M5.1 Art batch ingest (repeatable, one per batch Cameron delivers)**
- **Files:** `art/masters/*`, `art/shots.json` approvals (sole owner). Atlases and `sprites.gen.ts` are regenerated by the build, not committed.
- **Accept:** `art:check` has no errors; warnings are reviewed on the contact sheet; lineup approved by Cameron. Batch A starts only after Cameron picks a style from the `earl_sit_idle_01` lineup (Q2, gate confirmed) and the 4 masters are approved next to v1.
- **L:** `art:check`, art lint, e2e screenshots. **W:** W8.
- **Dep:** M0.3, the Q2 lineup pick. **Par:** everything (it touches only art sources).

**M5.2 Icons**
- **Files:** `src-tauri/icons/*` from `icon_app_01` and `icon_tray_01`; the per-DPI tray picker.
- **Accept:** the `.ico` holds 16-256 at 32-bit; transparent corners.
- **W:** the tray at 100/150/200% on light and dark taskbars.
- **Dep:** the art. **Par:** all.

**M5.3 Polish and performance pass**
- **Files:** tuning, budgets, pixel fixes.
- **Accept:** every section 11 budget on Windows, including the wall-clock timings that CI only reports; art coverage P0 and P1 final; W12 for chaos and toolbox controls.
- **W:** W14, W8, W12.
- **Dep:** M4. **Par:** M5.1.

### M6 Release

**No hard date (Q14, answered).** Every milestone (M1 to M5) ships as a `v2-preview` build to Cameron; the release to Juliette waits for P0 and P1 art to be final (M5.3).

**M6.1 Release candidate**
- **Accept:** `bump-version` to 2.0.0; a signed draft release (Q9); the full checklist W1-W17 run on the draft, including upgrades from v1 NSIS and v1 MSI and a clean VM with Smart App Control On.
- **Dep:** M5.3.

**M6.2 Ship**
- **Accept:** Cameron publishes; `v2` merged to `master`; remote `feat/*` branches deleted; Cameron installs it on Juliette's machine.
- **Dep:** M6.1.

---

## 14. Risks and mitigations

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Transparent full-monitor WebView2 costs more GPU or CPU than measured on paper, or forces DWM composition over borderless-fullscreen video and games | Medium / high | Measured first, in the M0.4 spike (W0), before contracts freeze. Fallback: a bottom-band or entity-bbox window with world coords unchanged (the renderer takes a viewport origin from M1.0), at least while an `app` fullscreen is up. |
| tao rewrites the overlay's styles (flicker, focus theft, non-layered occluding window) | High if tao is used / high | tao's style APIs are never called after init; the subclass owns LAYERED, TOOLWINDOW, NOACTIVATE and TRANSPARENT (4.1). Verified in M0.4. |
| WebView2 grabs focus when Earl is clicked | Low / high | NOACTIVATE + MA_NOACTIVATE + the `WM_ACTIVATE` hand-back + the 1 px top inset; W4 (Focus Assist, ground unchanged). |
| The main thread hangs while the overlay is hittable | Low / high | `DisableProcessWindowsGhosting`; the pointer thread's `SendMessageTimeoutW` hang watchdog restarts the app (W5b). |
| WebView2 occlusion throttling freezes rAF | Low / high | The `CalculateNativeWinOcclusion` flag in the shared `BROWSER_ARGS`, tested first. |
| Earl covers shell popups or the panel | Medium / medium | No topmost reassert on taskbar focus; shell popups, other-process topmost windows and the foreground panel are occluders (4.1, D9); W6, W12. |
| Topmost fights with video players or other overlays | Medium / low | Reassert policy with a rate limit and give-up. |
| Smart App Control blocks an unsigned install on Juliette's fresh Windows 11 | Medium / high | Q9 answered: sign with Azure Trusted Signing; W1 on a clean VM with SAC On. |
| Antivirus flags an exe using raw input, SetCursorPos and a global hotkey | Medium / medium | No LL hooks; raw input only while the feature is on (off by default); Defender check W10; signing (Q9). |
| Raw input registration conflicts with tao | High without the fix / medium | `DeviceEventFilter::Always`; earl-platform is the only owner; debug assertion (D26). |
| Auto-hide slide makes the clip line lag | Medium / low | 30 Hz rect poll only while sliding. |
| AI art drifts off-model between poses | High / medium | Edit-mode generation from approved masters; ovl alignment; art lint and checks; contact sheets; placeholders keep the code moving. |
| Cameron makes 133 images in a style he did not choose | Medium / high | Q2 is a hard gate before Batch A; the 4 masters are approved next to v1 first (D20). |
| Anti-aliased art at large sizes looks soft at 150-200% | Low / low | The 512 export level (D19). |
| The behavior feel is still "robotic" despite the design | Medium / high | Visual-signature metrics gate merges; whims, episodic callbacks, attention and the onboarding arc; time-warp debug overlay; tuning override hot reload; Cameron's subjective hour each milestone, tagged with fallback shares. |
| The `mostly` and `always` levels (behind the taskbar as home) make him a static head most of the time | Low (the default is now on top, D1) / medium | The full-body wade lane and the per-level visibility floors (5.6, 12.6). |
| At `sometimes` (the default) he never actually slips behind, so the behavior Cameron's words imply is invisible | Medium / medium | Scored visit reasons (sulk, nap, shy, busy peek, curiosity) and the "≥ 2 visits per awake hour" gate (5.6, 12.6). |
| A narrow roam range or several zones off make him feel caged and repetitive | Medium / medium | Minimum span 25%; soft walls instead of bonks; the restricted-zones scenario must still meet the variety and static-stretch budgets (12.2, 12.6). |
| The first hour with Juliette reads as unfriendly | Medium / high | The honeymoon arc, throw habituation and the no-avoidance-on-day-1 rule (6.4, 6.18), with scenario tests. |
| Scope: 133 art images, 80+ behaviors, 9 items | High / medium | Milestones are independently shippable preview builds; P0/P1/P2 tiers; the code never waits on art. |
| Parallel workers collide | Medium / medium | Contract units own the hot files; per-owner globbed files; generated outputs not committed; one worktree per writer; at most 2 Rust builds; M1.S before the fan-out. |
| IPC or capability drift between TS and Rust | Medium / medium | `commands.json` codegen and the `ipc-contract` xvfb job (D32). |
| Statistical tests flake | Medium / medium | 16-seed means with spread-derived tolerances; wall-clock budgets reported, not gated (12.2, 11). |
| Tauri Channel mocking in the sandbox is awkward | Medium / low | Invoke the mock channel's `onmessage` directly (D32). |
| Updater private key lost | Low / high | Q8: confirm an off-GitHub backup; separate preview key. |
| NSIS over an existing MSI v1 leaves two installs | Medium / low | The `NSIS_HOOK_PREINSTALL` hook offers to uninstall the MSI; W1 tests both. |
| cargo-xwin unavailable on the server | Low / low | The Windows CI job covers the same check. |
| Privacy perception of typing detection or screen sharing in a gift | Low / medium | Counts only; off by default; About panel disclosure; the pin test; `hideFromScreenCapture`; no gag while a meeting app is foreground. |
| Exclusive D3D games cannot show him anyway | Certain / low | Hidden by default in D3D and presentation. |

---

## 15. Open questions for Cameron

Cameron answered on 2026-09-29 (revision 3). Each question keeps its original text and recommendation, followed by its status. **One part stays open:** the server-tool installs in Q10. Q9 is answered (assume default security settings, so builds are signed) and the stray-copy half of Q10 is answered (keep them, content consolidated into `docs/SPEC.md`). Q2 is answered, and its gate still applies: Batch A waits for the lineup pick.

1. **Taskbar default (D1, 5.6).** Your words were "when there is a taskbar he should hide behind it". The setting has four levels: `never` = always on top of the taskbar (like v1); `sometimes` = lives on top, slips behind about 15% of the time to sulk, nap or peek; `mostly` = lives behind about 60% of the time and plays on top; `always` = lives behind about 85% of the time and only hops up for things that need a real surface (windows, items, trampolining, being dragged), coming back behind within a few seconds. Behind the taskbar he is not just a head: he usually stands with his head, wings and chest showing and waddles, quacks and fidgets there, and only sinks to a chin-on-the-edge peek, eyes-only sulk or crest-only nap when the mood calls for it. Recommended was `always`. **Answered: "His home is on top of the taskbar with settings that change where he is allowed to wander." Default is now `sometimes` (home on top, slips behind by choice), and a new "Where Earl can go" group holds five wander-zone controls (D1, D35, 5.6, 9.1, 9.3).**
2. **Art style (D20) - blocks Batch A.** Keep the originals' crisp look (hard edges, visible pixel steps at large sizes, same tan rims, no dark outlines), or move to a smooth anti-aliased plush illustration at 256 (same shapes, palette and rims)? Both are supported by the pipeline. **Recommended: make `earl_sit_idle_01` in both and decide from the lineup next to v1 at 64/96/256. If you want a default without looking: `v1-faithful`, the literal reading of "original style".** **Answered: confirmed as planned.** The gate stays: make `earl_sit_idle_01` in both style profiles and pick from the lineup next to v1 at 64/96/256; no other masters until then.
3. **Default size (D4).** 96 px, or v1's 64 px? **Recommended: 96**, with the slider going to 256. **Status: accepted default (Cameron can override).**
4. **Personality sliders (D5).** Expose the six personality sliders to Juliette in Settings, or keep them in dev tuning only? **Recommended: expose them**, with a "Reset to Earl" button. **Status: accepted default (Cameron can override).**
5. **Typing honk (D26).** Is it OK to use a Raw Input keyboard counter (counts key presses only, never which key, only while that chaos option is on, at most 3 honks an hour)? The coarse alternative misfires on scrolling. **Recommended: yes**, disclosed in About. **Answered: yes, capped at about 3 honks per hour, counting key-downs only, never key identity, and only while the option is on** (D26, 4.8).
6. **Items in fullscreen (D6).** Hide placed items during fullscreen video, or keep them visible but click-through? **Recommended: hide** (Earl alone stays at the bottom, display-only until hovered for 600 ms). **Status: accepted default (Cameron can override).** Revision 3 adds a `stayWithItems` value to the same control for anyone who wants the toys kept, display-only (D6, D35).
7. **v1 migration (D29).** Which v1 installer did Juliette use (setup exe or MSI)? If a v1 config is found, v2 carries over her stats and the "together since" date and greets her with a reunion instead of a first meeting. **Recommended: carry over, with the reunion.** **Status: accepted default (Cameron can override).**
8. **Updater key.** Is the updater signing private key backed up somewhere other than GitHub secrets? Losing it blocks all future updates. **Recommended: back it up to the vault before M1.8**, and create a separate preview keypair. **Status: accepted default (Cameron can override).**
9. **Code signing - check needed.** On Juliette's PC, what does Windows Security > App & browser control > Smart App Control say? If On or Evaluation, unsigned installers are blocked outright and Azure Trusted Signing (about $10/month, individual or Threx AI) is required. **Recommended: check before M0.2 finishes; sign if SAC is On or Evaluation, otherwise ship unsigned (one SmartScreen "Run anyway").** **Answered (2026-09-29): "Assume default security settings."** A fresh Windows 11 install ships with Smart App Control in Evaluation mode, which can block unsigned installers, so v2 is signed: Azure Trusted Signing in CI (M0.2), and W1 runs on a clean VM with SAC On.
10. **Server tools and stray copies (D34).** Is it OK to install clippy, rustfmt, the Windows MSVC target, cargo-xwin and clang/lld/llvm, and for you to move `~/mini earl/`, `"~/mini earl /"` and `~/Downloads/earl-project.zip` to `~/archive/earl-strays-2026-03/` after the art-pipeline section is copied out? **Recommended: yes.** **Stray copies answered (2026-09-29): do not delete or move them, just consolidate.** Their only unique content (the original Art Pipeline section, the birthday snippet and the v1 notes for Claude Code) is now an appendix of `docs/SPEC.md`; the three copies stay where they are and are never a source of truth. **Server tools: still OPEN** (clippy, rustfmt, MSVC target, cargo-xwin, clang/lld/llvm install waits for Cameron's OK; the Windows CI job covers the cross-checks meanwhile).
11. **New dev dependencies (D33).** Is it OK to add vitest, fast-check, Playwright, ESLint and Prettier, `ts-rs`, the Tauri plugins listed, and the CI-only `cargo-audit` and Dependabot? (`arc-swap`, `parking_lot` and `crossbeam-channel` were dropped.) **Recommended: yes.** **Status: accepted default (Cameron can override).**
12. **Toolbox hotkey (D8).** Is `Ctrl+Alt+Shift+D` OK? **Recommended: yes** (configurable, with conflict detection). **Status: accepted default (Cameron can override).**
13. **Birthdays.** Confirm 4/4 (Juliette) and 6/23 (Cam), and the special lines. **Recommended: as written in 6.13.** **Status: accepted default (Cameron can override).**
14. **Target date.** Is there a date v2 should be in Juliette's hands (for example, a birthday)? **Recommended: no hard date.** **Answered: no hard date.** Every milestone ships as a preview build to Cameron; the release to Juliette waits for P0+P1 art (M6).
15. **Screen-share privacy (4.1).** Should Earl be hidden from screen shares and screenshots by default, so he never shows up in her meetings? **Recommended: off by default** (so she can screenshot him), with the toggle in General and the cursor gag always suppressed while a meeting app is foreground. **Status: accepted default (Cameron can override).**

---

## Appendix A. Rejected or partly rejected critiques

Every other blocker and major issue from the four reviews is fixed in the sections cited in the revision note at the top. These are the points not taken, or taken in a different form, with the reason.

| Critique | Decision | Reason |
|---|---|---|
| alive (blocker), fix 5: "full-body-visible time at least 55% of awake time" | Revision 2: partly rejected, replaced by "expressive visibility (not behind, or sink ≤ 0.35) ≥ 55%" and "head-only ≤ 35%". **Revision 3: now exceeded.** With the on-top home (default `sometimes`, D1) the gated headline is full-body ≥ 75%, expressive ≥ 85% and head-only ≤ 12% at defaults, plus ≥ 2 behind visits per awake hour; the 55% / 35% pair is kept only as the floor for the `always` level (5.6 per-level table, 12.6) | Revision 2 read the relayed request as making behind the taskbar his home, so a strict full-body metric would have contradicted the `always` default. Cameron's Q1 answer puts his home on top of the taskbar, so a full-body metric now fits the default and is stricter than the critique asked for. The wade depth still keeps `mostly` and `always` expressive. |
| alive (blocker), fix 4: scale rest_behind to `0.3·behindShare·(...)` | Taken, but the behind share is enforced by the lane, not by rest_behind alone | At `mostly` and `always` (behind the taskbar as home), most behaviors run there at wade depth; at the default `sometimes` the share comes from scored visits (5.6). Either way rest_behind only covers chin-on-edge resting, so scaling it down is right but does not by itself set the behind share. |
| coverage: add earl_peek_side (R, P1) | Merged into `earl_peek_look` (R, P0) | One side-looking ledge frame serves both periscoping and looking around; wading now uses the real walk cycle, so a second side peek adds little. |
| alive: earl_stand_blink at P0 | Set to P1 | The procedural eyelid (5.12) makes every frame with eyes blink from day one; a drawn stand blink is a polish item. `earl_peek_blink` stays P0 because the peek is his chin-on-edge rest on every visit behind the taskbar, which the default `sometimes` still includes (revision 3). |
| engineering: consider Git LFS for `art/masters` | Rejected | About 133 masters at 512 px is tens of MB, well within a normal repo; LFS adds a GitHub bandwidth quota and a tool dependency for every worktree. `.gitattributes` marks PNG as binary. |
| engineering: tauri-specta or a commands manifest | Took the manifest (option b) | It needs no new app dependency (tauri-specta for Tauri v2 is still a release candidate), and the same manifest drives the mock types and the capability test. |
| engineering: move sandbox replay to M3 with fake windows | Partly rejected; only fake windows move (M3.1b) | JSONL replay is part of Cameron's Windows dev loop from M1.10 on (12.7), so it stays in M1.6. |
| engineering: "drop the 60 fps cap and only skip unchanged transform writes" (alternative) | Took the frame-pacing option instead, plus the skip | Pacing keeps high-refresh laptops from doing twice the sim-to-render work with no visible gain, and the unchanged-position skip is applied as well. |
| windows (minor): optional `general.fullscreen = hide` per fullscreen kind | Rejected | The single enum plus "Hide in exclusive games and slideshows" plus display-only hover-to-arm covers the real cases; a per-kind matrix is setting noise for a gift. |
| coverage: allow small items on perches while Earl carries them (alternative to the stash) | Rejected in favour of the stash | The stash makes item_steal a hoard he guards and a callback target, and keeps the "items are floor-only" rule simple. "Kicks things off windows" is dropped. |
| coverage: M2 temporary panel feed/play button (alternative) | Rejected in favour of the "arrives with the toolbox" label | A throwaway control would need tests and removal; foraging plus the label keeps preview builds honest without it. |
| windows: write 0x02 plus 11 zero bytes into StartupApproved (alternative) | Took "delete the value" | Deleting the entry is the documented neutral state and does not depend on the blob format. |

# Earl v2 roadmap

The milestone plan is section 13 of [`V2_PLAN.md`](V2_PLAN.md); this file tracks where each work
unit stands. Update a unit's row in the same PR that changes its state.

**Status values:** `planned`, `in progress`, `in review` (PR open), `merged` (in `v2`). Once M2.6
lands, CI reads this table: a unit marked `merged` must not leave any `test.fails` tagged with its
id (plan 12.2). Keep the first three columns in this exact shape.

**Release:** no hard date (Q14). Each milestone ships as a `v2-preview` build to Cameron; the
release to Juliette waits for P0 and P1 art to be final (M5.3), then M6.

## M0 Foundation cleanup (no behavior change; CI green; the platform spike decides the risky choices)

| Unit | Title | Status | Notes |
|---|---|---|---|
| M0.0 | Branch setup (main session, alone) | merged | on `v2` (M0.0 commit `cd36674`) |
| M0.1 | JS tooling and web CI | merged | PR #1 |
| M0.2 | Rust tooling, icons, config, signing | merged | PR #2 |
| M0.3 | Docs and art pipeline | merged | PR #3 |
| M0.4 | Windows platform spike (one worker, throwaway branch `spike/overlay`) | in progress | branch `spike/overlay` (throwaway; result goes into D13 and D14) |

## M1 First playable v2 (new engine, the taskbar request, working settings, updater prompt)

| Unit | Title | Status | Notes |
|---|---|---|---|
| M1.0 | Contracts (alone) | planned |  |
| M1.S | Walking skeleton (one worker, before the fan-out) | planned |  |
| M1.1 | Windows platform core | planned |  |
| M1.2 | Settings, state, tray, panels plumbing | planned |  |
| M1.3 | Sim core and physics | planned |  |
| M1.4 | Overlay shell, renderer, animation, audio base | planned |  |
| M1.5 | Brain skeleton and first behaviors | planned |  |
| M1.6 | Sandbox, e2e harness, metrics | planned |  |
| M1.7 | Panel window (Settings and About) | planned |  |
| M1.8 | Updater | planned |  |
| M1.9 | Parachute | planned |  |
| M1.10 | Integration (alone) | planned |  |

## M2 Personality (the "not a robot" metrics pass; both mood modes)

| Unit | Title | Status | Notes |
|---|---|---|---|
| M2.0 | Contracts (alone) | planned |  |
| M2.6 | Scenario suite and baselines (merged first) | planned |  |
| M2.1 | Needs and mood modes | planned |  |
| M2.2 | Relationship, memory and arcs | planned |  |
| M2.3 | Behavior catalogue (non-item, non-chaos) and the new brain systems | planned |  |
| M2.4 | Procedural motion and fx | planned |  |
| M2.5 | Voice and variation | planned |  |
| M2.7 | Needs HUD and Mood tab | planned |  |

## M3 World (toolbox, persistent items, window perching)

| Unit | Title | Status | Notes |
|---|---|---|---|
| M3.0 | Contracts (alone) | planned |  |
| M3.1 | Item framework and toolbox | planned |  |
| M3.1b | Sandbox fake windows | planned |  |
| M3.2 | Items A: trampoline, bed, bread, seeds, and the stash | planned |  |
| M3.3 | Items B: tub, ball, rubber duck | planned |  |
| M3.4 | Items C: fan and umbrella | planned |  |
| M3.5 | Window surfaces (Rust) | planned |  |
| M3.6 | Perching sim and behaviors | planned |  |

## M4 Chaos (one master switch, four independent subs)

| Unit | Title | Status | Notes |
|---|---|---|---|
| M4.0 | Contracts (alone) | planned |  |
| M4.1 | Wild Earl | planned |  |
| M4.2 | Messes (brain side) | planned |  |
| M4.3 | Messes (platform side) | planned |  |
| M4.4 | Duck swarm | planned |  |
| M4.5 | Physics party | planned |  |

## M5 Art and polish (continuous from M0; its exit gates M6)

| Unit | Title | Status | Notes |
|---|---|---|---|
| M5.1 | Art batch ingest (repeatable, one per batch Cameron delivers) | planned |  |
| M5.2 | Icons | planned |  |
| M5.3 | Polish and performance pass | planned |  |

## M6 Release

| Unit | Title | Status | Notes |
|---|---|---|---|
| M6.1 | Release candidate | planned |  |
| M6.2 | Ship | planned |  |

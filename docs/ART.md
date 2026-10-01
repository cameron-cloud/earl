# Earl art pipeline

How Earl's art gets from an image generator into the game. What to draw (the style guide, the
135-image shot list and the prompt templates) is in [`ART_SHOTLIST.md`](ART_SHOTLIST.md); this
file is about the tooling. The design is plan sections 5.10-5.11 and decisions D19-D20 in
[`V2_PLAN.md`](V2_PLAN.md).

## At a glance

```
art/inbox/<shot>_<nn>.png   raw exports on flat #FF00FF (gitignored)
        |  npm run art:import [--inbox <dir>] [--profile v1-faithful|smooth]
        v
art/masters/<frame>.png     512 px masters, keyed and aligned (committed)
        |  npm run art:build   (also runs before dev, build and typecheck)
        v
src/assets/atlas/<page>_<256|512>.png   atlas pages (generated, gitignored)
src/sim/anim/sprites.gen.ts             frame table for the game (generated, gitignored)
art/out/contact.png                     contact sheet for review (generated, gitignored)
```

Frames with no master yet fall back to a **placeholder**: the matching v1 sprite from
`art/reference/v1/`, keyed and aligned by the same code and scaled 2x nearest-neighbour. The
game never waits on art (plan principle 7). An `ovl` placeholder is lined up with its base only
when the v1 drawing really is an edit of it (silhouette overlap 97% or more, as for blink); v1
pouty and huffy are separate drawings, so they take their base's `gnd` rule instead and keep
their feet on the ground line (they still WARN `ovl_moved`, which is true of that v1 art).

## Commands

All commands take `--root <dir>` (default: the repo root).

| Command | What it does |
|---|---|
| `npm run art:import` | Reads the inbox, keys and aligns every recognised image, writes masters to `art/masters/`, then rebuilds atlases, `sprites.gen.ts` and the contact sheet. Prints a status line per frame it touched. |
| `npm run art:build` | Regenerates atlases and `sprites.gen.ts` from masters plus placeholders. Runs automatically as `predev`, `prebuild` and `pretypecheck`, so a fresh clone builds without a manual step. |
| `npm run art:check` | Everything `art:build` checks, plus the project checks below, and writes the contact sheet. Exits non-zero on any ERR. CI runs it. |
| `npm run art:status` | Per tier, per shot, per frame status with lint codes, then the coverage report. |
| `npm run art:shots` | Regenerates `art/shots.json` and `art/SHOTLIST.md` from `docs/ART_SHOTLIST.md`. Run it after editing the shot list; `art:check` and a unit test fail while either file is stale. |
| `npm run art:templates` | Writes framing templates (safe area, baseline, anchor) per canvas to `art/templates/` (gitignored), for image-to-image prompts. |

## The inbox

- Default: `art/inbox/`. In the main checkout on the server this is a symlink to
  `/mnt/HC_Volume_106939637/earl/art-inbox`, where Cameron's exports land. Any other folder
  works with `--inbox <path>`.
- A missing or empty inbox is not an error: the importer says so and exits 0.
- **After import:** every raw that imported cleanly, plus any older takes of the same frame,
  moves to `<inbox>/imported/` (nothing is deleted; a name clash gets a `__2` suffix). This stops
  the next run from redoing it and silently overwriting a master in `art/masters/` that was
  cleaned up by hand. A raw that failed stays in the inbox so it can be fixed and re-run. To
  re-import on purpose (say after the Q2 style pick), move the raws back, or point `--inbox` at
  `imported/` and add `--keep`, which leaves files where they are.
- **Naming:** `<shot>_<nn>.png` in lowercase snake_case, exactly as in the shot list
  (`earl_peek_01.png`). A strip can be saved as `<shot>.png` (`earl_walk.png`); it is split on the
  magenta gaps and it is an error if the frame count does not match the shot list. Anything after
  a double underscore is ignored (`earl_peek_01__take2.png`); when several takes of one frame are
  present, the **newest file wins** and the others are listed as ignored.
- **Format:** PNG or WebP at 1024 px or larger on flat #FF00FF. JPG is accepted with a warning
  (lossy edges key worse). A painted checkerboard or any non-magenta background is rejected with
  "regenerate on #FF00FF".
- Files that match no shot or frame id are skipped with a warning.

## Style profiles (plan D20, Q2)

`art/shots.json` has a top-level `profile`, which stays `null` until Cameron picks a style from the
`earl_sit_idle_01` lineup (Q2). Until then `art:import` refuses to run unless `--profile` is given.

| Profile | Keying | Edges |
|---|---|---|
| `v1-faithful` | Soft key, then a hard alpha threshold, so edges stay crisp like v1 | Hard edges are expected and never flagged |
| `smooth` | Soft key with anti-aliased alpha kept | WARN `hard_edges` when more than 90% of the rim is hard |

Placeholders are always keyed as `v1-faithful`. `art:check` fails if masters exist while no
profile is set.

## How a raw image becomes a master

1. **Background check.** The border is sampled; a checkerboard or a background that is not close
   to #FF00FF is rejected before anything else runs.
2. **Soft key with despill.** Each pixel's distance from magenta in the CbCr chroma plane gives a
   soft alpha. Edge pixels are unmixed (the magenta share is subtracted from the colour), then
   despilled so no pink or purple cast survives. Shots marked `fringy` in `shots.json` get one
   extra pixel of edge erosion.
3. **Framing.** A square raw maps to the shot canvas at the master scale (ducks: a 1024 raw ->
   512 master = the 256 canvas at 2x; props: the raw square maps to the larger side of the prop
   canvas). `icon_app` and `icon_tray` are 1024 masters at scale 1 and are not in any atlas.
   A strip is scaled once for all its frames, so they keep their sizes relative to each other.
   When its frames derive from a master outside the strip (`earl_run` on `earl_walk_02`), the
   tallest frame is matched to that master's height, so that master must already be imported or
   be in the same inbox (strips import in shot-list order, after single frames). Any other strip
   (`earl_walk` and most prop strips have no base; `prop_fan`'s base is its own first frame) is
   scaled like a single raw: each evenly spaced cell, raw width / frames by raw height, fills the
   canvas, so a 3072x1024 three-frame strip gives the same size as three 1024 raws.
4. **Alignment** follows the anchor rules of ART_SHOTLIST section 3 at every level:
   - `gnd`: lowest opaque row on y=240 (512 level: 480), horizontally centred on the eye midpoint
     when two eyes are found, else on the body;
   - `ovl`: expression overlays are aligned to their base frame, and lint warns if the body moved;
   - `hang`, `ledge`, `free` and prop anchors keep their own rules (ledge frames keep their source
     vertical position, see Known limits).
5. **Export levels.** Each frame exists at two levels: 256 (the canvas, used at display sizes up
   to 128 px) and 512 (used above that, for W8 sharpness at size 256 on high DPI).

## Status and lint (per frame)

Every frame gets one status:

| Status | Meaning |
|---|---|
| `MISSING` | No master and no placeholder. The game resolves it through the fallback chain. |
| `PLACEHOLDER` | v1 art stands in. Its lint is shown as information and never fails `art:check`. |
| `OK` | A master with no issues. |
| `WARN` | A master with warnings only. Review them on the contact sheet. |
| `ERR` | A master with at least one error. Regenerate it. |
| `FINAL` (coverage only) | A master that is approved and not `ERR`. |

Lint codes (ART_SHOTLIST section 7, step 6):

| Level | Code | Check |
|---|---|---|
| ERR | `empty` | Nothing left after keying |
| ERR | `safe_area` | Duck bbox outside x 8-247, y 4-251 of the 256 canvas |
| ERR | `baseline` | `gnd` frame whose lowest row is not y=240 (1 px tolerance) |
| ERR | `magenta` | Leftover magenta, or a pink or purple fringe on the edge |
| ERR | `holes` | See-through holes of 2 px or more (the April eye-hole defect) |
| ERR | `dark_rim` | Dark or neutral-grey rim on more than 30% of the edge of an `earl_*` or `baby_*` frame (the April defect). Rim pixel dark: luma < 80; grey: saturation < 20 and luma < 200. v1 originals measure about 13%, the April tumble 85%. |
| ERR | `prop_attach` | A prop without its required attach lines set |
| ERR | `prop_size` | A prop footprint more than 15% off its target width |
| WARN | `hard_edges` | Hard, non-anti-aliased edges (smooth profile only) |
| WARN | `eye_size` | Front `earl_*` eyes not 22 +-2 px |
| WARN | `body_colour` | Dominant colour more than 5 dE from #F8E9C7 (`earl_*` only; baby is butter-yellow) |
| WARN | `ovl_moved` | An expression overlay moved the body (silhouette overlap below 97%) |
| WARN | `head_width` | Head width more than 6% off the reference of the same view: front frames against `earl_sit_idle_01`, side and three-quarter frames against `earl_walk_02` |

**Per-shot overrides** live in the shot's `lint` field in `art/shots.json`:
`{"headWidthTolerance": 0.15}` for shots that deform on purpose (puffed_up, plop, land_squish,
stretch, startle) and `{"skip": ["holes"]}` for the fan (its guard is see-through by design).

## Coverage report

`art:status`, `art:check` and `art:import` end with the coverage report, for example:

```
Coverage: final 0/135, placeholder 21 (masters 0, missing 114)
  P0: final 0/63, master 0, placeholder 21, missing 42
  P1: final 0/61, master 0, placeholder 0, missing 61
  P2: final 0/11, master 0, placeholder 0, missing 11
```

135 is the number of images (frames) in the shot list, spread over 101 shots (the held up and down poses were restored on 2026-09-30). The 21 placeholders
are the v1 sprites that map onto a v2 frame; the rows of ART_SHOTLIST section 6.10 that pointed
at v1's missing files have no placeholder. v1's `sprites.json` names six held poses, but only `Picked_up.png` shipped; the other five (`drag_left`, `drag_right`, `drag_up`, `drag_down`, `drag_fast`) fall back to it in `src/engine/animator.ts`.

## Contact sheet

`art/out/contact.png` (gitignored), written by `art:check` and `art:import`. It shows every
frame on the dark (#202020) and light (#F3F3F3) Win11 taskbar greys with the y=240 baseline, the
anchor cross, the bounding box, the detected eyes, the ledge line where there is one, and a status
label with the tier and every lint code (wrapped over as many lines as it needs), plus a size
ladder of `earl_sit_idle_01` at 48/64/96/128/256. CI uploads it as the `art-contact-sheet`
artifact of the `web` job.

## Approving

Approval is by frame: add the frame number (`"01"`) to the shot's `approved` array in
`art/shots.json`. Only an approved, non-ERR master counts as final. Approvals are owned by the
M5.1 ingest runs (plan section 13, hot files).

## `art/shots.json`

Generated from `docs/ART_SHOTLIST.md` by `npm run art:shots`, so the shot list stays the single
source. A few fields are **hand-kept** and survive regeneration: `approved`, `attach`, `lint`,
`fringy`, `fallback`, `proc`, `pose` (delete a field to get its default back). Everything else
(id, tier, canvas, anchors, templates, placeholders, prompts) is regenerated. The file is
machine-written JSON and is excluded from Prettier on purpose.

`art/SHOTLIST.md` is the generated, per-shot view of the same data with every prompt fully
expanded (templates filled in), ready to paste into a generator.

## `sprites.gen.ts`

Generated by `art:build`, never committed (D19). It exports:

- `FrameId`: a union of all 135 frame ids, so a reference to a frame that does not exist is a type
  error (this fixes v1's 12 dangling references, plan bug #28). A missing frame still resolves at
  runtime through its fallback chain.
- `FRAMES`: per frame its atlas page and rect at each level, trim offset, canvas size, anchor
  point and type, facing, mirror flag, pose, eyes, head, `hang` wing-tip attach points, `ledgeY`,
  a 64x64 hit mask (base64), the fallback chain and procedural tags.
- `PROPS` (footprints and attach lines), `ATLAS` (page URLs via `new URL(..., import.meta.url)`)
  and `ART_COVERAGE`.

Atlas pages: `core` (earl P0), `duck2` (other earl), `baby`, `props` (`prop_*`, `acc_*`) and `ui`
(`icon_toolbox`). Files are `src/assets/atlas/<page>_<256|512>.png`, with trimmed rects, 2 px
padding and deterministic shelf packing. Empty pages are not written.

## Known limits

- The peek check "wing tips more than 2 source px below the ledge line" is not implemented yet: it
  needs the ledge line clicked in the lineup view.
- Ledge frames keep their source vertical position rather than being snapped to a ledge line.
- Prop attach lines that have not been clicked yet are estimated from the bounding box; a
  non-placeholder prop without clicked lines is an ERR (`prop_attach`).
- The contact sheet is a still image: animated previews and the live `/?lineup` browser view
  arrive with a later unit.
- WebP and JPG inbox files are decoded with `sharp` (already a dev dependency, loaded only for
  non-PNG files); everything else uses `pngjs`.

## Tests

`test/art/art.test.ts` (vitest, a few seconds): the soft keyer against a golden image of a
synthetic anti-aliased circle (`test/fixtures/art/keyer-circle.golden.png`; regenerate with
`UPDATE_GOLDEN=1 npx vitest run test/art`), the magenta-fringe check, checkerboard rejection, the
eye-hole check, the dark and grey rim ERR, alignment, an import of a synthetic raw through a temp
inbox (missing inbox, empty inbox, unknown file, a `__take` suffix), the coverage line, and that
`art/SHOTLIST.md` matches `ART_SHOTLIST.md`.

## History: the original March 2026 art plan

This section was recovered from the unpacked starter copies (`~/mini earl /earl-project/`,
`~/Downloads/earl-project.zip`) and never made it into git before. It is kept for history; the
current workflow is the one above and in `ART_SHOTLIST.md`.

### Art Pipeline (AI-Generated)
Art will be generated using free AI tools and cleaned up manually:

1. **Google AI Studio (Nano Banana / Gemini 2.5 Flash Image)** - generate Earl's character design and poses using the plush reference photos as input. Free tier allows 500-1000 images/day.
2. **PixelLab AI** - generate sprite animation frames and directional variants from the established character design. Specialized for game-ready pixel art.
3. **PixelBox by LlamaGen** - convert static poses into animated sprite sheets automatically.
4. **Piskel / Libresprite** - manual cleanup, frame alignment, color consistency, final sprite sheet export.

# Earl v2 - Art Work Order

Cameron, this is the complete list of art for v2. You make every image with AI image tools; the build handles everything else (background removal, alignment, sizing, mirroring, icons, atlases). Until an image arrives, the game uses a placeholder, so you can work in any order. Still, please do **P0 first**. There is no hard date (plan Q14): each milestone ships to you as a preview build, and the release to Juliette waits until P0 and P1 art are final.

**Before anything else: pick the style (plan Q2, confirmed: the gate stays as planned).** Make `earl_sit_idle_01` in both style profiles (section 1), compare them in the lineup next to v1 at 64/96/256, and tell us which one. No other masters are made until you pick, and the 4 masters are approved next to v1 before Batch A continues.

**Total: 135 images** (P0: 63, P1: 61, P2: 11). The counts are summarised in section 8.

---

## 1. What changed from v1, and why

These measurements come from the current files:

- **The originals have no dark outline.** Their edge is a warm tan rim (#E0BF8A / #DFBC8F / #CCA982).
- **The 8 April sprites are off-style:**
  - They have a 1 px near-black outline (#777879-#7C7E7E) with a light grey halo outside it (#B7B7B7-#D6D6D6).
  - They sit on a different ground line (y=121/122 instead of 118; `puffed_up` touches 127).
  - They are drawn bigger (`puffed_up` is 104x121, against 77x106 for the originals).
  - They have see-through holes in the eye sparkles: 7 each in `pouty`, `huffy` and `dizzy`, 10 in `puffed_up`, 75 in `wall_bump`. The old import script deleted every near-white pixel.

  All 8 must be redrawn in the original style.
- **Hard edges.** All v1 alpha is hard 0/255, so edges are crisp and visibly stair-stepped at large sizes. That crispness is part of the original style.
- **Two style profiles; you choose (plan Q2, a hard gate, confirmed):**
  - **`v1-faithful`:** the originals' crisp look at 256: same shapes, palette, eyes and tan rims, hard edges (the pipeline thresholds alpha, no anti-aliasing). This is the literal reading of "original style".
  - **`smooth`:** the same duck as a smooth, anti-aliased plush illustration at 256, same rims, no pixel stair-steps.
  - Neither profile ever has dark outlines or a grey halo; those are the April defects.
  - The prompt templates below have a line per profile; use the one for the profile you picked.
- **Left-facing art is not needed.** Side poses are drawn facing right and the game flips them. The v1 `*_left` files were exact mirrors, so nothing is lost.
- **Effects are drawn by the game, never baked into the art.** No speed lines, Zzz, stars, drops, hearts, crumbs, shadows or parachute strings. v1's `run_step1` and `tumble` had motion lines baked in; the redraws must not.

---

## 2. Style guide

### Shape

- **Overall:** a plush toy duckling.
- **Head:** an oversized sphere, about 64% of total height and about 136 px wide on the 256 canvas.
- **Body:** chunky and pear-shaped, with a soft tan crease where the head meets the body.
- **Wings:** tiny rounded nubs at belly height, with one crease line.
- **Feet:**
  - Short, stubby, three-toed and webbed.
  - When he sits facing front, the soles face the viewer and the toe lines are dark.
- **Bill:** wide, flat, slightly upturned "smile", with a darker lower lip line.
- **Height:** about 212 px tall on the 256 canvas, sitting or standing. His legs are almost invisible.

### Edges

- **No dark outline anywhere.**
- Edges are a 2 px rim in a darker version of the local colour: tan on the body, dark orange on the bill and feet.
- Toward the top light, the rim fades to a lighter cream.

### Lighting

- One soft key light from straight above and in front.
- Soft cel shading in 3-4 tones.
- No texture, no dithering, no cast shadow (the game draws the ground shadow).

### Gloss

- A soft cream-white oval on top of the head.
- **Front views:** centred horizontally. (v1 had it right of centre; centring it lets front poses flip freely.)
- **Side views:** on the top-back of the head.

### Eyes

- Solid glossy black circles, 22 px across on the 256 canvas.
- One large white sparkle in the upper third and one tiny dim sparkle at the lower edge.
- Expression comes from lids, brows and eye shape, never from white around the pupil.

### Palette

| Role | Hex |
|---|---|
| Body base | #F8E9C7 |
| Body light | #FAECCC |
| Gloss / highlight | #FBF3DD |
| Shade 1 | #EDD4A7 |
| Shade 2 | #E5C69A |
| Deep shade / rim | #CCA982 |
| Rim on the lit side | #FFF0C0 |
| Bill/feet base | #EA8638 |
| Bill/feet light | #EE964A |
| Bill/feet shade | #C97F45 |
| Crease / toe line | #8A5333 |
| Eyes | #000000 |
| Eye sparkle | #FFFFFF |
| Blush (loving poses only) | #F0A08C at about 40% |

- The v1 side sprites drift yellower (#F6E7BA). Use the palette above everywhere; the pipeline warns when a frame drifts from it.

### Props

- The same soft shading and light as Earl.
- Rims in each object's own colour. No black lines.
- Muted-saturated colours.
- **Never pink, purple or magenta** anywhere (that is the key colour).
- Nothing intentionally semi-transparent. Water and fan blur are opaque; see-through effects are done in code.

---

## 3. Canvas, framing and anchors

**Duck frames**
- A 256x256 canvas at exactly 2x the v1 scale, so he looks the same size at every size setting.
- Feet on row **y=240**, body centred on **x=128**.
- The pipeline re-aligns everything, so close is fine, but consistent framing gives cleaner edits.

**Anchor types** (these are what the pipeline aligns to):

| Anchor | Used by | Rule on the 256 canvas |
|---|---|---|
| `gnd` (default) | Anything touching the ground | Lowest body row (alpha of 128 or more) at **y=240**. Front poses: halfway between the eyes (or the body centre when the eyes are closed) at **x=128**. Side and back poses: body centre at x=128. |
| `ovl:<base>` | Expression-only edits | Lined up with the base image (shift plus scale 0.94-1.06), so the body can't drift. |
| `ctr` | Tumble, flail, bounce | Body centre at (128,128). The game spins him around this point. |
| `grip` | Held poses | Top-centre of the head at (128,20). He dangles from the cursor here. |
| `hang` | Parachute and umbrella hang | Midpoint between the wing tips at (128,16). The wing tips are stored as attach points. |
| `ledge` | Peek poses (behind the taskbar) | Ledge line at **y=124**: chin resting on it, wing tips resting **on** the line (not hooked over it: anything below the line is always hidden by the taskbar). The game lines this up with the taskbar's top edge. |
| `wall` | Climb | Wall contact column at x=240, body centred at y=128. |

**Reference geometry: `earl_sit_idle_01` at 256**

| Feature | Position / size |
|---|---|
| Head top | y=29 |
| Eye centres | (99,96) and (161,96) |
| Eye size | 22 px across |
| Bill | x 110-148, y 101-121 |
| Overall width | 154 (x 51-205) |
| Feet bottom | y=240 |

**Safe area:** duck poses must fit inside x 8-247, y 4-251. Ground poses must not go below y=240.

**Babies and props:**
- Drawn at the **same world scale as Earl**; they do not fill their frame.
- Ground props use a W x H canvas (listed per item), with their ground line at H-16 and the anchor at x = W/2.
- **The drawn size is the real size.** The pipeline measures each prop and the game uses that measurement for collisions and footprints (plan 8.3), so the sizes given per prop are targets: stay within about 15% of them. Attach lines and points (`mat`, `mattress`, `waterline`, `hub`, `handle`, `hemL`/`hemR`) are clicked in the lineup tool and are required before a prop is approved.

**On and behind the taskbar:** Earl's home is standing on top of the taskbar (plan D1), so his ordinary `gnd` poses are what she sees most. Now and then he slips behind it to peek, sulk or nap. Peek poses are drawn as a **full body**. The game hides everything below the taskbar's top edge, so you never draw a cut-off duck. Even during those visits he is often not in a peek pose at all: the game plays his ordinary poses (walk, look, yawn, quack...) standing lower, with the taskbar hiding his feet and belly. The peek frames are only for resting his chin on the edge.

**Eyes matter:** the pipeline detects each frame's eyes. The game uses them to line up poses behind the taskbar and to draw a blink over any frame that has no drawn blink, so keep the eyes the standard solid black circles.

---

## 4. Mirroring rules

| Code | Meaning |
|---|---|
| **R** | Drawn facing right. The game flips it for left. |
| **F** | Front view with symmetric lighting. The game may flip it freely, including alternating frames of one action (tantrum stomps, shakes, splashes, wiggles). |
| **B** | Back view. Flipped freely. |
| **P** | Prop. Flipped freely. Layered props flip as a group (bed with blanket, tub back with tub front), and attach points flip too. |
| **I** | Icon. Never flipped. |

---

## 5. Generation workflow and prompt templates

**One tool:** Nano Banana (Gemini image, in Google AI Studio), used in **edit mode** for everything. Every new image is an edit of an approved master, which keeps the style, scale and position stable. Use Piskel, Libresprite, Krita or Photopea only to touch up raw images, never the processed output.

**Use the Pro model if AI Studio offers it** (Nano Banana Pro / Gemini 3 Pro Image). It accepts several reference images at once: attach the approved master, the closest existing pose, and the 4-master lineup sheet on every generation. More references means less drift. For cycle strips (walk, run, climb) ask for all frames side by side in ONE image; frames generated together match each other far better than frames generated separately, and the importer slices strips automatically.

**If drift gets bad past ~40 images:** the fallback is a small custom model (a LoRA on Flux) trained on 15-20 approved Earl images, with pose control. It takes an afternoon to set up; only worth it if edit mode stops holding the character.

**Background:** always a flat **#FF00FF magenta**. Do not ask for transparency; those "transparent" exports are usually a painted checkerboard, which the pipeline rejects.

### Order of work

1. Run `npm run art:templates`. It writes `art/templates/<shot>.png`: a 1024 magenta canvas with the v1 sprite at the right framing (8x) where one exists.
2. **Style decision:** make `earl_sit_idle_01` once per profile, run `npm run art:import`, and pick in `/?lineup` (plan Q2). Set the profile in `art/shots.json`.
3. **Make the four style masters first, in this order:**
   - `earl_sit_idle_01`
   - `earl_walk_02` (standing side view)
   - `earl_stand_front_01`
   - `earl_sit_side_01`

   Import them, check the contact sheet next to v1 at 64/96/256, and mark them approved. Every other duck image is an edit of one of these (see the Base column).
4. Generate the rest tier by tier, attaching the base image each time.

### STYLE LOCK (paste at the end of every duck prompt)

```
STYLE LOCK: Match the attached reference duck exactly - same character, proportions, colors, soft shading and eye style. Earl is a plush toy duckling: pale cream body (#F8E9C7), warm tan shading (#EDD4A7, #E5C69A), a slightly darker tan rim along his edges (#CCA982), a soft cream-white gloss oval centered on top of his head (#FBF3DD). Orange bill and feet (#EA8638, light #EE964A, shade #C97F45, crease lines #8A5333). Eyes are solid glossy black circles with one large white sparkle in the upper part and one tiny sparkle at the lower edge. Oversized round head (about 2/3 of his height), chunky pear-shaped body, tiny rounded wing nubs, short stubby three-toed webbed feet. Soft cel shading, light from straight above-front. NO black or dark outlines, no grey halo, no cast shadow, no texture, no dithering. <EDGES: v1-faithful = "crisp sprite edges like the reference, no soft blur" | smooth = "smooth clean anti-aliased edges">.
BACKGROUND: one flat, pure, uniform magenta #FF00FF filling the entire image edge to edge. No floor, shadow, gradient, vignette, border, text or watermark. No motion lines, stars, hearts, Zzz, sweat drops, sparkles or any effects.
FRAMING: square image, whole duck visible and not cropped, same size and same position on the canvas as the reference, feet on the same ground line.
```

### BABY STYLE LOCK (paste at the end of every baby_* prompt, instead of the STYLE LOCK)

The STYLE LOCK describes Earl's pale cream body, which contradicts the butter-yellow baby. Every `baby_*` prompt (T5, and T4 strips of babies) ends with this block instead.

```
BABY STYLE LOCK: Match the attached reference duck's art style exactly - same soft shading, eye style and feet - but NOT his body colour or size. This is Earl's baby sibling, a plush toy duckling: butter-yellow fluffy body (#FFE68A), warm yellow shading (#F2CF6A), a slightly darker yellow rim along its edges (#E0B94F), a soft pale-yellow gloss oval on top of its head (#FFF4C2), and a small tuft of three feathers on top of the head. NO pale cream or tan on the body. Orange bill and feet (#EA8638, light #EE964A, shade #C97F45, crease lines #8A5333). Eyes are solid glossy black circles with one large white sparkle in the upper part and one tiny sparkle at the lower edge. About half Earl's height, oversized round head (about 2/3 of its height) with slightly bigger eyes, round little body, tiny rounded wing nubs, short stubby three-toed webbed feet. Soft cel shading, light from straight above-front. NO black or dark outlines, no grey halo, no cast shadow, no texture, no dithering. <EDGES: v1-faithful = "crisp sprite edges like the reference, no soft blur" | smooth = "smooth clean anti-aliased edges">.
BACKGROUND: one flat, pure, uniform magenta #FF00FF filling the entire image edge to edge. No floor, shadow, gradient, vignette, border, text or watermark. No motion lines, stars, hearts, Zzz, sweat drops, sparkles or any effects.
FRAMING: square image, whole duck visible and not cropped, drawn small at the same world scale as the reference, feet on the same ground line.
```

### T1: Master or v1 redraw

Attach `art/templates/<shot>.png`. For the very first master, also attach photos of the real plush.

```
Redraw this duck sprite as a clean, high-resolution illustration. Keep the exact pose, facing, expression, size and position on the canvas: <POSE NOTE>. <EDGES: v1-faithful = "Keep the crisp sprite look, just at higher resolution" | smooth = "Replace the pixelated edges with smooth clean shapes">. Do not add anything.
<STYLE LOCK>
```

### T2: New pose

Attach the base master.

```
Edit this image. Keep the same duck, same size, same art style and colors, same magenta background. Change ONLY his pose to: <POSE>. Facing: <right | front | back>. Expression: <EXPRESSION>. Keep his feet on the same ground line and his body centered.
<STYLE LOCK>
```

### T3: Expression only (`ovl`)

Attach the base.

```
Edit this image. Change ONLY his face: <EYES / LIDS / BROWS / BILL>. Do not move, resize or redraw anything else - head outline, body, wings, feet, colors and background must stay identical.
```

### T4: Cycle strip (walk, run, climb)

Attach the master and ask for a wide 16:9 image. For a `baby_*` strip, end with `<BABY STYLE LOCK>` instead of `<STYLE LOCK>`. The generated prompts in `art/SHOTLIST.md` fill in `<N>` and one `Frame k` clause per frame.

Sizing: a strip based on a master outside the strip (`earl_run` on `earl_walk_02`, `baby_walk` on `baby_sit_01`, `prop_blanket` on `prop_bed_01`) is scaled so its tallest frame matches that master. A strip whose frames have no base outside the strip (`earl_walk`, `prop_bread`, and `prop_fan` and `prop_parachute`, whose later frames base their own earlier ones) is scaled the way a single raw is, one cell (raw width / frames by raw height) to the shot's canvas. In a 16:9 strip each cell is taller than wide, so the cell height sets the scale and the duck's size depends on how much of that height the generator filled. The generated strip prompts therefore swap the lock's square FRAMING line for a wide 16:9 one that asks for every figure to fill most of the frame height; compare `earl_walk_02` with `earl_sit_idle_01` on the contact sheet after import.

```
Make a horizontal sprite strip of <N> frames of this exact duck in one row, evenly spaced, clear magenta gaps between frames, every frame the same size and on the same ground line. Facing right. Frame 1: <...>. Frame 2: <...>. Frame 3: <...>.
<STYLE LOCK>
```

### T5: Baby duckling

Attach `earl_sit_idle_01`.

```
Draw Earl's baby sibling in the same art style: about half his height, brighter butter-yellow fluff (#FFE68A base, #F2CF6A shade), a three-feather tuft on top of the head, slightly bigger eyes relative to the head, a tiny bill, same eye style, same feet. Pose: <POSE>. Place it small on the canvas with its feet on the same ground line as the reference duck.
<BABY STYLE LOCK>
```

### T6: Prop

Attach `earl_sit_idle_01` as the style and scale reference.

```
Using the attached duck ONLY as a style and scale reference (do NOT draw the duck), draw <PROP> alone, centered, on a flat pure magenta #FF00FF background. View: <VIEW>. Size: <SIZE vs duck>. Colors: <PALETTE>. Same art style as the duck: soft cel shading, light from above-front, edges defined by a slightly darker rim of each object's own color, NO black outlines, no cast shadow, no text, no effects, nothing semi-transparent. Do not use any pink, purple or magenta in the object.
```

### T7: Prop state

Attach frame 01 of the prop.

```
Edit this image. Change ONLY: <STATE CHANGE>. Everything else identical - size, position, colors, background.
```

### T8: Icon

Attach `earl_sit_idle_01`.

```
App icon of this duck: <CROP>. Front view, centered, filling about 88% of a square canvas, flat magenta #FF00FF background. Same art style, BUT add a clean medium-brown rim (#9C7443) about 2% of the image width around the whole silhouette so it reads on light and dark taskbars. Bold simple shapes, oversized eyes and bill, no text.
```

---

## 6. Shot list

**How to read the table:**
- **Frames** is the number of images.
- **Files** are named `<shot>_<nn>.png`, for example `earl_walk_01.png`, `earl_walk_02.png`, `earl_walk_03.png`.
- **Base** is the image to attach.
- **T** is the prompt template.
- **Tier:** P0 = needed for the default experience (standing on the taskbar and the occasional slip behind it, basic moods, the first-meeting stare, sitting and standing up, looking around, night sleepiness, throwing, the parachute, petting, the needs loop, the birthday); P1 = the full v2; P2 = nice to have.
- **Numbers with a letter** (2a, 33a...) are shots added in revision 2; they sit next to the shot they belong with.
- A shot can have a different tier per frame (dizzy, parachute); `art:status` reports per frame.

### 6.1 Earl: core poses

| # | Shot | Facing | Frames | Depicts / key details | Base | T | Anchor | Tier |
|---|---|---|---|---|---|---|---|---|
| 1 | earl_sit_idle | F | 1 | Redraw of Earl_Front_Idle: sits facing front, soles forward, wing nubs down, neutral open eyes, closed bill smile. **Master #1.** | v1 + plush photos | T1 | gnd | P0 |
| 2 | earl_sit_blink | F | 1 | Eyes closed as soft downward arcs (redraw of Front_Blink). | sit_idle | T3 | ovl | P0 |
| 2a | earl_sit_quack | F | 1 | Neutral eyes, bill open mid-quack (the mouth frame for quacks and speech while he faces front). | sit_idle | T3 | ovl | P0 |
| 3 | earl_sit_side | R | 1 | Redraw of Idle_Side: sitting side view, feet poking forward. **Master #4.** | v1 | T1 | gnd | P0 |
| 4 | earl_sit_side_blink | R | 1 | Side view, eye closed as an arc. | sit_side | T3 | ovl | P1 |
| 5 | earl_stand_front | F | 1 | Standing front, feet under body, toes forward. **Master #3.** | sit_idle | T2 | gnd | P0 |
| 5a | earl_stand_blink | F | 1 | Standing front, eyes closed as soft arcs. (Until it exists the game draws a blink over the open eyes.) | stand_front | T3 | ovl | P1 |
| 6 | earl_walk | R | 3 | 01: near foot forward (Walk_step_1). 02: feet together, passing (walk_side), **Master #2**. 03: far foot forward (Walk_step_2). Bob and waddle rock are added in code. | v1 | T1/T4 | gnd | P0 |
| 7 | earl_run | R | 4 | Leaning forward 12°, wings flared back. 01: near foot reaching (run_step1 redraw, **no speed lines**). 02: airborne, feet tucked. 03: far foot reaching. 04: airborne, feet trailing. Also used for sprint, zoomies and chases. | walk_02 | T4 | gnd | P0 |
| 8 | earl_turn | 3/4 R | 1 | Three-quarter standing view, front-right, so he stops snapping between front and side. | stand_front | T2 | gnd | P1 |
| 9 | earl_sit_to_stand | F | 1 | Halfway up: bottom lifting, feet planted under him, wings out for balance. Played forward and reversed on every sit and stand. | sit_idle | T2 | gnd | P0 |
| 10 | earl_plop | F | 1 | Sit impact: body squashed about 10% shorter and wider, feet flung up, eyes squeezed. | sit_idle | T2 | gnd | P1 |
| 11 | earl_hop_squat | F | 1 | Redraw of Hop_Squat: crouched, ready to spring. | v1 | T1 | gnd | P0 |
| 12 | earl_hop_air | F | 1 | Redraw of Hop_Air: wings up, feet dangling, happy. | v1 | T1 | gnd | P0 |
| 13 | earl_land_squish | F | 1 | Redraw of dropped_squish: pancake, eyes wide, feet splayed. | v1 | T1 | gnd | P0 |
| 14 | earl_stretch | F | 1 | On tiptoes, wings high, body about 8% taller, eyes shut, bill slightly open. | stand_front | T2 | gnd | P1 |
| 15 | earl_yawn | F | 2 | 01: bill opening, eyes half shut. 02: bill wide open, eyes squeezed, wings lifted. | sit_idle | T2 | gnd | P1 |
| 16 | earl_tada | F | 1 | Standing proudly, wings flung wide, chest out, smug closed-eye smile ("ta-da"). | stand_front | T2 | gnd | P2 |

### 6.2 Earl: held, falling, crashing

| # | Shot | Facing | Frames | Depicts / key details | Base | T | Anchor | Tier |
|---|---|---|---|---|---|---|---|---|
| 17 | earl_held | F | 1 | Redraw of Picked_up: dangling by the scruff, big surprised eyes, feet hanging, wings slightly out. | v1 | T1 | grip | P0 |
| 18 | earl_held_grumpy | F | 1 | Same pose, flat unimpressed lids, pouting bill. | held | T3 | ovl | P1 |
| 19 | earl_held_side | R | 1 | Dragged sideways fast: body trailing, feet and wings streaming back, eyes squeezed, bill open. | held | T2 | grip | P1 |
| 19a | earl_held_up | F | 1 | Lifted fast upward (v1's drag_up pose; v1 never shipped the file): body stretched long below the grip, feet dangling straight down, wings pressed to his sides, eyes wide, bill pressed shut. | held | T2 | grip | P1 |
| 19b | earl_held_down | F | 1 | Pulled fast downward (v1's drag_down pose; v1 never shipped the file): body squashed up toward the grip, feet tucked up, wings flared out for balance, eyes squeezed, bill open. | held | T2 | grip | P1 |
| 20 | earl_flail | F | 2 | Panic: wings up (01) and down (02), feet kicking, bill open, eyes wide. Free fall, throws, falling off windows. | held | T2 | ctr | P0 |
| 21 | earl_tumble | F | 1 | Curled into a ball, eyes squeezed, feet tucked; the game spins it. Redraw of tumble **without motion lines**. | held | T2 | ctr | P0 |
| 22 | earl_wall_bump | R | 1 | April redraw as a side view: hits a wall at the right edge face-first, bill and face flattened, body squashed sideways, eyes squeezed. | walk_02 | T2 | gnd | P0 |
| 23 | earl_dizzy | F | 2 | April redraw. 01: sitting lopsided, spiral eyes, slack bill. 02 (P2 frame): spirals turned 90° so the spin animates. Stars are drawn in code. | sit_idle (02: dizzy_01) | 01 T2, 02 T3 | 01 gnd, 02 ovl | 01 P0, 02 P2 |

### 6.3 Earl: moods and expressions

| # | Shot | Facing | Frames | Depicts / key details | Base | T | Anchor | Tier |
|---|---|---|---|---|---|---|---|---|
| 24 | earl_sit_pouty | F | 1 | April redraw: lower bill pushed out, brows tilted up at the middle, glossy eyes. | sit_idle | T3 | ovl | P0 |
| 25 | earl_sit_huffy | F | 1 | April redraw: heavy flat lids, brows angled down, bill clamped shut. | sit_idle | T3 | ovl | P0 |
| 26 | earl_puffed_up | F | 1 | April redraw: standing, every feather fluffed (bumpy fuzzy silhouette about 12% wider), angry brows, wings out. Also the fluffy look after a bath shake. | stand_front | T2 | gnd | P0 |
| 27 | earl_tantrum | F | 1 | April redraw: standing, one foot raised to stomp, wings flailing down, eyes squeezed, bill wide open squawking. Mirrored for the other foot. | stand_front | T2 | gnd | P0 |
| 28 | earl_tilt | F | 1 | Curious head tilt about 18° to his left, eyes extra glossy, bill slightly open. | sit_idle | T2 | ovl | P0 |
| 29 | earl_petted | F | 1 | Happy closed-eye arcs, head pressed down into the hand, blush, wings relaxed out. | sit_idle | T2 | ovl | P0 |
| 30 | earl_petted_grumpy | F | 1 | Eyes closed but brows flat, pouting bill, faint blush ("fine. you may."). | sit_idle | T3 | ovl | P0 |
| 31 | earl_sit_sleepy | F | 1 | Drowsy: lids half closed and heavy, head drooping slightly, bill relaxed. His resting look every night. | sit_idle | T2 | ovl | P0 |
| 32 | earl_sit_happy | F | 1 | Content: eyes open and bright, a wider bill smile, faint blush. | sit_idle | T3 | ovl | P1 |
| 33 | earl_look | F | 1 | Sitting, head turned three-quarters to the viewer's right, looking off-screen. Mirrored to look left. | sit_idle | T2 | ovl | P0 |
| 33a | earl_stand_look | R | 1 | Standing side view, head turned back over his shoulder toward the viewer (the "turn-back" look while walking, investigating or being chased). | walk_02 | T2 | gnd | P0 |
| 34 | earl_look_up | F | 1 | Sitting, head tipped back, looking up at a window top or a parachute. | sit_idle | T2 | ovl | P0 |
| 34a | earl_stand_look_up | R | 1 | Standing side view, head tipped back looking up (before jumping to a window, while eating). | walk_02 | T2 | gnd | P1 |
| 35 | earl_stare | F | 1 | Deadpan half-lidded stare straight at you, flat bill. His first reaction to a stranger's click. | sit_idle | T3 | ovl | P0 |
| 36 | earl_side_eye | F | 1 | Jealous side-eye: head turned 15°, heavy lids, eyes pushed to one side, pout. | sit_idle | T2 | ovl | P1 |
| 37 | earl_sad | F | 1 | Droopy head, big wet eyes (bigger sparkles, one tiny tear), bill down, wings limp. | sit_idle | T2 | ovl | P1 |
| 38 | earl_angry | F | 1 | Standing and squawking: bill wide, sharp brows, wings raised like tiny fists. | stand_front | T2 | gnd | P1 |
| 39 | earl_startle | F | 1 | Jump-scare: feathers bristled, eyes wide, both wings flung up, feet just off the ground. | stand_front | T2 | gnd | P1 |
| 40 | earl_wiggle | F | 1 | Happy closed-eye arcs, open-bill smile, blush, wings out, leaning to one side. Mirrored on alternate frames. | stand_front | T2 | gnd | P1 |
| 41 | earl_sulk | B | 1 | Back view, sitting, head down, slumped, small tail tuft. Turned away from you. | sit_idle | T2 | gnd | P0 |

### 6.4 Earl: fidgets and habits

| # | Shot | Facing | Frames | Depicts / key details | Base | T | Anchor | Tier |
|---|---|---|---|---|---|---|---|---|
| 42 | earl_sneeze | F | 2 | 01 wind-up: head back, eyes squinting, bill parted. 02: head snapped forward and down, eyes shut, bill open. | sit_idle | T2 | ovl | P1 |
| 43 | earl_preen | R | 2 | Sitting side view, head twisted back into the wing feathers. 02: tugging, one feather tuft sticking up. | sit_side | T2 | gnd | P1 |
| 44 | earl_scratch | R | 2 | Sitting side view, one foot raised scratching his cheek, blissful shut eyes. 01 foot up, 02 foot lower. | sit_side | T2 | gnd | P2 |
| 45 | earl_honk | R | 2 | 01 wind-up: neck pulled back, chest puffed. 02: neck thrust forward, bill wide, eyes shut. | walk_02 | T2 | gnd | P1 |
| 46 | earl_sniff | R | 1 | Inspecting: leaning forward, neck stretched, bill near the ground, eye wide. Also peering down off a ledge. | walk_02 | T2 | gnd | P0 |

### 6.5 Earl: food, items, water

| # | Shot | Facing | Frames | Depicts / key details | Base | T | Anchor | Tier |
|---|---|---|---|---|---|---|---|---|
| 47 | earl_peck | R | 2 | Eating: 01 bill down at ground level, 02 head up chewing. A grumpy nibble plays the same frames slower. | walk_02 | T2 | gnd | P0 |
| 48 | earl_chew | R | 1 | Sitting side view, cheeks puffed, content shut eyes. | sit_side | T2 | gnd | P2 |
| 49 | earl_kick | R | 2 | Ball: 01 wind-up, leg back, wing out for balance. 02 kick-through, foot high forward, bill open. | walk_02 | T2 | gnd | P0 |
| 50 | earl_push | R | 2 | Shoving something on the right with his chest and head down, feet braced. 02: bigger shove, one foot sliding back. | walk_02 | T2 | gnd | P1 |
| 51 | earl_sleep_sit | F | 1 | Redraw of sleep: slumped, head drooped to one side, eyes closed, bill tucked. Breathing and Zzz are added in code. | v1 | T1 | gnd | P0 |
| 52 | earl_sleep_lie | R | 1 | Lying on his side curled up, head resting, eyes closed. Drawn between the bed and the blanket. | sit_side | T2 | gnd | P0 |
| 53 | earl_bounce_star | F | 1 | Top of a trampoline bounce, star jump: wings and feet spread wide, happy eyes, laughing. | stand_front | T2 | ctr | P1 |
| 54 | earl_bounce_tuck | F | 1 | Cannonball tuck with a gleeful grin; the game spins it for flips. | tumble | T2 | ctr | P1 |
| 55 | earl_splash | F | 1 | Sitting in the tub: one wing high flinging water, the other low, happy squeezed eyes, laughing. Mirrored on alternate frames. The tub's front layer hides his lower body. | sit_idle | T2 | gnd | P1 |
| 56 | earl_shake | F | 1 | Shaking dry: head twisted one way, body the other, feathers ruffled out, eyes shut. Mirrored plus fast wobble in code. | stand_front | T2 | gnd | P1 |
| 57 | earl_windblown | R | 1 | Facing into the wind (fan on the right): leaning hard forward, eyes squeezed, head fluff swept back, feet braced and skidding. | walk_02 | T2 | gnd | P1 |
| 58 | earl_suspicious | R | 1 | Leaning back and away, visible eye narrowed, one wing half-raised defensively (the rubber duck). | walk_02 | T2 | gnd | P1 |
| 59 | earl_nuzzle | R | 1 | Leaning forward, cheek pressed against something on the right, happy shut eyes, blush. | walk_02 | T2 | gnd | P1 |

### 6.6 Earl: taskbar, windows, walls, air

| # | Shot | Facing | Frames | Depicts / key details | Base | T | Anchor | Tier |
|---|---|---|---|---|---|---|---|---|
| 60 | earl_peek | F | 1 | Peeking over a ledge: chin resting on the ledge line, wing tips resting **on** the line (nothing that should be seen goes below y=124), wide curious eyes. **Full body drawn**; the game hides everything below the taskbar line. His chin-on-the-edge rest when he slips behind the taskbar. | stand_front | T2 | ledge | P0 |
| 60a | earl_peek_blink | F | 1 | Same, eyes closed as soft arcs (a blink, not sleep: chin still up). | peek | T3 | ovl | P0 |
| 60b | earl_peek_look | 3/4 R | 1 | Same ledge pose, head turned three-quarters to the right, looking along the taskbar. Mirrored to look left. | peek | T2 | ovl | P0 |
| 61 | earl_peek_grumpy | F | 1 | Same, half-lidded sulky eyes, flat brows. When sulking, the game sinks him until only his eyes show. | peek | T3 | ovl | P0 |
| 62 | earl_peek_sleep | F | 1 | Same, eyes closed as soft arcs, chin drooped onto the ledge, content. Napping behind the taskbar. | peek | T3 | ovl | P0 |
| 62a | earl_peek_happy | F | 1 | Same, bright eyes, wider bill smile, faint blush. | peek | T3 | ovl | P1 |
| 62b | earl_peek_quack | F | 1 | Same, bill open mid-quack. | peek | T3 | ovl | P1 |
| 63 | earl_jump_up | R | 1 | Launching up onto a window top: stretched tall, wings swept down and back, feet trailing, bill up. | walk_02 | T2 | gnd | P1 |
| 64 | earl_teeter | R | 2 | At a ledge edge leaning over, wings windmilling (01 forward, 02 back), eyes wide. | walk_02 | T2 | gnd | P2 |
| 65 | earl_climb | R | 2 | Climbing a screen edge on the right: upright against the wall, wings gripping high, feet scrabbling alternately, determined squint. Seen in Wild Earl, or anytime if "Climb the screen edges" is set to Anytime (plan D35). | walk_02 | T4 | wall | P1 |
| 66 | earl_hang | F | 1 | Hanging: both wings raised overhead gripping something, feet dangling, smug and content. **One pose for both the parachute and the umbrella ride.** Wing-tip attach points are stored. | held | T2 | hang | P0 |
| 67 | earl_hang_alarm | F | 1 | Same, eyes wide, bill open (parachute yank, fan gust). | hang | T3 | ovl | P1 |
| 68 | earl_tug | R | 2 | Cursor tug-of-war: bill clamped on a point (the bill attach point, where the cursor goes), leaning back, feet braced and sliding. 02: a bigger heave. | walk_02 | T2 | gnd | P1 |
| 68a | earl_carry_overhead | R | 2 | Walking while holding something over his head: near wing raised high gripping it (a `grip` attach point at the wing tip), 2-frame waddle. For carrying the umbrella; until it exists he only grabs the umbrella when jumping down next to it. | walk_02 | T4 | gnd | P2 |

### 6.7 Baby ducklings (duck swarm)

Until these arrive, the swarm uses a small tinted Earl.

| # | Shot | Facing | Frames | Depicts / key details | Base | T | Anchor | Tier |
|---|---|---|---|---|---|---|---|---|
| 69 | baby_sit | F | 1 | Earl's baby sibling sitting: about 55% of his height, butter yellow, head tuft. | sit_idle | T5 | gnd | P1 |
| 70 | baby_walk | R | 2 | Two-frame waddle; the bob is added in code. | baby_sit | T5/T4 | gnd | P1 |
| 71 | baby_peep | F | 1 | Bill open peeping, wings up. | baby_sit | T5 | gnd | P1 |
| 72 | baby_sleep | F | 1 | Curled up asleep. | baby_sit | T5 | gnd | P2 |

### 6.8 Props and accessories

| # | Shot | Facing | Frames | Depicts / key details | Base | T | Canvas | Tier |
|---|---|---|---|---|---|---|---|---|
| 73 | prop_parachute | P | 5 | 01: crumpled fabric bursting out. 02: half open, stretched tall, rippled. 03: fully open dome with red (#D9483B) and cream (#FBF3DD) panels, about 320 wide. 04: deflating, sides sagging. 05: collapsed heap on the ground (he wriggles out from under it). **No strings** (drawn in code). Attach points: `hemL`, `hemR` (set in the lineup). | - (04-05: parachute_03) | T6/T7 | 384x256 | 01-03 P0, 04-05 P1 |
| 75 | prop_bed | P | 1 | Small light-wood bed (#C89B6D), headboard on the left, mattress, white pillow. About 340 long. Back layer. Attach line: `mattress` (where he lies). | - | T6 | 384x192 | P0 |
| 76 | prop_blanket | P | 2 | Same canvas as the bed. Blue gingham (#8DB6E0 / #F8F4EA). 01: flat on the empty bed. 02: tucked over a duckling-shaped bump, pillow area left open. Front layer. | bed_01 | T7 | 384x192 | P0 |
| 77 | prop_bread | P | 4 | Bread slice (crust #C98A43, crumb #F2DDB0), about 96 wide. 01 whole, 02 one bite, 03 half, 04 crust scraps. Crumbs are drawn in code. | - | T6/T7 | 128x128 | P0 |
| 78 | prop_ball | P | 1 | Rubber ball, teal (#3FA7A0) with a cream stripe so the spin reads, about 84 across. The game rotates and squashes it. | - | T6 | 128x128 | P0 |
| 79 | prop_seeds | P | 3 | Small pile of mixed brown and tan seeds. 01 full, 02 half, 03 a few scattered. | - | T6/T7 | 128x64 | P1 |
| 80 | prop_trampoline | P | 2 | Mini trampoline, three-quarter front view: navy mat (#2F3E57), red padded rim, silver legs, about 290 wide. 01 at rest, 02 mat pressed down. Attach line: `mat`. | - | T6/T7 | 320x128 | P1 |
| 81a | prop_tub_back | P | 1 | Small galvanized washtub (#9AA9B5): the rear rim and the opaque water surface (#8FD3F0), a few white bubbles. Earl sits in front of this layer. Attach line: `waterline`. | - | T6 | 320x192 | P1 |
| 81b | prop_tub_front | P | 1 | The same tub's front wall and front rim only, lined up exactly with `prop_tub_back_01` (draw it as an edit of the back layer). It covers Earl's lower body. | tub_back | T7 | 320x192 | P1 |
| 82 | prop_rubber_duck | P (R) | 2 | Classic glossy vinyl rubber duck, saturated #FFD21F (contrasts with Earl's cream), orange bill #FF7A1A, painted dot eye, about 75% of Earl's height, duck framing (ground line 240). 02: squeezed mid-squeak, bill open. | - | T6/T7 | 256x256 | P1 |
| 83 | prop_fan | P (R) | 3 | Small retro desk fan, mint body (#9ED9C3), silver cage, three-quarter view facing right, about Earl's height. Three blade positions, opaque (the blur is added in code). Attach point: `hub`. | fan_01 | T6/T7 | 256x256 | P1 |
| 84 | prop_umbrella_open | P | 1 | Open umbrella, sky blue (#6FA8DC) with cream trim, J-shaped handle, about 300 wide. Used as a tent he hides under and as the parasol ride. Attach point: `handle`. | - | T6 | 384x384 | P1 |
| 85 | prop_umbrella_closed | P | 1 | Furled umbrella lying on the ground (the placed-item state). | umbrella_open | T6 | 256x96 | P1 |
| 86 | acc_party_hat | P | 1 | Tiny cone party hat, bright stripes, pom-pom. Its anchor is the base centre; the game puts it on any pose's head point on birthdays (**replaces birthday.png**). | - | T6 | 128x128 | P0 |
| 87 | acc_nightcap | P | 1 | Droopy striped nightcap for sleeping in bed at night. | - | T6 | 128x128 | P2 |

### 6.9 Icons

| # | Shot | Facing | Frames | Depicts / key details | Base | T | Canvas | Tier |
|---|---|---|---|---|---|---|---|---|
| 88 | icon_app | I | 1 | 1024 master: Earl's head and shoulders, front, big eyes, brown rim. `tauri icon` builds every app icon from it. | sit_idle | T8 | 1024 | P0 |
| 89 | icon_tray | I | 1 | 1024 master built to read at 16-32 px: head only, oversized eyes and bill, thick brown rim. Exported per DPI (16/20/24/32). | sit_idle | T8 | 1024 | P0 |
| 90 | icon_toolbox | I | 1 | Red metal toolbox (#D9483B), closed, silver latch and handle. Used in the tray, the panel and the toolbox drawer header. | - | T6 | 256 | P0 |
| - | *(automatic)* toolbox item icons | I | 0 | The pipeline makes the 9 drawer icons (trampoline, bed, bread, seeds, tub, ball, rubber duck, fan, umbrella) from frame 01 of each prop. No drawing needed. | - | - | 64/128 | - |

**Code-only behaviors (no art needed):** zoomies, physics party, hiding behind windows and the taskbar (clipping plus the peek poses), running from the cursor, bouncing off walls, the fan pushing the parachute, tub bubbles and ripples.

**Code-drawn effects:** Zzz, dizzy stars, sweat and water drops, splash, crumbs, dust puffs, wind streaks, speed lines, hearts, "!" and "?", confetti, steam, parachute strings, ground shadow, speech and thought bubbles.

### 6.10 Where every v1 sprite ends up

| v1 file(s) | v2 shot |
|---|---|
| Earl_Front_Idle | earl_sit_idle_01 |
| Earl_Front_Blink | earl_sit_blink_01 |
| Idle_Side | earl_sit_side_01 |
| Walk_step_1 | earl_walk_01 |
| walk_side | earl_walk_02 |
| Walk_step_2 | earl_walk_03 |
| all `*_left` files | deleted; the game flips instead |
| Hop_Squat | earl_hop_squat_01 |
| Hop_Air | earl_hop_air_01 |
| Picked_up | earl_held_01 |
| dropped_squish | earl_land_squish_01 |
| sleep | earl_sleep_sit_01 |
| birthday | earl_sit_idle_01 + acc_party_hat_01 |
| tray_icon | icon_app_01 |
| tray_icon_32 | icon_tray_01 |
| run_step1 (April) | earl_run_01 |
| tumble (April) | earl_tumble_01 |
| wall_bump (April) | earl_wall_bump_01 |
| dizzy (April) | earl_dizzy_01 |
| pouty (April) | earl_sit_pouty_01 |
| huffy (April) | earl_sit_huffy_01 |
| puffed_up (April) | earl_puffed_up_01 |
| tantrum_stomp (April) | earl_tantrum_01 |
| v1's 12 missing files: run_step2 (+left) | earl_run_03 |
| sitting_to_standing, standing_to_sitting | earl_sit_to_stand_01 (forward and reversed) |
| standing_idle | earl_stand_front_01 |
| plop_down | earl_plop_01 |
| stretch | earl_stretch_01 |
| drag_left, drag_right | earl_held_side_01 |
| drag_up | earl_held_up_01 |
| drag_down | earl_held_down_01 |
| drag_fast | earl_flail_01..02 |

---

## 7. Delivery instructions

1. **Drop folder:** save raw exports to `/mnt/HC_Volume_106939637/earl/art-inbox/` (the main checkout's `art/inbox/` points there; `npm run art:import -- --inbox <dir>` reads any other folder). The folder is gitignored; keep your own originals in OneDrive. The pipeline itself is described in `docs/ART.md`.
2. **Naming:**
   - Use `<shot>_<nn>.png` with lowercase snake_case, exactly as in the table, e.g. `earl_peek_01.png`, `prop_bread_03.png`.
   - A strip can be saved as `<shot>.png`, e.g. `earl_walk.png`. The pipeline splits it on the magenta gaps and errors if the frame count does not match the table.
   - Anything after a double underscore is ignored, so you can keep several takes side by side: `earl_peek_01__take2.png`.
3. **Format:** PNG or WebP at 1024 px or larger, on flat #FF00FF. A JPG is accepted with a warning. A painted checkerboard is rejected with "regenerate on #FF00FF".
4. **Import:** run `npm run art:import` (or ask an agent to). It keys, aligns and scales each image, writes a 512 px master to `art/masters/`, and rebuilds the game atlases. Each raw that imported cleanly then moves to `imported/` inside the drop folder, so the next import does not redo it; one that failed stays put to be fixed.
5. **Review:** open `art/out/contact.png`. It has:
   - every frame on the dark (#202020) and light (#F3F3F3) Win11 taskbar greys;
   - a red y=240 line, the anchor cross, bounding box, detected eyes and ledge line;
   - status labels: OK / WARN / ERR / PLACEHOLDER / MISSING;
   - a size ladder of `earl_sit_idle_01` at 48/64/96/128/256;
   - animated previews for multi-frame shots.

   `npm run dev` then `/?lineup` shows everything live in the browser.
6. **What the checker flags:**
   - **Errors:**
     - outside the safe area;
     - baseline off by more than 1 px;
     - leftover magenta, or a pink or purple fringe on the edges (the keyer removes magenta spill; anything left fails);
     - see-through holes (the April eye-hole problem);
     - **a dark or neutral-grey rim or halo on any `earl_*` or `baby_*` frame** (the April defect; an error, not a warning);
     - peek frames whose wing tips sit more than 2 source px below the ledge line;
     - a prop without its required attach lines, or more than 15% off its target size.
   - **Warnings:**
     - hard, non-anti-aliased edges (**smooth profile only**; in the `v1-faithful` profile hard edges are expected and not flagged);
     - eye size not 22 ±2;
     - body colour drift of more than 5 ΔE from #F8E9C7;
     - an expression edit that moved the body;
     - head width more than 6% off `earl_sit_idle_01` (shots that deform on purpose, such as puffed_up, plop, land_squish, stretch and startle, have a per-shot allowance in `shots.json`).

   Regenerate anything with an ERR. Treat a WARN as your call.
7. **Approve:** when a shot looks right in the lineup, it is marked approved in `art/shots.json`. `npm run art:status` prints what is delivered against what is missing, per tier.

---

## 8. Count summary

| Tier | Earl | Baby | Props + accessories | Icons | Total |
|---|---|---|---|---|---|
| **P0** | 48 | 0 | 12 (parachute 3, bed 1, blanket 2, bread 4, ball 1, party hat 1) | 3 | **63** |
| **P1** | 41 | 4 | 16 (parachute 2, seeds 3, trampoline 2, tub_back 1, tub_front 1, rubber duck 2, fan 3, umbrella 2) | 0 | **61** |
| **P2** | 9 (tada 1, dizzy_02 1, scratch 2, chew 1, teeter 2, carry_overhead 2) | 1 | 1 (nightcap) | 0 | **11** |
| **Total** | 98 | 5 | 29 | 3 | **135** |

**P0 Earl frames (48):**
- sit_idle 1, sit_blink 1, sit_quack 1, sit_side 1, stand_front 1, walk 3, run 4, sit_to_stand 1
- hop_squat 1, hop_air 1, land_squish 1, held 1, flail 2, tumble 1
- wall_bump 1, dizzy_01 1, sit_pouty 1, sit_huffy 1, puffed_up 1, tantrum 1
- tilt 1, petted 1, petted_grumpy 1, sit_sleepy 1, look 1, stand_look 1, look_up 1, stare 1, sulk 1
- sniff 1, peck 2, kick 2
- sleep_sit 1, sleep_lie 1, hang 1, peek 1, peek_blink 1, peek_look 1, peek_grumpy 1, peek_sleep 1

(13 + 7 + 6 + 9 + 5 + 8 = 48.)

**P1 Earl frames (41):**
- sit_side_blink 1, stand_blink 1, turn 1, plop 1, stretch 1, yawn 2
- held_grumpy 1, held_side 1, held_up 1, held_down 1, sit_happy 1, stand_look_up 1
- side_eye 1, sad 1, angry 1, startle 1, wiggle 1
- sneeze 2, preen 2, honk 2, push 2
- bounce_star 1, bounce_tuck 1, splash 1, shake 1, windblown 1, suspicious 1, nuzzle 1
- jump_up 1, climb 2, hang_alarm 1, tug 2, peek_happy 1, peek_quack 1

(7 + 6 + 5 + 8 + 7 + 8 = 41.)

**Suggested batches:**
- **Batch A (after the Q2 style decision):** the 4 masters, then the rest of P0 Earl.
- **Batch B:** P0 props and icons.
- **Batch C:** P1 Earl expressions and habits.
- **Batch D:** P1 props and babies.
- **Batch E:** P2.

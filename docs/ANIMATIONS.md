# Animations Reference

## Sprite Files

All sprites are 128x128 PNG with transparency in `assets/sprites/`.

| File | Description |
|---|---|
| Earl_Front_Idle.png | Front-facing, eyes open, neutral |
| Earl_Front_Blink.png | Front-facing, eyes closed |
| Idle_Side.png | Side profile facing right, standing |
| Walk_step_1.png | Side right, left foot forward |
| Walk_step_2.png | Side right, right foot forward |
| walk_side.png | Side right, feet together (mid-stride) |
| Walk_step_1_left.png | Mirrored walk step 1 (facing left) |
| Walk_step_2_left.png | Mirrored walk step 2 (facing left) |
| walk_side_left.png | Mirrored walk mid (facing left) |
| Hop_Squat.png | Front-facing, squished down pre-jump |
| Hop_Air.png | Front-facing, airborne, wings up |
| Picked_up.png | Front-facing, dangling, surprised |
| dropped_squish.png | Front-facing, pancake squish on landing |
| sleep.png | Front-facing, sleeping, head tilted, Zzz |
| birthday.png | Front-facing with party hat |
| tray_icon.png | Close-up face for tray icon |

## Animation Definitions

### idle_front (LOOPING)
Earl's default resting state. Mostly still with occasional blinks.

```
Frame 1: Earl_Front_Idle.png    (800ms)  — eyes open
Frame 2: Earl_Front_Idle.png    (800ms)  — eyes open
Frame 3: Earl_Front_Idle.png    (800ms)  — eyes open
Frame 4: Earl_Front_Idle.png    (200ms)  — eyes open (pre-blink pause)
Frame 5: Earl_Front_Blink.png   (150ms)  — eyes closed (the blink)
Frame 6: Earl_Front_Idle.png    (200ms)  — eyes open (post-blink)
-> loop back to frame 1
```

Total cycle: ~2950ms (~3 seconds per blink cycle)

### walk_right (LOOPING)
Earl waddling to the right.

```
Frame 1: walk_side.png          (150ms)  — feet together (passing position)
Frame 2: Walk_step_1.png        (150ms)  — left foot forward
Frame 3: walk_side.png          (150ms)  — feet together
Frame 4: Walk_step_2.png        (150ms)  — right foot forward
-> loop
```

Total cycle: 600ms. Move Earl 1.5px rightward per frame (~40px/sec at 60fps render).

### walk_left (LOOPING)
Mirror of walk_right.

```
Frame 1: walk_side_left.png     (150ms)
Frame 2: Walk_step_1_left.png   (150ms)
Frame 3: walk_side_left.png     (150ms)
Frame 4: Walk_step_2_left.png   (150ms)
-> loop
```

Move Earl 1.5px leftward per frame.

### hop (NON-LOOPING)
Happy bounce when clicked.

```
Frame 1: Earl_Front_Idle.png    (80ms)   — anticipation
Frame 2: Hop_Squat.png          (100ms)  — squat down (y offset: +5px)
Frame 3: Hop_Air.png            (150ms)  — airborne (y offset: -20px)
Frame 4: Hop_Air.png            (150ms)  — hang time (y offset: -20px)
Frame 5: Hop_Squat.png          (100ms)  — landing squat (y offset: +5px)
Frame 6: Earl_Front_Idle.png    (80ms)   — recover
-> return to idle state
```

Total: 660ms. Y offsets are relative to Earl's ground position (positive = down, negative = up).

### picked_up (LOOPING)
While being dragged by the user.

```
Frame 1: Picked_up.png          (300ms)
-> loop (single frame, just holds this pose)
```

Earl follows the cursor position while in this state.

### dropped (NON-LOOPING)
After being released from a drag.

```
Frame 1: dropped_squish.png     (200ms)  — impact squish
Frame 2: dropped_squish.png     (200ms)  — hold squish
Frame 3: Hop_Squat.png          (150ms)  — recovering
Frame 4: Earl_Front_Idle.png    (100ms)  — back to normal
-> return to idle state
```

Total: 650ms.

### sleep (LOOPING)
Earl dozing off after extended idle.

```
Frame 1: sleep.png              (1000ms)
-> loop (single frame with gentle body bob if possible)
```

Optional: if the renderer supports it, apply a subtle 1-2px vertical oscillation
(sine wave, period ~2s) to simulate breathing while sleeping.

Wake up trigger: click or mouse hover over Earl.

### birthday (LOOPING)
Active on April 4th or June 23rd.

```
Frame 1: birthday.png           (500ms)
-> loop (single frame, party hat Earl)
```

Replaces idle_front as the default idle animation when birthday mode is active.
All other animations (walk, hop, etc.) use their normal sprites — only idle swaps.

## Behavior Timing

| Parameter | Value |
|---|---|
| Idle before walk | 10-30 seconds (random) |
| Walk duration | 3-8 seconds (random) |
| Idle before sleep | 60-120 seconds (random) |
| Walk speed | ~40px/second |
| Hop total duration | ~660ms |
| Drop recovery duration | ~650ms |
| Speech bubble display | 3 seconds |
| Confetti particle lifetime | 3 seconds |
| Birthday confetti spawn rate | ~1% chance per frame |

## Display Scaling

| Setting | Render Size | Display Size | Notes |
|---|---|---|---|
| 48px | 128x128 | 48x48 | Icon-sized, very subtle |
| 64px (default) | 128x128 | 64x64 | Good balance |
| 80px | 128x128 | 80x80 | Comfortably visible |
| 96px | 128x128 | 96x96 | Large, very prominent |

Always render from the 128x128 source with `imageSmoothingEnabled = true` and
`imageSmoothingQuality = 'high'` for clean downscaling.

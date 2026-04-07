import spritesManifest from "../assets/sprites/sprites.json";

export interface AnimationDef {
  frames: string[];
  durations: number[];
  loop: boolean;
}

export interface AnimatorState {
  animation: string;
  frameIndex: number;
  elapsed: number;
  finished: boolean;
}

const manifest = spritesManifest as Record<string, AnimationDef>;
const imageCache = new Map<string, HTMLImageElement>();

// Fallback map: if a sprite PNG doesn't exist, use this one instead.
// When real sprites are added to the folder, they'll be loaded automatically.
const SPRITE_FALLBACKS: Record<string, string> = {
  // Sprites not yet created — fall back to similar existing sprites
  "run_step2.png": "Walk_step_2.png",
  "run_step2_left.png": "Walk_step_2_left.png",
  "sitting_to_standing.png": "Earl_Front_Idle.png",
  "standing_idle.png": "Earl_Front_Idle.png",
  "standing_to_sitting.png": "Earl_Front_Idle.png",
  "plop_down.png": "dropped_squish.png",
  "stretch.png": "Hop_Air.png",
  "drag_left.png": "Picked_up.png",
  "drag_right.png": "Picked_up.png",
  "drag_up.png": "Picked_up.png",
  "drag_down.png": "Picked_up.png",
  "drag_fast.png": "Picked_up.png",
};

function resolveSpritePath(filename: string): string {
  return new URL(`../assets/sprites/${filename}`, import.meta.url).href;
}

export function preloadSprites(): Promise<void> {
  const allFiles = new Set<string>();
  for (const anim of Object.values(manifest)) {
    for (const frame of anim.frames) {
      allFiles.add(frame);
    }
  }

  const promises = Array.from(allFiles).map(
    (file) =>
      new Promise<void>((resolve) => {
        if (imageCache.has(file)) {
          resolve();
          return;
        }
        const img = new Image();
        img.onload = () => {
          imageCache.set(file, img);
          resolve();
        };
        img.onerror = () => {
          // Sprite doesn't exist — fallback will be used at render time
          console.warn(`Sprite not found, will use fallback: ${file}`);
          resolve();
        };
        img.src = resolveSpritePath(file);
      })
  );

  return Promise.all(promises).then(() => {});
}

export function getAnimation(name: string): AnimationDef | undefined {
  return manifest[name];
}

export function getSpriteImage(filename: string): HTMLImageElement | undefined {
  return imageCache.get(filename);
}

export function createAnimatorState(animation: string): AnimatorState {
  return {
    animation,
    frameIndex: 0,
    elapsed: 0,
    finished: false,
  };
}

export function updateAnimator(
  state: AnimatorState,
  deltaMs: number,
  speedMultiplier: number
): AnimatorState {
  const anim = manifest[state.animation];
  if (!anim || state.finished) return state;

  const newElapsed = state.elapsed + deltaMs;
  const frameDuration = anim.durations[state.frameIndex] * speedMultiplier;

  if (newElapsed >= frameDuration) {
    const nextFrame = state.frameIndex + 1;
    if (nextFrame >= anim.frames.length) {
      if (anim.loop) {
        return { ...state, frameIndex: 0, elapsed: 0, finished: false };
      } else {
        return { ...state, finished: true, elapsed: 0 };
      }
    }
    return { ...state, frameIndex: nextFrame, elapsed: 0 };
  }

  return { ...state, elapsed: newElapsed };
}

export function getCurrentFrame(state: AnimatorState): HTMLImageElement | undefined {
  const anim = manifest[state.animation];
  if (!anim) return undefined;
  const filename = anim.frames[state.frameIndex];
  // Try the real sprite first, then fall back
  return imageCache.get(filename) ?? imageCache.get(SPRITE_FALLBACKS[filename] ?? "");
}

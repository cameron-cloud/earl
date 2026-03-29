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

function resolveSpritePath(filename: string): string {
  // Vite will handle these imports at build time via the assets directory
  // Use a dynamic URL resolved relative to the sprites folder
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
          console.warn(`Failed to load sprite: ${file}`);
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
  return imageCache.get(filename);
}

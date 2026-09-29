// Alignment to the anchor rules of ART_SHOTLIST section 3. Works at any level: `s` is level px
// per world px (1 for the 256 level, 2 for the 512 masters).
import { alphaBBox, alphaIoU, centroid, detectEyes } from "./analyze.mjs";
import { blit, createImage, resize, warp } from "./image.mjs";

/** Anchor point per anchor type, in world units on the frame canvas. */
export function anchorPoint(anchorType, canvas) {
  const [cw, ch] = canvas;
  switch (anchorType) {
    case "gnd":
      return [128, 240];
    case "ctr":
      return [128, 128];
    case "grip":
      return [128, 20];
    case "hang":
      return [128, 16];
    case "ledge":
      return [128, 124];
    case "wall":
      return [240, 128];
    case "prop":
      return [cw / 2, ch - 16];
    default:
      return [cw / 2, ch / 2];
  }
}

/** Last pixel row or column index of world row/column v at scale s. */
const lastIndex = (v, s) => (v + 1) * s - 1;

/**
 * Computes the translation that puts `img` (keyed content, any size) on its anchor.
 * Returns { dx, dy } in level px: target = source + (dx, dy).
 */
export function anchorShift(img, { anchorType, facing, canvas }, s) {
  const bb = alphaBBox(img);
  if (!bb) return { dx: 0, dy: 0 };
  const c = centroid(img);
  const frontX = () => {
    if (facing === "front") {
      const eyes = detectEyes(img, s);
      if (eyes.length === 2) return (eyes[0].x + eyes[1].x) / 2;
    }
    return c.x;
  };
  const topX = (share) => centroid(img, bb.y0, bb.y0 + Math.max(1, Math.floor(bb.h * share))).x;
  const [cw, ch] = canvas;
  switch (anchorType) {
    case "gnd":
      return { dx: Math.round(128 * s - frontX()), dy: lastIndex(240, s) - bb.y1 };
    case "ctr":
      return { dx: Math.round(128 * s - c.x), dy: Math.round(128 * s - c.y) };
    case "grip":
      return { dx: Math.round(128 * s - topX(0.15)), dy: 20 * s - bb.y0 };
    case "hang":
      return { dx: Math.round(128 * s - topX(0.1)), dy: 16 * s - bb.y0 };
    case "ledge":
      return { dx: Math.round(128 * s - frontX()), dy: 0 };
    case "wall":
      return { dx: lastIndex(240, s) - bb.x1, dy: Math.round(128 * s - (bb.y0 + bb.y1) / 2) };
    case "prop":
      return {
        dx: Math.round((cw / 2) * s - (bb.x0 + bb.x1 + 1) / 2),
        dy: lastIndex(ch - 16, s) - bb.y1,
      };
    default:
      return {
        dx: Math.round((cw / 2) * s - (bb.x0 + bb.x1 + 1) / 2),
        dy: Math.round((ch / 2) * s - (bb.y0 + bb.y1 + 1) / 2),
      };
  }
}

/** Places keyed content on a fresh canvas of the frame size at scale s, on its anchor. */
export function alignFrame(img, spec, s) {
  const { dx, dy } = anchorShift(img, spec, s);
  const out = createImage(spec.canvas[0] * s, spec.canvas[1] * s);
  blit(out, img, dx, dy);
  return { image: out, dx, dy };
}

function mask(img) {
  const m = new Uint8Array(img.width * img.height);
  for (let i = 0; i < m.length; i++) m[i] = img.data[i * 4 + 3] >= 128 ? 1 : 0;
  return m;
}

function shiftedIoU(m, base, w, h, tx, ty) {
  let inter = 0;
  let uni = 0;
  for (let y = 0; y < h; y++) {
    const sy = y - ty;
    for (let x = 0; x < w; x++) {
      const sx = x - tx;
      const p = sx >= 0 && sy >= 0 && sx < w && sy < h ? m[sy * w + sx] : 0;
      const q = base[y * w + x];
      inter += p & q;
      uni += p | q;
    }
  }
  return uni ? inter / uni : 1;
}

/**
 * Lines an expression edit up with its base (shift plus scale 0.94-1.06), maximising alpha IoU.
 * Both images must already be on the same canvas size. Identity wins ties.
 */
export function alignOverlay(img, base, range = 8) {
  const f = Math.max(1, Math.round(img.width / 128));
  const w = Math.round(img.width / f);
  const h = Math.round(img.height / f);
  const small = resize(img, w, h);
  const baseMask = mask(resize(base, w, h));
  let best = { scale: 1, tx: 0, ty: 0, iou: shiftedIoU(mask(small), baseMask, w, h, 0, 0) };
  const scales = [1];
  for (let k = 1; k <= 6; k++) scales.push(1 - k * 0.01, 1 + k * 0.01);
  for (const sc of scales) {
    const m = mask(sc === 1 ? small : warp(small, sc, 0, 0));
    for (let ty = -range; ty <= range; ty++) {
      for (let tx = -range; tx <= range; tx++) {
        const iou = shiftedIoU(m, baseMask, w, h, tx, ty);
        if (iou > best.iou + 1e-9) best = { scale: sc, tx, ty, iou };
      }
    }
  }
  let image;
  if (best.scale === 1) {
    image = createImage(img.width, img.height);
    blit(image, img, best.tx * f, best.ty * f);
  } else {
    image = warp(img, best.scale, best.tx * f, best.ty * f);
  }
  return { image, scale: best.scale, tx: best.tx * f, ty: best.ty * f, iou: alphaIoU(image, base) };
}

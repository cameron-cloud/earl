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

function maskBox(m, w, h) {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  let count = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (m[y * w + x]) {
        count++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return count ? { x0, y0, x1, y1, count } : null;
}

/**
 * Alpha IoU of mask `m` shifted by (tx, ty) against `base`, both w x h, as a function of the
 * shift. Exact (the same integer counts as a full-canvas scan) but it only visits the overlap of
 * the two bounding boxes, and counts the shifted mask with a summed-area table. The overlay
 * search calls it about 3700 times per frame, so this is the hot loop of art:build.
 */
function shiftedIoU(m, base, baseBox, w, h) {
  const box = maskBox(m, w, h);
  const sat = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += m[y * w + x];
      sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + row;
    }
  }
  const rectSum = (x0, y0, x1, y1) =>
    x1 <= x0 || y1 <= y0
      ? 0
      : sat[y1 * (w + 1) + x1] -
        sat[y0 * (w + 1) + x1] -
        sat[y1 * (w + 1) + x0] +
        sat[y0 * (w + 1) + x0];
  const baseCount = baseBox ? baseBox.count : 0;
  return (tx, ty) => {
    // Pixels of m that land inside the canvas after the shift.
    const inside = rectSum(
      Math.max(0, -tx),
      Math.max(0, -ty),
      Math.min(w, w - tx),
      Math.min(h, h - ty),
    );
    let inter = 0;
    if (box && baseBox) {
      const ya = Math.max(baseBox.y0, box.y0 + ty);
      const yb = Math.min(baseBox.y1, box.y1 + ty);
      const xa = Math.max(baseBox.x0, box.x0 + tx);
      const xb = Math.min(baseBox.x1, box.x1 + tx);
      for (let y = ya; y <= yb; y++) {
        const bi = y * w;
        const mi = (y - ty) * w - tx;
        for (let x = xa; x <= xb; x++) inter += m[mi + x] & base[bi + x];
      }
    }
    const uni = inside + baseCount - inter;
    return uni ? inter / uni : 1;
  };
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
  const baseBox = maskBox(baseMask, w, h);
  let best = {
    scale: 1,
    tx: 0,
    ty: 0,
    iou: shiftedIoU(mask(small), baseMask, baseBox, w, h)(0, 0),
  };
  const scales = [1];
  for (let k = 1; k <= 6; k++) scales.push(1 - k * 0.01, 1 + k * 0.01);
  for (const sc of scales) {
    const iouAt = shiftedIoU(
      mask(sc === 1 ? small : warp(small, sc, 0, 0)),
      baseMask,
      baseBox,
      w,
      h,
    );
    for (let ty = -range; ty <= range; ty++) {
      for (let tx = -range; tx <= range; tx++) {
        const iou = iouAt(tx, ty);
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

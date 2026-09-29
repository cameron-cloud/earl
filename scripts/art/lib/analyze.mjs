// Measurements and lint checks on keyed, aligned frames. Every threshold is in world units,
// that is on the 256 level (1 px = 1 source px of the 256 duck canvas, ART_SHOTLIST section 3).
import { magentaRatio } from "./keyer.mjs";

const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Bounding box of pixels with alpha >= thr (inclusive x1, y1), or null when empty. */
export function alphaBBox(img, thr = 128) {
  const { width: w, height: h, data } = img;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] >= thr) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Mean position of opaque pixels, optionally only rows [ya, yb]. */
export function centroid(img, ya = 0, yb = img.height - 1, thr = 128) {
  const { width: w, data } = img;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = Math.max(0, ya); y <= Math.min(img.height - 1, yb); y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] >= thr) {
        sx += x;
        sy += y;
        n++;
      }
    }
  }
  return n ? { x: sx / n, y: sy / n } : null;
}

/** Transparent regions (alpha < 128) fully enclosed by the silhouette: the April eye-hole defect. */
export function findHoles(img, thr = 128) {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const open = new Uint8Array(n);
  const stack = [];
  const clear = (i) => data[i * 4 + 3] < thr;
  for (let x = 0; x < w; x++) {
    stack.push(x, (h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    stack.push(y * w, y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop();
    if (open[i] || !clear(i)) continue;
    open[i] = 1;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < n - w) stack.push(i + w);
  }
  const seen = new Uint8Array(n);
  const holes = [];
  for (let i = 0; i < n; i++) {
    if (open[i] || seen[i] || !clear(i)) continue;
    let area = 0;
    let sx = 0;
    let sy = 0;
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop();
      const x = j % w;
      const y = (j - x) / w;
      area++;
      sx += x;
      sy += y;
      for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, j - w, j + w]) {
        if (k < 0 || k >= n || seen[k] || open[k] || !clear(k)) continue;
        seen[k] = 1;
        stack.push(k);
      }
    }
    holes.push({ area, x: sx / area, y: sy / area });
  }
  return holes;
}

function isRim(img, x, y) {
  const { width: w, height: h, data } = img;
  const a = data[(y * w + x) * 4 + 3];
  if (a === 0) return false;
  if (a < 255) return true;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const xx = x + dx;
    const yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= w || yy >= h || data[(yy * w + xx) * 4 + 3] === 0) return true;
  }
  return false;
}

/** Share of rim pixels that are dark or neutral grey (the April outline and halo), and of hard edges. */
export function rimStats(img) {
  const { width: w, height: h, data } = img;
  let rim = 0;
  let dark = 0;
  let hard = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isRim(img, x, y)) continue;
      rim++;
      const p = (y * w + x) * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const l = luma(r, g, b);
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      if (l < 80 || (sat < 20 && l < 200)) dark++;
      if (data[p + 3] === 255) hard++;
    }
  }
  return { rim, darkShare: rim ? dark / rim : 0, hardShare: rim ? hard / rim : 0 };
}

/** Pixels with alpha > 0 whose magenta-hue ratio exceeds thr (leftover key or pink fringe). */
export function magentaPixels(img, thr = 0.15) {
  const d = img.data;
  let count = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 0 && magentaRatio(d[i], d[i + 1], d[i + 2]) > thr) count++;
  }
  return count;
}

/**
 * Finds the eyes: solid dark round blobs inside the silhouette, in its upper part.
 * Returns up to two {x, y, r, across}, sorted left to right. `scale` is level px per world px.
 */
export function detectEyes(img, scale = 1) {
  const { width: w, height: h, data } = img;
  const bb = alphaBBox(img);
  if (!bb) return [];
  const n = w * h;
  const dark = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    dark[i] = data[p + 3] >= 128 && luma(data[p], data[p + 1], data[p + 2]) < 70 ? 1 : 0;
  }
  const seen = new Uint8Array(n);
  const blobs = [];
  const stack = [];
  for (let i = 0; i < n; i++) {
    if (!dark[i] || seen[i]) continue;
    let area = 0;
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    let touchesOutside = false;
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop();
      const x = j % w;
      const y = (j - x) / w;
      area++;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) {
            touchesOutside = true;
            continue;
          }
          const k = yy * w + xx;
          if (data[k * 4 + 3] < 128) touchesOutside = true;
          if (dark[k] && !seen[k]) {
            seen[k] = 1;
            stack.push(k);
          }
        }
      }
    }
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    const cy = (y0 + y1) / 2;
    const s2 = scale * scale;
    if (touchesOutside || area < 30 * s2 || area > 2000 * s2) continue;
    if (bw / bh < 0.5 || bw / bh > 2 || area / (bw * bh) < 0.45) continue;
    if (cy > bb.y0 + bb.h * 0.75) continue;
    blobs.push({ x: (x0 + x1) / 2, y: cy, r: (bw + bh) / 4, across: bw, area });
  }
  blobs.sort((a, b) => b.area - a.area || a.x - b.x);
  let eyes = blobs.slice(0, 2);
  if (eyes.length === 2 && eyes[1].area / eyes[0].area < 0.4) eyes = eyes.slice(0, 1);
  return eyes.sort((a, b) => a.x - b.x).map(({ x, y, r, across }) => ({ x, y, r, across }));
}

/** Widest opaque row span in the top 55% of the silhouette (the head). */
export function headWidth(img) {
  const bb = alphaBBox(img);
  if (!bb) return 0;
  const { width: w, data } = img;
  let best = 0;
  for (let y = bb.y0; y <= bb.y0 + Math.floor(bb.h * 0.55); y++) {
    let a = -1;
    let b = -1;
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] >= 128) {
        if (a < 0) a = x;
        b = x;
      }
    }
    if (a >= 0) best = Math.max(best, b - a + 1);
  }
  return best;
}

function toLab(r, g, b) {
  const lin = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

export function deltaE(c1, c2) {
  const a = toLab(...c1);
  const b = toLab(...c2);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** The dominant opaque colour (mode of a 6-bit quantisation, then averaged within the bucket). */
export function dominantColour(img) {
  const d = img.data;
  const buckets = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 255) continue;
    const k = ((d[i] >> 2) << 12) | ((d[i + 1] >> 2) << 6) | (d[i + 2] >> 2);
    const e = buckets.get(k) || [0, 0, 0, 0];
    e[0] += d[i];
    e[1] += d[i + 1];
    e[2] += d[i + 2];
    e[3]++;
    buckets.set(k, e);
  }
  let best = null;
  for (const [k, e] of buckets)
    if (!best || e[3] > best[1][3] || (e[3] === best[1][3] && k < best[0])) best = [k, e];
  if (!best) return null;
  const e = best[1];
  return [e[0] / e[3], e[1] / e[3], e[2] / e[3]];
}

/** Intersection over union of the two alpha masks (same size). */
export function alphaIoU(a, b, thr = 128) {
  let inter = 0;
  let uni = 0;
  for (let i = 3; i < a.data.length; i += 4) {
    const p = a.data[i] >= thr;
    const q = b.data[i] >= thr;
    if (p && q) inter++;
    if (p || q) uni++;
  }
  return uni ? inter / uni : 1;
}

/** 64x64 bit mask over the frame canvas (a cell is set if any pixel in it is opaque), base64. */
export function hitMask64(img) {
  const bits = new Uint8Array(512);
  const { width: w, height: h, data } = img;
  for (let y = 0; y < h; y++) {
    const cy = Math.min(63, Math.floor((y * 64) / h));
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < 128) continue;
      const cx = Math.min(63, Math.floor((x * 64) / w));
      const bit = cy * 64 + cx;
      bits[bit >> 3] |= 1 << (bit & 7);
    }
  }
  return Buffer.from(bits).toString("base64");
}

/** Topmost opaque pixel in the left and right halves (wing tips for the hang anchor). */
export function wingTips(img) {
  const bb = alphaBBox(img);
  if (!bb) return null;
  const mid = (bb.x0 + bb.x1) / 2;
  const find = (xa, xb) => {
    for (let y = bb.y0; y <= bb.y1; y++) {
      for (let x = xa; x <= xb; x++)
        if (img.data[(y * img.width + x) * 4 + 3] >= 128) return [x, y];
    }
    return null;
  };
  return { wingL: find(bb.x0, Math.floor(mid)), wingR: find(Math.ceil(mid), bb.x1) };
}

const ATTACH_ESTIMATE = {
  mat: (b) => [
    [b.x0, b.y0 + b.h * 0.25],
    [b.x1, b.y0 + b.h * 0.25],
  ],
  mattress: (b) => [
    [b.x0, b.y0 + b.h * 0.45],
    [b.x1, b.y0 + b.h * 0.45],
  ],
  waterline: (b) => [
    [b.x0, b.y0 + b.h * 0.3],
    [b.x1, b.y0 + b.h * 0.3],
  ],
  hub: (b) => [[(b.x0 + b.x1) / 2, b.y0 + b.h * 0.4]],
  handle: (b) => [[(b.x0 + b.x1) / 2, b.y1]],
  hemL: (b) => [[b.x0, b.y1]],
  hemR: (b) => [[b.x1, b.y1]],
};

/**
 * Prop footprint (alpha bbox at world scale) and attach lines. Clicked values from shots.json win;
 * a required line without one is estimated from the bbox and reported as estimated.
 */
export function measureProp(img, required = [], clicked = {}) {
  const bb = alphaBBox(img);
  if (!bb) return null;
  const attach = {};
  const estimated = [];
  for (const name of required) {
    if (clicked[name]) attach[name] = clicked[name];
    else {
      const est = ATTACH_ESTIMATE[name];
      attach[name] = est
        ? est(bb).map(([x, y]) => [Math.round(x), Math.round(y)])
        : [[bb.x0, bb.y0]];
      estimated.push(name);
    }
  }
  return { footprint: { x: bb.x0, y: bb.y0, w: bb.w, h: bb.h }, attach, estimated };
}

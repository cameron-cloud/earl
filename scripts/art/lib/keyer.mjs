// Soft chroma keyer with despill for art painted on flat magenta #FF00FF (plan D19).
//
// 1. Alpha comes from the distance to the key in the CbCr chroma plane. Pixels close to the
//    key are background, pixels far from it are foreground.
// 2. Ramp pixels (the anti-aliased edge) are unmixed against their nearest interior colour F:
//    with c = a*F + (1-a)*K, a is the projection of (c-K) onto (F-K), and c' = (c - (1-a)*K)/a.
//    When c is not on the K-F line (a different colour, such as a dark crease), alpha falls
//    back to the linear chroma ramp.
// 3. Despill: any pixel left where R and B both exceed G is clamped to its nearest interior colour.
// 4. Profile v1-faithful hard-thresholds alpha at 128; shots flagged fringy get a 1 px erosion.
import { KEY, createImage } from "./image.mjs";

export function chromaCb(r, g, b) {
  return 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
}

export function chromaCr(r, g, b) {
  return 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
}

const KEY_CB = chromaCb(KEY[0], KEY[1], KEY[2]);
const KEY_CR = chromaCr(KEY[0], KEY[1], KEY[2]);

/** Distance from the key colour in the CbCr plane (0 at #FF00FF, about 140 for cream, black or orange). */
export function keyDistance(r, g, b) {
  return Math.hypot(chromaCb(r, g, b) - KEY_CB, chromaCr(r, g, b) - KEY_CR);
}

/** How magenta a colour is: above 0 only when R and B both exceed G. */
export function magentaRatio(r, g, b) {
  return (Math.min(r, b) - g) / Math.max(1, r, g, b);
}

export const KEYER_DEFAULTS = Object.freeze({
  t0: 6, // at or below: background (flat-magenta noise tolerance)
  t1: 96, // at or above: foreground (unless it sits on the ramp next to the key)
  radius: 8, // how far (px) to look for an interior colour
  residual: 48, // max distance of c from the K-F line for the projection to be trusted
  despill: 0.04, // magentaRatio above this is clamped to the interior colour
});

function bfsNearest(w, h, isSource, canEnter, radius) {
  const n = w * h;
  const near = new Int32Array(n).fill(-1);
  const depth = new Uint16Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    if (isSource[i]) {
      near[i] = i;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    if (depth[i] >= radius) continue;
    const x = i % w;
    const y = (i - x) / w;
    const nb = [
      x > 0 ? i - 1 : -1,
      x < w - 1 ? i + 1 : -1,
      y > 0 ? i - w : -1,
      y < h - 1 ? i + w : -1,
    ];
    for (const j of nb) {
      if (j < 0 || near[j] !== -1 || !canEnter[j]) continue;
      near[j] = near[i];
      depth[j] = depth[i] + 1;
      queue[tail++] = j;
    }
  }
  return near;
}

/**
 * Keys a raw export. Input alpha is honoured by compositing over the key first.
 * @param {{width:number,height:number,data:Uint8Array}} raw
 * @param {{profile?: string, fringy?: boolean} & Partial<typeof KEYER_DEFAULTS>} [options]
 */
export function softKey(raw, options = {}) {
  const o = { ...KEYER_DEFAULTS, ...options };
  const { width: w, height: h } = raw;
  const n = w * h;
  const col = new Float32Array(n * 3);
  const dist = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const a = raw.data[p + 3] / 255;
    const r = raw.data[p] * a + KEY[0] * (1 - a);
    const g = raw.data[p + 1] * a + KEY[1] * (1 - a);
    const b = raw.data[p + 2] * a + KEY[2] * (1 - a);
    col[i * 3] = r;
    col[i * 3 + 1] = g;
    col[i * 3 + 2] = b;
    dist[i] = keyDistance(r, g, b);
  }
  const fg = new Uint8Array(n);
  const seed = new Uint8Array(n);
  const notBg = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    fg[i] = dist[i] >= o.t1 ? 1 : 0;
    notBg[i] = dist[i] > o.t0 ? 1 : 0;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!fg[i]) continue;
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          if (!fg[yy * w + xx]) {
            ok = false;
            break;
          }
        }
      }
      seed[i] = ok ? 1 : 0;
    }
  }
  const nearSeed = bfsNearest(w, h, seed, notBg, o.radius);
  const nearFg = bfsNearest(w, h, fg, notBg, o.radius);

  const out = createImage(w, h);
  const project = (i, s) => {
    const fr = col[s * 3] - KEY[0];
    const fgc = col[s * 3 + 1] - KEY[1];
    const fb = col[s * 3 + 2] - KEY[2];
    const len2 = fr * fr + fgc * fgc + fb * fb;
    if (len2 < 1) return null;
    const cr = col[i * 3] - KEY[0];
    const cg = col[i * 3 + 1] - KEY[1];
    const cb = col[i * 3 + 2] - KEY[2];
    const ap = (cr * fr + cg * fgc + cb * fb) / len2;
    const res = Math.hypot(cr - ap * fr, cg - ap * fgc, cb - ap * fb);
    return { a: Math.min(1, Math.max(0, ap)), res, s };
  };
  for (let i = 0; i < n; i++) {
    if (!notBg[i]) continue;
    const d = dist[i];
    let a;
    let ref = -1;
    if (seed[i]) {
      a = 1;
      ref = i;
    } else {
      const lin = d >= o.t1 ? 1 : (d - o.t0) / (o.t1 - o.t0);
      // Prefer the true interior colour; fall back to the nearest other foreground pixel (a thin
      // dark line has no interior of its own). A pixel never unmixes against itself.
      let best = null;
      for (const s of [nearSeed[i], nearFg[i]]) {
        if (s < 0 || s === i) continue;
        const pr = project(i, s);
        if (pr && pr.res <= o.residual) {
          best = pr;
          break;
        }
      }
      if (best) {
        a = best.a;
        ref = best.s;
      } else {
        a = lin;
        ref = nearSeed[i] >= 0 ? nearSeed[i] : nearFg[i];
      }
    }
    if (a < 0.5 / 255) continue;
    let r = (col[i * 3] - (1 - a) * KEY[0]) / a;
    let g = (col[i * 3 + 1] - (1 - a) * KEY[1]) / a;
    let b = (col[i * 3 + 2] - (1 - a) * KEY[2]) / a;
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    if (magentaRatio(r, g, b) > o.despill) {
      if (
        ref >= 0 &&
        ref !== i &&
        magentaRatio(col[ref * 3], col[ref * 3 + 1], col[ref * 3 + 2]) <= o.despill
      ) {
        r = col[ref * 3];
        g = col[ref * 3 + 1];
        b = col[ref * 3 + 2];
      } else {
        g = Math.max(g, Math.min(r, b));
      }
    }
    const p = i * 4;
    out.data[p] = Math.round(r);
    out.data[p + 1] = Math.round(g);
    out.data[p + 2] = Math.round(b);
    out.data[p + 3] = Math.round(a * 255);
  }
  if (options.fringy) erodeAlpha(out);
  if (options.profile === "v1-faithful") thresholdAlpha(out, 128);
  return out;
}

export function thresholdAlpha(img, t = 128) {
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= t ? 255 : 0;
  return img;
}

/** 1 px alpha erosion (4-neighbourhood); used only for shots flagged fringy. */
export function erodeAlpha(img) {
  const { width: w, height: h, data } = img;
  const a = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = data[i * 4 + 3];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let m = a[i];
      if (x > 0) m = Math.min(m, a[i - 1]);
      if (x < w - 1) m = Math.min(m, a[i + 1]);
      if (y > 0) m = Math.min(m, a[i - w]);
      if (y < h - 1) m = Math.min(m, a[i + w]);
      data[i * 4 + 3] = m;
    }
  }
  return img;
}

/**
 * Looks at the outer border of a raw export before keying. A flat magenta border is fine;
 * a painted grey-and-white checkerboard (an AI "transparent" background) is rejected.
 */
export function inspectBackground(img) {
  const { width: w, height: h, data } = img;
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.02));
  let total = 0;
  let magenta = 0;
  let neutral = 0;
  let bright = 0;
  let mid = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= band && y >= band && x < w - band && y < h - band) continue;
      const p = (y * w + x) * 4;
      total++;
      if (data[p + 3] < 128) {
        magenta++;
        continue;
      }
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      if (keyDistance(r, g, b) <= 36) magenta++;
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      if (mx - mn <= 20 && mn >= 140) {
        neutral++;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum >= 235) bright++;
        else mid++;
      }
    }
  }
  const magentaShare = magenta / total;
  const checkerboard =
    magentaShare < 0.5 && neutral / total >= 0.6 && bright / total >= 0.15 && mid / total >= 0.15;
  let message = null;
  if (checkerboard) message = "painted checkerboard background: regenerate on #FF00FF";
  else if (magentaShare < 0.9)
    message = `background is not flat magenta (${Math.round(magentaShare * 100)}% of the border is #FF00FF): regenerate on #FF00FF`;
  return { ok: !message, checkerboard, magentaShare, message };
}

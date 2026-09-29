// Small RGBA image helpers on top of pngjs, the only PNG codec the art pipeline uses.
// An image is { width, height, data } with data a Uint8Array of straight (not premultiplied) RGBA.
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

/** The flat background colour Cameron's exports are painted on (plan D19). */
export const KEY = [255, 0, 255];

export function createImage(width, height, rgba = [0, 0, 0, 0]) {
  const data = new Uint8Array(width * height * 4);
  if (rgba[0] || rgba[1] || rgba[2] || rgba[3]) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = rgba[0];
      data[i + 1] = rgba[1];
      data[i + 2] = rgba[2];
      data[i + 3] = rgba[3];
    }
  }
  return { width, height, data };
}

export function cloneImage(img) {
  return { width: img.width, height: img.height, data: img.data.slice() };
}

export function decodePng(buf) {
  const png = PNG.sync.read(
    Buffer.isBuffer(buf) ? buf : Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength),
  );
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

export function encodePng(img) {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength);
  return PNG.sync.write(png, { colorType: 6 });
}

export function readPng(file) {
  return decodePng(fs.readFileSync(file));
}

export function writePng(file, img) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodePng(img));
}

/** Reads a PNG with pngjs. WebP and JPG go through sharp, which the repo already has as a dev dependency. */
export async function readImageFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return readPng(file);
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

/** Composites the image over a solid colour; the result is fully opaque. */
export function flatten(img, rgb) {
  const out = createImage(img.width, img.height);
  const s = img.data;
  const d = out.data;
  for (let i = 0; i < s.length; i += 4) {
    const a = s[i + 3] / 255;
    d[i] = Math.round(s[i] * a + rgb[0] * (1 - a));
    d[i + 1] = Math.round(s[i + 1] * a + rgb[1] * (1 - a));
    d[i + 2] = Math.round(s[i + 2] * a + rgb[2] * (1 - a));
    d[i + 3] = 255;
  }
  return out;
}

export function scaleNearest(img, k) {
  const out = createImage(img.width * k, img.height * k);
  for (let y = 0; y < out.height; y++) {
    const sy = Math.floor(y / k);
    for (let x = 0; x < out.width; x++) {
      const sp = (sy * img.width + Math.floor(x / k)) * 4;
      const dp = (y * out.width + x) * 4;
      out.data[dp] = img.data[sp];
      out.data[dp + 1] = img.data[sp + 1];
      out.data[dp + 2] = img.data[sp + 2];
      out.data[dp + 3] = img.data[sp + 3];
    }
  }
  return out;
}

function axisWeights(srcLen, dstLen) {
  const scale = srcLen / dstLen;
  const out = [];
  for (let o = 0; o < dstLen; o++) {
    let a = o * scale;
    let b = (o + 1) * scale;
    if (scale < 1) {
      const c = (o + 0.5) * scale;
      a = c - 0.5;
      b = c + 0.5;
    }
    const i0 = Math.max(0, Math.floor(a));
    const i1 = Math.min(srcLen, Math.ceil(b));
    const w = [];
    let sum = 0;
    for (let i = i0; i < i1; i++) {
      const ov = Math.min(b, i + 1) - Math.max(a, i);
      if (ov > 1e-9) {
        w.push([i, ov]);
        sum += ov;
      }
    }
    out.push(w.map(([i, v]) => [i, v / sum]));
  }
  return out;
}

/** Area-averaging resize in premultiplied alpha (no dark or magenta fringes from transparent pixels). */
export function resize(img, dw, dh) {
  const { width: sw, height: sh, data } = img;
  const wx = axisWeights(sw, dw);
  const wy = axisWeights(sh, dh);
  const tmp = new Float64Array(dw * sh * 4);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < dw; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (const [i, w] of wx[x]) {
        const p = (y * sw + i) * 4;
        const al = data[p + 3] * w;
        r += data[p] * al;
        g += data[p + 1] * al;
        b += data[p + 2] * al;
        a += al;
      }
      const q = (y * dw + x) * 4;
      tmp[q] = r;
      tmp[q + 1] = g;
      tmp[q + 2] = b;
      tmp[q + 3] = a;
    }
  }
  const out = createImage(dw, dh);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (const [j, w] of wy[y]) {
        const q = (j * dw + x) * 4;
        r += tmp[q] * w;
        g += tmp[q + 1] * w;
        b += tmp[q + 2] * w;
        a += tmp[q + 3] * w;
      }
      const o = (y * dw + x) * 4;
      if (a > 1e-6) {
        out.data[o] = Math.min(255, Math.round(r / a));
        out.data[o + 1] = Math.min(255, Math.round(g / a));
        out.data[o + 2] = Math.min(255, Math.round(b / a));
        out.data[o + 3] = Math.min(255, Math.round(a));
      }
    }
  }
  return out;
}

/** Scales about (cx, cy), then translates by (tx, ty). Bilinear, premultiplied. */
export function warp(img, scale, tx, ty, cx = img.width / 2, cy = img.height / 2) {
  const out = createImage(img.width, img.height);
  const { width: w, height: h, data } = img;
  const px = (x, y, c) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : data[(y * w + x) * 4 + c]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = (x + 0.5 - tx - cx) / scale + cx - 0.5;
      const sy = (y + 0.5 - ty - cy) / scale + cy - 0.5;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (const [xx, yy, wt] of [
        [x0, y0, (1 - fx) * (1 - fy)],
        [x0 + 1, y0, fx * (1 - fy)],
        [x0, y0 + 1, (1 - fx) * fy],
        [x0 + 1, y0 + 1, fx * fy],
      ]) {
        const al = px(xx, yy, 3) * wt;
        r += px(xx, yy, 0) * al;
        g += px(xx, yy, 1) * al;
        b += px(xx, yy, 2) * al;
        a += al;
      }
      if (a > 1e-6) {
        const o = (y * w + x) * 4;
        out.data[o] = Math.round(r / a);
        out.data[o + 1] = Math.round(g / a);
        out.data[o + 2] = Math.round(b / a);
        out.data[o + 3] = Math.round(a);
      }
    }
  }
  return out;
}

export function crop(img, x, y, w, h) {
  const out = createImage(w, h);
  blit(out, img, -x, -y);
  return out;
}

/** Copies src into dst at (dx, dy), overwriting, clipped to dst. */
export function blit(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= dst.width) continue;
      const s = (y * src.width + x) * 4;
      const d = (ty * dst.width + tx) * 4;
      dst.data[d] = src.data[s];
      dst.data[d + 1] = src.data[s + 1];
      dst.data[d + 2] = src.data[s + 2];
      dst.data[d + 3] = src.data[s + 3];
    }
  }
}

/** Alpha-composites src over dst at (dx, dy). */
export function drawOver(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= dst.width) continue;
      const s = (y * src.width + x) * 4;
      const sa = src.data[s + 3] / 255;
      if (sa === 0) continue;
      const d = (ty * dst.width + tx) * 4;
      const da = dst.data[d + 3] / 255;
      const oa = sa + da * (1 - sa);
      for (let c = 0; c < 3; c++) {
        dst.data[d + c] = Math.round((src.data[s + c] * sa + dst.data[d + c] * da * (1 - sa)) / oa);
      }
      dst.data[d + 3] = Math.round(oa * 255);
    }
  }
}

export function setPixel(img, x, y, rgba) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  img.data.set(rgba, (y * img.width + x) * 4);
}

export function fillRect(img, x, y, w, h, rgba) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPixel(img, xx, yy, rgba);
}

export function strokeRect(img, x, y, w, h, rgba) {
  for (let i = 0; i < w; i++) {
    setPixel(img, x + i, y, rgba);
    setPixel(img, x + i, y + h - 1, rgba);
  }
  for (let i = 0; i < h; i++) {
    setPixel(img, x, y + i, rgba);
    setPixel(img, x + w - 1, y + i, rgba);
  }
}

export function strokeCircle(img, cx, cy, r, rgba) {
  const steps = Math.max(16, Math.ceil(r * 8));
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    setPixel(img, cx + Math.cos(t) * r, cy + Math.sin(t) * r, rgba);
  }
}

// The review contact sheet (ART_SHOTLIST section 7, step 5): every frame on the dark and light
// Win11 taskbar greys with the y=240 line, anchor cross, bbox, eyes and ledge line, a status
// label, and a size ladder of earl_sit_idle_01.
import {
  createImage,
  drawOver,
  fillRect,
  resize,
  setPixel,
  strokeCircle,
  strokeRect,
} from "./image.mjs";

// 3x5 pixel font, rows top to bottom, 3 bits per row.
const GLYPHS = {
  A: "010101111101101",
  B: "110101110101110",
  C: "011100100100011",
  D: "110101101101110",
  E: "111100110100111",
  F: "111100110100100",
  G: "011100101101011",
  H: "101101111101101",
  I: "111010010010111",
  J: "001001001101010",
  K: "101101110101101",
  L: "100100100100111",
  M: "101111111101101",
  N: "110101101101101",
  O: "010101101101010",
  P: "110101110100100",
  Q: "010101101110011",
  R: "110101110101101",
  S: "011100010001110",
  T: "111010010010010",
  U: "101101101101111",
  V: "101101101101010",
  W: "101101111111101",
  X: "101101010101101",
  Y: "101101010010010",
  Z: "111001010100111",
  0: "111101101101111",
  1: "010110010010111",
  2: "110001010100111",
  3: "110001010001110",
  4: "101101111001001",
  5: "111100110001110",
  6: "011100111101111",
  7: "111001010010010",
  8: "111101111101111",
  9: "111101111001110",
  _: "000000000000111",
  "-": "000000111000000",
  ":": "000010000010000",
  "/": "001001010100100",
  ".": "000000000000010",
  ",": "000000000010100",
  "(": "010100100100010",
  ")": "010001001001010",
  "%": "101001010100101",
  " ": "000000000000000",
};

export function drawText(img, x, y, text, rgba, scale = 2) {
  let cx = x;
  for (const ch of String(text).toUpperCase()) {
    const g = GLYPHS[ch] || GLYPHS[" "];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (g[r * 3 + c] === "1")
          for (let dy = 0; dy < scale; dy++)
            for (let dx = 0; dx < scale; dx++)
              setPixel(img, cx + c * scale + dx, y + r * scale + dy, rgba);
      }
    }
    cx += 4 * scale;
  }
  return cx;
}

const DARK = [0x20, 0x20, 0x20, 255];
const LIGHT = [0xf3, 0xf3, 0xf3, 255];
const STATUS_COLOUR = {
  OK: [46, 160, 67, 255],
  WARN: [210, 153, 34, 255],
  ERR: [218, 54, 51, 255],
  PLACEHOLDER: [56, 132, 244, 255],
  MISSING: [120, 120, 120, 255],
  FINAL: [46, 160, 67, 255],
};

function panel(img, x, y, size, bg, res) {
  fillRect(img, x, y, size, size, bg);
  const f = res.frame;
  const [cw, ch] = f.shot.canvas;
  const k = size / Math.max(cw, ch);
  const ox = x + Math.round((size - cw * k) / 2);
  const oy = y + Math.round((size - ch * k) / 2);
  if (!res.l1) return;
  const shown = resize(res.l1, Math.max(1, Math.round(cw * k)), Math.max(1, Math.round(ch * k)));
  drawOver(img, shown, ox, oy);
  const m = res.meta;
  const P = (vx, vy) => [ox + vx * k, oy + vy * k];
  if (m.anchorType === "gnd" || m.anchorType === "prop") {
    const gy = m.anchor[1];
    for (let i = 0; i < cw * k; i++) setPixel(img, ox + i, P(0, gy)[1], [230, 40, 40, 255]);
  }
  if (m.ledgeY != null)
    for (let i = 0; i < cw * k; i++) setPixel(img, ox + i, P(0, m.ledgeY)[1], [240, 200, 0, 255]);
  const [ax, ay] = P(m.anchor[0], m.anchor[1]);
  for (let i = -4; i <= 4; i++) {
    setPixel(img, ax + i, ay, [255, 90, 0, 255]);
    setPixel(img, ax, ay + i, [255, 90, 0, 255]);
  }
  if (m.bbox) {
    const [bx, by] = P(m.bbox.x0, m.bbox.y0);
    strokeRect(
      img,
      Math.round(bx),
      Math.round(by),
      Math.max(1, Math.round(m.bbox.w * k)),
      Math.max(1, Math.round(m.bbox.h * k)),
      [0, 190, 210, 255],
    );
  }
  for (const e of m.eyes) {
    const [ex, ey] = P(e.x, e.y);
    strokeCircle(img, ex, ey, Math.max(2, e.r * k + 1), [60, 220, 90, 255]);
  }
}

/** Renders the whole sheet. `all` comes from computeAll(). */
export function renderContactSheet(all, { cell = 128, cols = 4, title = "" } = {}) {
  const pad = 8;
  const labelH = 28;
  const cellW = cell * 2 + pad * 3;
  const cellH = cell + labelH + pad;
  const ladder = [48, 64, 96, 128, 256];
  const headerH = 30 + 256 + pad * 2;
  const rows = Math.ceil(all.frames.length / cols);
  const W = cols * cellW + pad;
  const H = headerH + rows * cellH + pad;
  const img = createImage(W, H, [44, 44, 48, 255]);
  drawText(img, pad, pad, title || "earl art contact sheet", [240, 240, 240, 255]);
  const ref = all.results.get("earl_sit_idle_01");
  let lx = pad;
  for (const size of ladder) {
    for (const [bg, dy] of [
      [DARK, 0],
      [LIGHT, size + 4],
    ]) {
      if (30 + dy + size > headerH) continue;
      fillRect(img, lx, 30 + dy, size, size, bg);
      if (ref?.l1) drawOver(img, resize(ref.l1, size, size), lx, 30 + dy);
    }
    drawText(img, lx, 22, `${size}`, [200, 200, 200, 255], 1);
    lx += size + pad;
  }
  all.frames.forEach((f, i) => {
    const res = all.results.get(f.id);
    const x = pad + (i % cols) * cellW;
    const y = headerH + Math.floor(i / cols) * cellH;
    panel(img, x + pad, y, cell, DARK, res);
    panel(img, x + pad * 2 + cell, y, cell, LIGHT, res);
    const status = res.final ? "FINAL" : res.status;
    fillRect(img, x + pad, y + cell + 2, 10, 10, STATUS_COLOUR[status]);
    drawText(img, x + pad + 14, y + cell + 2, f.id, [235, 235, 235, 255]);
    const note = res.issues.length
      ? `${status} ${f.tier} ${res.issues.map((is) => is.code).join(",")}`
      : `${status} ${f.tier}`;
    drawText(img, x + pad + 14, y + cell + 15, note.slice(0, 30), STATUS_COLOUR[status]);
  });
  return img;
}

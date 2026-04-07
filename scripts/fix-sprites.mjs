/**
 * fix-sprites.mjs
 * Removes checkerboard transparency artifacts from AI-generated sprite PNGs
 * using flood-fill from the image edges. This ensures only the background
 * checkerboard is removed — Earl's body pixels are never touched.
 */

import fs from "fs";
import path from "path";
import { PNG } from "pngjs";

const SPRITES_DIR = path.resolve("assets/sprites");
const SRC_SPRITES_DIR = path.resolve("src/assets/sprites");

const TOLERANCE = 35;

function isCheckerboardColor(r, g, b) {
  const isWhitish = r > 220 && g > 220 && b > 220;
  const isGrayish =
    r > 170 && r < 215 &&
    g > 170 && g < 215 &&
    b > 170 && b < 215 &&
    Math.abs(r - g) < TOLERANCE &&
    Math.abs(r - b) < TOLERANCE &&
    Math.abs(g - b) < TOLERANCE;
  return isWhitish || isGrayish;
}

function processSprite(filePath) {
  const data = fs.readFileSync(filePath);
  const png = PNG.sync.read(data);
  const { width, height } = png;

  const toRemove = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const queue = [];

  for (let x = 0; x < width; x++) {
    seedPixel(x, 0);
    seedPixel(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    seedPixel(0, y);
    seedPixel(width - 1, y);
  }

  function seedPixel(x, y) {
    const i = y * width + x;
    if (visited[i]) return;
    const idx = i * 4;
    const r = png.data[idx], g = png.data[idx+1], b = png.data[idx+2], a = png.data[idx+3];
    if (a === 0) { visited[i] = 1; toRemove[i] = 1; queue.push(i); return; }
    if (isCheckerboardColor(r, g, b)) { visited[i] = 1; toRemove[i] = 1; queue.push(i); }
  }

  while (queue.length > 0) {
    const i = queue.shift();
    const x = i % width, y = Math.floor(i / width);
    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = ny * width + nx;
      if (visited[ni]) continue;
      visited[ni] = 1;
      const idx = ni * 4;
      const r = png.data[idx], g = png.data[idx+1], b = png.data[idx+2], a = png.data[idx+3];
      if (a === 0) { toRemove[ni] = 1; queue.push(ni); continue; }
      if (isCheckerboardColor(r, g, b)) { toRemove[ni] = 1; queue.push(ni); }
    }
  }

  let changed = 0;
  for (let i = 0; i < width * height; i++) {
    if (toRemove[i] && png.data[i * 4 + 3] !== 0) { png.data[i * 4 + 3] = 0; changed++; }
  }

  // Multiple passes to clean edge speckles
  for (let pass = 0; pass < 4; pass++) {
    let passChanged = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const a = png.data[idx + 3];
        if (a === 0) continue;
        const r = png.data[idx], g = png.data[idx+1], b = png.data[idx+2];
        if (!isCheckerboardColor(r, g, b)) continue;

        let tn = 0, total = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x+dx, ny = y+dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) { tn++; total++; continue; }
            total++;
            if (png.data[(ny*width+nx)*4+3] === 0) tn++;
          }
        }
        const threshold = a < 200 ? 2 : 4;
        if (tn >= threshold) { png.data[idx+3] = 0; passChanged++; changed++; }
      }
    }
    if (passChanged === 0) break;
  }

  if (changed > 0) {
    fs.writeFileSync(filePath, PNG.sync.write(png));
    console.log("  Fixed " + path.basename(filePath) + " — " + changed + " pixels");
  } else {
    console.log("  Skipped " + path.basename(filePath));
  }
  return changed;
}

const files = fs.readdirSync(SPRITES_DIR).filter(f => f.endsWith(".png"));
console.log("Processing " + files.length + " sprites...\n");
let total = 0;
for (const file of files) total += processSprite(path.join(SPRITES_DIR, file));
console.log("\nCopying to src/assets/sprites/...");
for (const file of files) fs.copyFileSync(path.join(SPRITES_DIR, file), path.join(SRC_SPRITES_DIR, file));
console.log("Done! Fixed " + total + " total pixels.");

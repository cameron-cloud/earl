// Synthetic art for the art pipeline tests: anti-aliased discs on flat magenta, drawn by supersampling.
import { createImage, type Img } from "../../scripts/art/lib/index.mjs";

export type RGB = readonly [number, number, number];
export const CREAM: RGB = [0xf8, 0xe9, 0xc7];
export const MAGENTA: RGB = [255, 0, 255];

export interface Disc {
  cx: number;
  cy: number;
  r: number;
  colour: RGB;
  /** Paints the disc as a hole back to the background colour. */
  cut?: boolean;
}

/** Exact coverage of each pixel by the discs (8x8 supersampling), composited over `bg`. */
export function paint(
  w: number,
  h: number,
  bg: RGB,
  discs: Disc[],
  ss = 8,
): { img: Img; coverage: Float64Array } {
  const img = createImage(w, h, [...bg, 255]);
  const coverage = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let cov = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = x + (sx + 0.5) / ss;
          const py = y + (sy + 0.5) / ss;
          let c: RGB = bg;
          let inside = false;
          for (const d of discs) {
            if ((px - d.cx) ** 2 + (py - d.cy) ** 2 <= d.r * d.r) {
              c = d.cut ? bg : d.colour;
              inside = !d.cut;
            }
          }
          r += c[0];
          g += c[1];
          b += c[2];
          if (inside) cov++;
        }
      }
      const n = ss * ss;
      const p = (y * w + x) * 4;
      img.data[p] = Math.round(r / n);
      img.data[p + 1] = Math.round(g / n);
      img.data[p + 2] = Math.round(b / n);
      coverage[y * w + x] = cov / n;
    }
  }
  return { img, coverage };
}

/** A front-facing duck stand-in: cream body disc with two solid black eyes 22 px across. */
export function duck(w = 256, h = 256, dx = 0, dy = 0, bodyColour: RGB = CREAM): Disc[] {
  const discs: Disc[] = [
    { cx: 128 + dx, cy: 150 + dy, r: 90, colour: bodyColour },
    { cx: 97 + dx, cy: 120 + dy, r: 11, colour: [0, 0, 0] },
    { cx: 159 + dx, cy: 120 + dy, r: 11, colour: [0, 0, 0] },
  ];
  return discs.map((d) => ({
    ...d,
    cx: (d.cx * w) / 256,
    cy: (d.cy * h) / 256,
    r: (d.r * w) / 256,
  }));
}

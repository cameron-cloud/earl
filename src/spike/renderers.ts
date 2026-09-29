// The two renderer modes D14 chooses between. M0.4 spike only.

export const SIZE = 96; // Earl's box, CSS px

export interface Renderer {
  /** Draw `frame` with its top-left at (x, y) in CSS px. Cheap when nothing changed. */
  draw(frame: CanvasImageSource, x: number, y: number): void;
  /** Canvas repaints since start (a moved layer is NOT a repaint). */
  readonly repaints: number;
  readonly name: "layers" | "canvas";
}

function context2d(el: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("2d canvas context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

const snap = (v: number, dpr: number): number => Math.round(v * dpr) / dpr;

/**
 * Layers mode (D14 primary): one small DPR-correct canvas, repainted only when
 * the frame changes, moved with translate3d at device-pixel-snapped positions.
 * Movement is compositor-only.
 */
export class LayersRenderer implements Renderer {
  readonly name = "layers" as const;
  repaints = 0;
  private readonly el: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly px: number;
  private lastFrame: CanvasImageSource | null = null;
  private lastTransform = "";

  constructor(
    root: HTMLElement,
    private readonly dpr: number,
  ) {
    this.px = Math.round(SIZE * dpr);
    this.el = document.createElement("canvas");
    this.el.width = this.px;
    this.el.height = this.px;
    this.el.style.cssText =
      `position:fixed;left:0;top:0;width:${SIZE}px;height:${SIZE}px;` +
      "will-change:transform;pointer-events:none;";
    root.appendChild(this.el);
    this.ctx = context2d(this.el);
  }

  draw(frame: CanvasImageSource, x: number, y: number): void {
    if (frame !== this.lastFrame) {
      this.ctx.clearRect(0, 0, this.px, this.px);
      this.ctx.drawImage(frame, 0, 0, this.px, this.px);
      this.lastFrame = frame;
      this.repaints++;
    }
    const t = `translate3d(${snap(x, this.dpr)}px,${snap(y, this.dpr)}px,0)`;
    if (t !== this.lastTransform) {
      this.el.style.transform = t;
      this.lastTransform = t;
    }
  }
}

interface DevRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function union(a: DevRect, b: DevRect): DevRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/**
 * Canvas mode (D14 fallback): one monitor-sized canvas. Each change clears the
 * union of the previous and current rects (a full clear past 35% of the
 * screen) and redraws.
 */
export class CanvasRenderer implements Renderer {
  readonly name = "canvas" as const;
  repaints = 0;
  private readonly el: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly px: number;
  private prev: DevRect | null = null;
  private lastFrame: CanvasImageSource | null = null;

  constructor(
    root: HTMLElement,
    private readonly dpr: number,
  ) {
    this.px = Math.round(SIZE * dpr);
    this.el = document.createElement("canvas");
    this.el.width = Math.round(window.innerWidth * dpr);
    this.el.height = Math.round(window.innerHeight * dpr);
    this.el.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;";
    root.appendChild(this.el);
    this.ctx = context2d(this.el);
  }

  draw(frame: CanvasImageSource, x: number, y: number): void {
    const cur: DevRect = { x: Math.round(x * this.dpr), y: Math.round(y * this.dpr), w: this.px, h: this.px };
    const p = this.prev;
    if (p && frame === this.lastFrame && p.x === cur.x && p.y === cur.y) return;
    const dirty = p ? union(p, cur) : cur;
    const { width, height } = this.el;
    if (dirty.w * dirty.h > 0.35 * width * height) {
      this.ctx.clearRect(0, 0, width, height);
    } else {
      // 1 device px of slack for smoothing at the edges.
      this.ctx.clearRect(dirty.x - 1, dirty.y - 1, dirty.w + 2, dirty.h + 2);
    }
    this.ctx.drawImage(frame, cur.x, cur.y, cur.w, cur.h);
    this.prev = cur;
    this.lastFrame = frame;
    this.repaints++;
  }
}

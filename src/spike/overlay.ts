// M0.4 spike overlay: Earl walks along the ground, can be hovered, clicked,
// dragged and dropped. THROWAWAY; the real overlay is built in M1.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import walkSide from "../assets/sprites/walk_side.png";
import walkStep1 from "../assets/sprites/Walk_step_1.png";
import walkStep2 from "../assets/sprites/Walk_step_2.png";
import walkSideL from "../assets/sprites/walk_side_left.png";
import walkStep1L from "../assets/sprites/Walk_step_1_left.png";
import walkStep2L from "../assets/sprites/Walk_step_2_left.png";
import { CanvasRenderer, LayersRenderer, SIZE, type Renderer } from "./renderers";

interface InitReply {
  mode: "layers" | "canvas";
  still: boolean;
  hud: boolean;
  visible: boolean;
  recovered: boolean;
  groundY: number;
  taskbarEdge: string;
  scale: number;
  dpiScale: number;
  overlayPhys: [number, number, number, number];
  platform: string;
}

interface Stats {
  sethitPosts: number;
  activations: number;
  foregroundHits: number;
  styleRewrites: number;
  pointerPolls: number;
  regionPushes: number;
  hoverEvents: number;
  heartbeats: number;
  deadmanTrips: number;
}

const SPEED = 55; // CSS px per second
const FRAME_MS = 150; // docs/ANIMATIONS.md walk timing
const GRAVITY = 2400; // CSS px per second squared
const HOP_SPEED = 620;
const HIT_MIN_MS = 33; // at most 30 region pushes per second
const EARL_REGION = 1;

// Contextmenu never shows (right-click is "pet", plan 4.1).
window.addEventListener("contextmenu", (e) => e.preventDefault(), { capture: true });

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

/** Union of the opaque pixels of all frames, as fractions of the frame box. */
function opaqueBounds(frames: HTMLImageElement[]): { l: number; t: number; r: number; b: number } {
  const full = { l: 0, t: 0, r: 1, b: 1 };
  try {
    const n = 128;
    const c = document.createElement("canvas");
    c.width = n;
    c.height = n;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return full;
    let l = n;
    let t = n;
    let r = -1;
    let b = -1;
    for (const f of frames) {
      ctx.clearRect(0, 0, n, n);
      ctx.drawImage(f, 0, 0, n, n);
      const d = ctx.getImageData(0, 0, n, n).data;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if (d[(y * n + x) * 4 + 3] > 24) {
            if (x < l) l = x;
            if (x > r) r = x;
            if (y < t) t = y;
            if (y > b) b = y;
          }
        }
      }
    }
    if (r < l || b < t) return full;
    return { l: l / n, t: t / n, r: (r + 1) / n, b: (b + 1) / n };
  } catch {
    return full;
  }
}

async function main(): Promise<void> {
  const init = await invoke<InitReply>("platform_init", {
    info: { innerWidth: window.innerWidth, innerHeight: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
  });
  const dpr = window.devicePixelRatio || 1;
  const right = await Promise.all([walkSide, walkStep1, walkSide, walkStep2].map(loadImage));
  const left = await Promise.all([walkSideL, walkStep1L, walkSideL, walkStep2L].map(loadImage));
  const bounds = opaqueBounds([...right, ...left]);
  const footPad = (1 - bounds.b) * SIZE; // transparent rows under his feet

  const renderer: Renderer =
    init.mode === "canvas" ? new CanvasRenderer(document.body, dpr) : new LayersRenderer(document.body, dpr);

  // World state, CSS px. (x, y) is the top-left of his 96 px box.
  let groundY = init.groundY;
  let taskbarEdge = init.taskbarEdge;
  const floorTop = (): number => groundY - SIZE + footPad;
  const maxX = (): number => Math.max(0, window.innerWidth - SIZE);
  let x = Math.round(maxX() * 0.5);
  let y = floorTop();
  let dir: 1 | -1 = 1;
  let walking = !init.still;
  let hovered = false;
  let visible = init.visible;
  let vy = 0;
  let airborne = false;
  let animMs = 0;

  // Pointer interaction.
  let press: { id: number; px: number; py: number; ex: number; ey: number; t: number } | null = null;
  let dragging = false;

  // Counters for the HUD.
  let rafFrames = 0;
  let regionIpc = 0;
  let lastHitKey = "";
  let lastHitSent = -Infinity;

  const hitRect = () => ({
    x: Math.round(x + bounds.l * SIZE),
    y: Math.round(y + bounds.t * SIZE),
    w: Math.round((bounds.r - bounds.l) * SIZE),
    h: Math.round((bounds.b - bounds.t) * SIZE),
  });
  const hitKey = (): string => {
    if (!visible) return "none";
    const r = hitRect();
    return `${r.x},${r.y},${r.w},${r.h}`;
  };
  const inside = (cx: number, cy: number): boolean => {
    const r = hitRect();
    return cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h;
  };

  function pushHit(now: number, force = false): void {
    const key = hitKey();
    if (key === lastHitKey) return;
    if (!force && now - lastHitSent < HIT_MIN_MS) return;
    lastHitKey = key;
    lastHitSent = now;
    regionIpc++;
    const regions = visible ? [{ id: EARL_REGION, rect: hitRect() }] : [];
    void invoke("hit_set_regions", { regions });
  }

  // Plan 4.3 dead-man switch feed: Rust empties the regions after 2 s without a
  // push or heartbeat, so a hung page can never block the desktop. Sent only
  // when no push went out in the last half second (never while walking).
  const HEARTBEAT_MS = 1000;
  window.setInterval(() => {
    if (!visible || performance.now() - lastHitSent < HEARTBEAT_MS / 2) return;
    void invoke<boolean>("hit_heartbeat").then((resend) => {
      if (!resend) return;
      lastHitKey = ""; // the switch dropped them meanwhile: send them again
      pushHit(performance.now(), true);
    });
  }, HEARTBEAT_MS);

  function frameFor(): HTMLImageElement {
    const set = dir === 1 ? right : left;
    if (!walking || hovered || dragging || airborne) return set[0];
    return set[Math.floor(animMs / FRAME_MS) % set.length];
  }

  let raf = 0;
  let last = 0;
  const needsLoop = (): boolean =>
    visible && ((walking && !hovered) || dragging || airborne || press !== null || hitKey() !== lastHitKey);

  function tick(now: number): void {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    rafFrames++;
    if (press && !dragging && now - press.t >= 200) startDrag(press.id); // pickup on a 200 ms hold
    if (dragging) {
      // Position is set by pointermove.
    } else if (airborne) {
      vy += GRAVITY * dt;
      y += vy * dt;
      if (y >= floorTop()) {
        y = floorTop();
        vy = 0;
        airborne = false;
      }
    } else if (walking && !hovered) {
      x += dir * SPEED * dt;
      animMs += dt * 1000;
      if (x <= 0) {
        x = 0;
        dir = 1;
      } else if (x >= maxX()) {
        x = maxX();
        dir = -1;
      }
    }
    renderer.draw(frameFor(), x, y);
    pushHit(now);
    raf = needsLoop() ? requestAnimationFrame(tick) : 0;
  }

  function kick(): void {
    if (raf === 0 && visible) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }

  // ---- Pointer: click turns him around, drag moves him, right-click hops.
  window.addEventListener("pointerdown", (e) => {
    if (!inside(e.clientX, e.clientY)) return;
    if (e.button === 2) {
      if (!airborne && !dragging) {
        airborne = true;
        vy = -HOP_SPEED;
        kick();
      }
      return;
    }
    if (e.button !== 0) return;
    press = { id: e.pointerId, px: e.clientX, py: e.clientY, ex: x, ey: y, t: performance.now() };
    kick();
  });

  function startDrag(pointerId: number): void {
    dragging = true;
    airborne = false;
    try {
      document.body.setPointerCapture(pointerId);
    } catch {
      // The pointer may already be gone; the Rust latch still holds.
    }
    void invoke("hit_capture", { on: true });
  }

  window.addEventListener("pointermove", (e) => {
    if (!press || e.pointerId !== press.id) return;
    const dx = e.clientX - press.px;
    const dy = e.clientY - press.py;
    if (!dragging && (Math.hypot(dx, dy) >= 6 || performance.now() - press.t >= 200)) startDrag(e.pointerId);
    if (dragging) {
      x = Math.min(maxX(), Math.max(0, press.ex + dx));
      y = Math.min(floorTop(), press.ey + dy);
      kick();
    }
  });

  function endPress(e: PointerEvent, cancelled: boolean): void {
    if (!press || e.pointerId !== press.id) return;
    const quick = performance.now() - press.t < 250;
    const still = Math.hypot(e.clientX - press.px, e.clientY - press.py) < 6;
    if (dragging) {
      dragging = false;
      void invoke("hit_capture", { on: false });
      if (y < floorTop()) {
        airborne = true;
        vy = 0;
      }
    } else if (!cancelled && quick && still) {
      dir = dir === 1 ? -1 : 1;
    }
    press = null;
    kick();
  }
  window.addEventListener("pointerup", (e) => endPress(e, false));
  window.addEventListener("pointercancel", (e) => endPress(e, true));
  document.body.addEventListener("lostpointercapture", (e) => endPress(e, true));

  // ---- HUD, refreshed once a second only while shown.
  const hud = document.getElementById("hud") as HTMLDivElement;
  let hudTimer = 0;
  let prev = { t: performance.now(), frames: 0, repaints: 0, ipc: 0, stats: null as Stats | null };

  async function refreshHud(): Promise<void> {
    const stats = await invoke<Stats>("spike_stats");
    const now = performance.now();
    const secs = Math.max(0.001, (now - prev.t) / 1000);
    const rate = (a: number, b: number): string => ((a - b) / secs).toFixed(1);
    const ps = prev.stats ?? stats;
    const [ox, oy, ow, oh] = init.overlayPhys;
    hud.textContent = [
      `Earl spike M0.4   renderer: ${renderer.name}   ${walking ? "walking" : "standing still"}${hovered ? "   (hovered)" : ""}`,
      `rAF frames/s ${rate(rafFrames, prev.frames)}   canvas repaints/s ${rate(renderer.repaints, prev.repaints)}   region IPC/s ${rate(regionIpc, prev.ipc)}`,
      `click-through switches ${stats.sethitPosts}   pointer polls/s ${rate(stats.pointerPolls, ps.pointerPolls)}`,
      `overlay activations ${stats.activations}   overlay became foreground ${stats.foregroundHits}   style rewrites ${stats.styleRewrites}`,
      `heartbeats ${stats.heartbeats}   dead-man trips ${stats.deadmanTrips}${init.recovered ? "   RESTARTED AFTER A HANG (write this down)" : ""}`,
      `ground y ${groundY.toFixed(1)} (taskbar: ${taskbarEdge})   DPR ${dpr}   scale ${init.scale.toFixed(3)}   dpi scale ${init.dpiScale.toFixed(3)}`,
      `overlay ${ow}x${oh} at (${ox},${oy}) physical px   page ${window.innerWidth}x${window.innerHeight} CSS px`,
      `Tray icon menu: switch renderer, walk / stand still, hide this panel, focus test page, quit.`,
    ].join("\n");
    prev = { t: now, frames: rafFrames, repaints: renderer.repaints, ipc: regionIpc, stats };
  }

  function setHud(show: boolean): void {
    hud.hidden = !show;
    window.clearInterval(hudTimer);
    hudTimer = 0;
    if (show) {
      void refreshHud();
      hudTimer = window.setInterval(() => void refreshHud(), 1000);
    }
  }

  // ---- Rust events.
  await listen<{ regionId: number | null }>("pointer://hover", (e) => {
    hovered = e.payload.regionId !== null;
    kick();
  });
  await listen<{ groundY: number; taskbarEdge: string }>("platform://ground", (e) => {
    groundY = e.payload.groundY;
    taskbarEdge = e.payload.taskbarEdge;
    if (!dragging && !airborne) y = floorTop();
    kick();
  });
  await listen("spike://reload", () => location.reload());
  await listen<boolean>("spike://visible", (e) => {
    visible = e.payload;
    pushHit(performance.now(), true);
    kick();
  });
  await listen<string>("spike://toggle", (e) => {
    if (e.payload === "walk") walking = !walking;
    if (e.payload === "hud") setHud(hud.hidden);
    kick();
  });

  // A resize means the window rect or DPI changed: start over cleanly.
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => location.reload(), 250);
  });

  setHud(init.hud);
  renderer.draw(frameFor(), x, y);
  pushHit(performance.now(), true);
  kick();
}

main().catch((err: unknown) => {
  const hud = document.getElementById("hud");
  if (hud) {
    hud.hidden = false;
    hud.textContent = `Earl spike failed to start:\n${String(err)}`;
  }
});

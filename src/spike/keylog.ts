// M0.4 focus test page: type here while interacting with Earl. Every focus
// loss, key and visibility change is logged with a timestamp.
import { invoke } from "@tauri-apps/api/core";

interface Stats {
  sethitPosts: number;
  activations: number;
  foregroundHits: number;
}

const status = document.getElementById("status") as HTMLDivElement;
const counters = document.getElementById("counters") as HTMLDivElement;
const log = document.getElementById("log") as HTMLDivElement;
const typing = document.getElementById("typing") as HTMLTextAreaElement;
const reset = document.getElementById("reset") as HTMLButtonElement;

const MAX_LOG_LINES = 400;
let keys = 0;
let focusLosses = 0;
let hiddenEvents = 0;
let rafFrames = 0;
let fps = 0;
let base: Stats = { sethitPosts: 0, activations: 0, foregroundHits: 0 };
let latest: Stats = base;

function stamp(): string {
  const d = new Date();
  const p = (n: number, w = 2): string => String(n).padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

function write(line: string): void {
  const row = document.createElement("div");
  row.textContent = `${stamp()}  ${line}`;
  log.prepend(row);
  while (log.childElementCount > MAX_LOG_LINES) log.lastElementChild?.remove();
}

function showFocus(): void {
  const has = document.hasFocus();
  status.className = has ? "ok" : "lost";
  status.textContent = has ? "This window has focus" : "FOCUS LOST - this window is no longer receiving your typing";
}

function render(): void {
  counters.textContent = "";
  const rows: [string, string | number][] = [
    ["keys typed", keys],
    ["focus losses (blur)", focusLosses],
    ["page hidden events", hiddenEvents],
    ["this page rAF frames/s", fps],
    ["Earl overlay activations", latest.activations - base.activations],
    ["Earl overlay became foreground", latest.foregroundHits - base.foregroundHits],
    ["click-through switches", latest.sethitPosts - base.sethitPosts],
    ["visibility now", document.visibilityState],
  ];
  for (const [k, v] of rows) {
    const cell = document.createElement("div");
    cell.textContent = `${k}: ${v}`;
    counters.appendChild(cell);
  }
}

window.addEventListener("keydown", (e) => {
  keys++;
  write(`key ${JSON.stringify(e.key)}${e.repeat ? " (repeat)" : ""}`);
});
window.addEventListener("blur", () => {
  focusLosses++;
  write("FOCUS LOST (window blur)");
  showFocus();
  render();
});
window.addEventListener("focus", () => {
  write("focus back (window focus)");
  showFocus();
  render();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") hiddenEvents++;
  write(`visibility: ${document.visibilityState}`);
  render();
});

reset.addEventListener("click", () => {
  keys = 0;
  focusLosses = 0;
  hiddenEvents = 0;
  base = latest;
  log.textContent = "";
  write("counters reset");
  render();
  typing.focus();
});

// This page's own frame rate: shows whether WebView2 throttles a window that
// sits under the full-monitor overlay (occlusion).
let windowStart = performance.now();
function frame(now: number): void {
  rafFrames++;
  if (now - windowStart >= 1000) {
    fps = Math.round((rafFrames * 1000) / (now - windowStart));
    rafFrames = 0;
    windowStart = now;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

async function poll(): Promise<void> {
  try {
    latest = await invoke<Stats>("spike_stats");
  } catch (err) {
    write(`stats unavailable: ${String(err)}`);
  }
  showFocus();
  render();
}
window.setInterval(() => void poll(), 1000);
void poll().then(() => {
  base = latest;
  render();
});
write("focus test page opened");
typing.focus();

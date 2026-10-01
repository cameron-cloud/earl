// art:import, art:build, art:check, art:status and art:templates on top of the library modules.
import fs from "node:fs";
import path from "node:path";
import { alignFrame, alignOverlay, anchorPoint } from "./align.mjs";
import * as A from "./analyze.mjs";
import {
  KEY,
  blit,
  createImage,
  crop,
  flatten,
  readImageFile,
  readPng,
  resize,
  scaleNearest,
  writePng,
  encodePng,
} from "./image.mjs";
import { inspectBackground, softKey, thresholdAlpha } from "./keyer.mjs";
import {
  SHOT_ID,
  attachExtraRows,
  buildShotsDoc,
  listFrames,
  catalogProblems,
  parseShotlist,
  promptCatalog,
  renderShotlist,
  resolvedAnchor,
} from "./shots.mjs";

export const PATHS = {
  shots: "art/shots.json",
  shotlist: "art/SHOTLIST.md",
  source: "docs/ART_SHOTLIST.md",
  masters: "art/masters",
  inbox: "art/inbox",
  out: "art/out",
  templates: "art/templates",
  atlas: "src/assets/atlas",
  gen: "src/sim/anim/sprites.gen.ts",
};
export const LEVELS = [256, 512];
const BODY_CREAM = [0xf8, 0xe9, 0xc7];

export function loadDoc(root) {
  return JSON.parse(fs.readFileSync(path.join(root, PATHS.shots), "utf8"));
}

/** Regenerates the shots document from docs/ART_SHOTLIST.md, keeping hand-kept fields. */
export function regenerateDoc(root, prev) {
  const parsed = parseShotlist(fs.readFileSync(path.join(root, PATHS.source), "utf8"));
  return attachExtraRows(buildShotsDoc(parsed, prev), parsed);
}

export const stringifyDoc = (doc) => JSON.stringify(doc, null, 2) + "\n";

/** Writes file only when its content changed (keeps Vite and mtimes quiet). */
export function writeIfChanged(file, content) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
  if (fs.existsSync(file) && fs.readFileSync(file).equals(buf)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return true;
}

function onCanvas(img, w, h) {
  if (img.width === w && img.height === h) return img;
  const out = createImage(w, h);
  blit(out, img, Math.round((w - img.width) / 2), Math.round((h - img.height) / 2));
  return out;
}

const spec = (frame, byId) => ({
  anchorType: resolvedAnchor(frame, byId),
  facing: frame.shot.facing,
  canvas: frame.shot.canvas,
});

/** Level images (256 and 512) from a master at the shot's master scale. */
export function levelsFromMaster(master, frame, profile) {
  const s = frame.shot.masterScale;
  if (s === 1) return { l1: master, l2: null };
  let l1 = resize(master, master.width / s, master.height / s);
  if (profile === "v1-faithful") l1 = thresholdAlpha(l1);
  return { l1, l2: master };
}

/** Silhouette overlap below which an expression edit counts as having moved the body. */
export const OVL_MIN_IOU = 0.97;

/**
 * Placeholder: v1 art keyed (composited on the key, then the same keyer), at 2x, aligned.
 * An overlay frame is lined up with its base only when the v1 drawing really is an edit of the
 * base (blink). Some v1 expressions (pouty, huffy) are separate drawings: overlaying those
 * lands the feet off the ground line, so they fall back to the base's anchor rules.
 */
export function placeholderLevels(v1, frame, byId, baseL1) {
  const keyed = softKey(flatten(v1, KEY), { profile: "v1-faithful" });
  const [cw, ch] = frame.shot.canvas;
  const k = Math.max(1, Math.round(Math.max(cw, ch) / Math.max(v1.width, v1.height)));
  const big = onCanvas(scaleNearest(keyed, k), cw, ch);
  let l1 = null;
  if (frame.anchor === "ovl" && baseL1) {
    const ovl = alignOverlay(big, baseL1);
    if (ovl.iou >= OVL_MIN_IOU) l1 = ovl.image;
  }
  l1 ??= alignFrame(big, spec(frame, byId), 1).image;
  return { l1, l2: frame.shot.masterScale === 2 ? scaleNearest(l1, 2) : null };
}

/** Keys, scales and aligns one raw export (or one strip segment when prekeyed) into a master. */
export function processRaw(
  raw,
  frame,
  byId,
  { profile, baseMaster = null, prekeyed = false, stripScale = null },
) {
  if (!prekeyed) {
    const bg = inspectBackground(raw);
    if (!bg.ok) throw new Error(bg.message);
  }
  const shot = frame.shot;
  const s = shot.masterScale;
  const keyed = prekeyed ? raw : softKey(raw, { profile, fringy: shot.fringy });
  const side = Math.max(...shot.canvas) * s;
  const f = stripScale ?? side / Math.max(raw.width, raw.height);
  let scaled = resize(
    keyed,
    Math.max(1, Math.round(keyed.width * f)),
    Math.max(1, Math.round(keyed.height * f)),
  );
  if (profile === "v1-faithful") scaled = thresholdAlpha(scaled);
  const cw = shot.canvas[0] * s;
  const ch = shot.canvas[1] * s;
  if (frame.anchor === "ovl") {
    if (!baseMaster)
      throw new Error(`expression edit needs its base master ${frame.base} imported first`);
    return alignOverlay(onCanvas(scaled, cw, ch), baseMaster).image;
  }
  return alignFrame(scaled, spec(frame, byId), s).image;
}

/** Splits a keyed strip on its magenta (now transparent) column gaps. */
export function splitStrip(keyed, count) {
  const { width: w, height: h, data } = keyed;
  const used = new Array(w).fill(false);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (data[(y * w + x) * 4 + 3] >= 128) {
        used[x] = true;
        break;
      }
    }
  }
  const runs = [];
  let start = -1;
  for (let x = 0; x <= w; x++) {
    if (x < w && used[x]) {
      if (start < 0) start = x;
    } else if (start >= 0) {
      runs.push([start, x - 1]);
      start = -1;
    }
  }
  const segs = runs.filter(([a, b]) => b - a + 1 >= w * 0.01);
  if (segs.length !== count)
    throw new Error(`strip has ${segs.length} frames, the shot list says ${count}`);
  return segs.map(([a, b]) => crop(keyed, a, 0, b - a + 1, h));
}

/** Measurements the game needs, on the 256 level. */
export function analyzeFrame(l1, frame, byId) {
  const anchorType = resolvedAnchor(frame, byId);
  const bbox = A.alphaBBox(l1);
  const isDuck = frame.shot.kind === "earl" || frame.shot.kind === "baby";
  const eyes = isDuck ? A.detectEyes(l1, 1) : [];
  const head = bbox
    ? [
        Math.round(eyes.length === 2 ? (eyes[0].x + eyes[1].x) / 2 : (bbox.x0 + bbox.x1) / 2),
        bbox.y0,
      ]
    : null;
  const attach = {};
  if (anchorType === "hang") {
    const tips = A.wingTips(l1);
    if (tips?.wingL) attach.wingL = tips.wingL;
    if (tips?.wingR) attach.wingR = tips.wingR;
  }
  const prop =
    frame.shot.kind === "prop" || frame.shot.kind === "acc"
      ? A.measureProp(l1, frame.n === 1 ? frame.shot.attachRequired : [], frame.shot.attach)
      : null;
  return {
    anchorType,
    anchor: anchorPoint(anchorType, frame.shot.canvas),
    bbox,
    eyes: eyes.map((e) => ({
      x: Math.round(e.x * 10) / 10,
      y: Math.round(e.y * 10) / 10,
      r: Math.round(e.r * 10) / 10,
    })),
    head,
    attach,
    ledgeY: anchorType === "ledge" ? 124 : null,
    hitMask: isDuck ? A.hitMask64(l1) : null,
    prop,
  };
}

/** Lint for one frame (ART_SHOTLIST section 7, step 6). Issues: {level: ERR|WARN, code, msg}. */
export function checkFrame(l1, frame, meta, ctx) {
  const shot = frame.shot;
  const skip = new Set(shot.lint?.skip || []);
  const issues = [];
  const add = (level, code, msg) => {
    if (!skip.has(code)) issues.push({ level, code, msg });
  };
  const isDuck = shot.kind === "earl" || shot.kind === "baby";
  const bb = meta.bbox;
  if (!bb) {
    add("ERR", "empty", "nothing left after keying");
    return issues;
  }
  if (isDuck && (bb.x0 < 8 || bb.x1 > 247 || bb.y0 < 4 || bb.y1 > 251))
    add(
      "ERR",
      "safe_area",
      `outside the safe area x 8-247, y 4-251 (bbox x ${bb.x0}-${bb.x1}, y ${bb.y0}-${bb.y1})`,
    );
  if (meta.anchorType === "gnd" && Math.abs(bb.y1 - 240) > 1)
    add("ERR", "baseline", `baseline at y=${bb.y1}, expected 240 (1 px tolerance)`);
  const mag = A.magentaPixels(l1);
  if (mag > 0) add("ERR", "magenta", `${mag} px of leftover magenta or pink/purple fringe`);
  const holes = A.findHoles(l1).filter((h) => h.area >= 2);
  if (holes.length)
    add(
      "ERR",
      "holes",
      `${holes.length} see-through hole(s), largest ${Math.max(...holes.map((h) => h.area))} px at (${Math.round(holes[0].x)},${Math.round(holes[0].y)})`,
    );
  const rim = A.rimStats(l1);
  if (isDuck && rim.darkShare > 0.3)
    add(
      "ERR",
      "dark_rim",
      `dark or grey rim/halo on ${Math.round(rim.darkShare * 100)}% of the edge (own-colour rims only)`,
    );
  if (ctx.profile === "smooth" && rim.hardShare > 0.9)
    add("WARN", "hard_edges", "hard, non-anti-aliased edges (smooth profile)");
  if (shot.kind === "earl" && shot.facing === "front" && meta.eyes.length === 2) {
    const bad = meta.eyes.filter((e) => Math.abs(e.r * 2 - 22) > 2);
    if (bad.length)
      add(
        "WARN",
        "eye_size",
        `eye size ${meta.eyes.map((e) => Math.round(e.r * 2)).join("/")} px, expected 22 +-2`,
      );
  }
  if (shot.kind === "earl") {
    const dom = A.dominantColour(l1);
    const de = dom ? A.deltaE(dom, BODY_CREAM) : 0;
    if (de > 5) add("WARN", "body_colour", `body colour drifts ${de.toFixed(1)} dE from #F8E9C7`);
  }
  if (frame.anchor === "ovl" && ctx.baseL1) {
    const iou = A.alphaIoU(l1, ctx.baseL1);
    if (iou < OVL_MIN_IOU)
      add(
        "WARN",
        "ovl_moved",
        `expression edit moved the body (silhouette overlap ${(iou * 100).toFixed(1)}%)`,
      );
  }
  if (shot.kind === "earl" && ctx.refHeadWidth && meta.anchorType === "gnd") {
    const hw = A.headWidth(l1);
    const tol = shot.lint?.headWidthTolerance ?? 0.06;
    const off = Math.abs(hw / ctx.refHeadWidth - 1);
    if (off > tol)
      add(
        "WARN",
        "head_width",
        `head width ${hw} px is ${Math.round(off * 100)}% off ${ctx.refHeadId || "the reference"} (${ctx.refHeadWidth} px, allowance ${Math.round(tol * 100)}%)`,
      );
  }
  if (meta.prop && frame.n === 1) {
    const missing = shot.attachRequired.filter((a) => !shot.attach?.[a]);
    if (missing.length)
      add("ERR", "prop_attach", `attach lines not set in the lineup: ${missing.join(", ")}`);
    if (shot.target?.w) {
      const off = Math.abs(meta.prop.footprint.w / shot.target.w - 1);
      if (off > 0.15)
        add(
          "ERR",
          "prop_size",
          `width ${meta.prop.footprint.w} is ${Math.round(off * 100)}% off the ${shot.target.w} target (15% allowed)`,
        );
    }
  }
  return issues;
}

/** Computes every frame: its source, level images, measurements, lint and status. */
export function computeAll(root, doc = loadDoc(root)) {
  const frames = listFrames(doc);
  const byId = new Map(frames.map((f) => [f.id, f]));
  const results = new Map();
  const get = (id, depth = 0) => {
    if (results.has(id)) return results.get(id);
    const frame = byId.get(id);
    if (!frame || depth > 8) return null;
    const baseRes = frame.anchor === "ovl" && frame.base ? get(frame.base, depth + 1) : null;
    const baseL1 = baseRes?.l1 || null;
    const masterFile = path.join(root, PATHS.masters, `${id}.png`);
    let levels = null;
    let source = "missing";
    if (fs.existsSync(masterFile)) {
      levels = levelsFromMaster(readPng(masterFile), frame, doc.profile);
      source = "master";
    } else if (frame.placeholder && fs.existsSync(path.join(root, frame.placeholder))) {
      levels = placeholderLevels(readPng(path.join(root, frame.placeholder)), frame, byId, baseL1);
      source = "placeholder";
    }
    const res = {
      frame,
      source,
      l1: levels?.l1 || null,
      l2: levels?.l2 || null,
      meta: null,
      issues: [],
      status: "MISSING",
      final: false,
    };
    results.set(id, res);
    if (res.l1) {
      res.meta = analyzeFrame(res.l1, frame, byId);
      // Head width is compared within a view: front frames to earl_sit_idle_01, side frames to earl_walk_02.
      const refId = {
        front: "earl_sit_idle_01",
        right: "earl_walk_02",
        three_quarter: "earl_walk_02",
      }[frame.shot.facing];
      const ref = refId && refId !== id ? get(refId, depth + 1) : null;
      res.issues = checkFrame(res.l1, frame, res.meta, {
        profile: source === "placeholder" ? "v1-faithful" : doc.profile,
        baseL1,
        refHeadWidth: ref?.l1 ? A.headWidth(ref.l1) : null,
        refHeadId: refId,
      });
      if (source === "placeholder") res.status = "PLACEHOLDER";
      else
        res.status = res.issues.some((i) => i.level === "ERR")
          ? "ERR"
          : res.issues.length
            ? "WARN"
            : "OK";
      res.final = source === "master" && frame.approved && res.status !== "ERR";
    }
    return res;
  };
  for (const f of frames) get(f.id);
  return { doc, frames, byId, results };
}

export function coverage(all) {
  const tiers = {};
  const total = { total: 0, final: 0, master: 0, placeholder: 0, missing: 0 };
  for (const f of all.frames) {
    const r = all.results.get(f.id);
    const t = (tiers[f.tier] ||= { total: 0, final: 0, master: 0, placeholder: 0, missing: 0 });
    for (const bucket of [t, total]) {
      bucket.total++;
      if (r.final) bucket.final++;
      if (r.source === "master") bucket.master++;
      else if (r.source === "placeholder") bucket.placeholder++;
      else bucket.missing++;
    }
  }
  return { ...total, tiers };
}

export const coverageLine = (c) => `final ${c.final}/${c.total}, placeholder ${c.placeholder}`;

function trimRect(img) {
  const bb = A.alphaBBox(img, 1);
  return bb ? { x: bb.x0, y: bb.y0, w: bb.w, h: bb.h } : { x: 0, y: 0, w: 1, h: 1 };
}

/** Shelf packer. Deterministic: sorted by height, width, then id. */
export function pack(items, pad = 2) {
  const sorted = [...items].sort((a, b) => b.h - a.h || b.w - a.w || (a.id < b.id ? -1 : 1));
  const area = sorted.reduce((s, it) => s + (it.w + pad) * (it.h + pad), 0);
  const maxW = sorted.reduce((m, it) => Math.max(m, it.w + 2 * pad), 0);
  let W = 256;
  while (W * W < area * 1.25 && W < 8192) W *= 2;
  W = Math.max(W, maxW);
  const rects = new Map();
  let x = pad;
  let y = pad;
  let rowH = 0;
  for (const it of sorted) {
    if (x + it.w + pad > W) {
      x = pad;
      y += rowH + pad;
      rowH = 0;
    }
    rects.set(it.id, [x, y, it.w, it.h]);
    x += it.w + pad;
    rowH = Math.max(rowH, it.h);
  }
  return { width: W, height: y + rowH + pad, rects };
}

/** Packs atlas pages at both levels. Returns page images and per-frame rects. */
export function buildAtlases(all) {
  const pages = new Map();
  const frameLevels = new Map();
  for (const level of LEVELS) {
    const byPage = new Map();
    for (const f of all.frames) {
      const r = all.results.get(f.id);
      const img = level === 256 ? r.l1 : r.l2;
      if (!f.page || !img) continue;
      const t = trimRect(img);
      if (!byPage.has(f.page)) byPage.set(f.page, []);
      byPage.get(f.page).push({ id: f.id, img, t, w: t.w, h: t.h });
    }
    for (const [page, items] of [...byPage].sort()) {
      const packed = pack(items);
      const img = createImage(packed.width, packed.height);
      for (const it of items) {
        const [x, y] = packed.rects.get(it.id);
        blit(img, crop(it.img, it.t.x, it.t.y, it.t.w, it.t.h), x, y);
        if (!frameLevels.has(it.id)) frameLevels.set(it.id, {});
        frameLevels.get(it.id)[level] = { rect: packed.rects.get(it.id), offset: [it.t.x, it.t.y] };
      }
      if (!pages.has(page)) pages.set(page, {});
      pages.get(page)[level] = { img, width: packed.width, height: packed.height };
    }
  }
  return { pages, frameLevels };
}

const lit = (v) => JSON.stringify(v);

/** The typed module src/sim/anim/sprites.gen.ts (plan 5.11). */
export function renderGen(all, atlases) {
  const cov = coverage(all);
  const L = [];
  L.push(
    "// GENERATED by scripts/art.mjs (npm run art:build) from art/shots.json and art/masters/.",
  );
  L.push("// Do not edit and do not commit (gitignored, plan D19). See docs/ART.md.");
  L.push("");
  L.push(`export type FrameId =\n${all.frames.map((f) => `  | ${lit(f.id)}`).join("\n")};`);
  L.push(`export type ShotId =\n${all.doc.shots.map((s) => `  | ${lit(s.id)}`).join("\n")};`);
  L.push('export type AtlasPage = "core" | "duck2" | "props" | "baby" | "ui";');
  L.push("export type AtlasLevel = 256 | 512;");
  L.push('export type PoseClass = "sit" | "stand" | "side" | "ledge" | "air" | "lie";');
  L.push(
    'export type AnchorType = "gnd" | "ctr" | "grip" | "hang" | "ledge" | "wall" | "prop" | "icon";',
  );
  L.push('export type FrameSource = "final" | "master" | "placeholder" | "missing";');
  L.push("export type Point = readonly [number, number];");
  L.push("");
  L.push(
    "export interface FrameLevel {\n  readonly rect: readonly [number, number, number, number];\n  readonly offset: Point;\n}",
  );
  L.push(
    'export interface FrameInfo {\n  readonly shot: ShotId;\n  readonly tier: "P0" | "P1" | "P2";\n  readonly source: FrameSource;\n  readonly placeholder: boolean;\n  readonly page: AtlasPage | null;\n  readonly levels: Readonly<Partial<Record<AtlasLevel, FrameLevel>>>;\n  readonly size: Point;\n  readonly anchor: Point;\n  readonly anchorType: AnchorType;\n  readonly facing: string;\n  readonly mirror: boolean;\n  readonly pose: PoseClass | null;\n  readonly eyes: readonly { readonly x: number; readonly y: number; readonly r: number }[];\n  readonly head: Point | null;\n  readonly attach: Readonly<Record<string, Point>>;\n  readonly ledgeY: number | null;\n  readonly hitMask: string | null;\n  readonly fallback: readonly FrameId[];\n  readonly proc: Readonly<Record<string, number | string | boolean>> | null;\n}',
  );
  L.push(
    "export interface PropInfo {\n  readonly footprint: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };\n  readonly attach: Readonly<Record<string, readonly Point[]>>;\n  readonly estimated: readonly string[];\n}",
  );
  L.push("");
  L.push("export const FRAMES: Readonly<Record<FrameId, FrameInfo>> = {");
  for (const f of all.frames) {
    const r = all.results.get(f.id);
    const m = r.meta;
    const info = {
      shot: f.shot.id,
      tier: f.tier,
      source: r.final ? "final" : r.source,
      placeholder: r.source === "placeholder",
      page: r.l1 && f.page ? f.page : null,
      levels: atlases.frameLevels.get(f.id) || {},
      size: f.shot.canvas,
      anchor: m ? m.anchor : anchorPoint(resolvedAnchor(f, all.byId), f.shot.canvas),
      anchorType: m ? m.anchorType : resolvedAnchor(f, all.byId),
      facing: f.shot.facing,
      mirror: f.shot.facing === "right" || f.shot.facing === "three_quarter",
      pose: f.shot.pose,
      eyes: m ? m.eyes : [],
      head: m ? m.head : null,
      attach: m ? m.attach : {},
      ledgeY: m ? m.ledgeY : null,
      hitMask: m ? m.hitMask : null,
      fallback: f.fallback,
      proc: f.shot.proc,
    };
    L.push(`  ${f.id}: ${lit(info)},`);
  }
  L.push("};");
  L.push("");
  L.push("export const PROPS: Readonly<Partial<Record<ShotId, PropInfo>>> = {");
  for (const f of all.frames) {
    const r = all.results.get(f.id);
    if (f.n === 1 && r.meta?.prop) L.push(`  ${f.shot.id}: ${lit(r.meta.prop)},`);
  }
  L.push("};");
  L.push("");
  L.push(
    "export const ATLAS: Readonly<Partial<Record<AtlasPage, Readonly<Record<AtlasLevel, { readonly url: string; readonly width: number; readonly height: number }>>>>> = {",
  );
  for (const [page, levels] of [...atlases.pages].sort()) {
    const parts = LEVELS.filter((l) => levels[l]).map(
      (l) =>
        `    ${l}: { url: new URL(${lit(`../../assets/atlas/${page}_${l}.png`)}, import.meta.url).href, width: ${levels[l].width}, height: ${levels[l].height} },`,
    );
    L.push(`  ${page}: {\n${parts.join("\n")}\n  },`);
  }
  L.push("};");
  L.push("");
  L.push(
    `export const ART_COVERAGE = ${lit({ total: cov.total, final: cov.final, master: cov.master, placeholder: cov.placeholder, missing: cov.missing })} as const;`,
  );
  return L.join("\n") + "\n";
}

/** art:build: atlases plus sprites.gen.ts. */
export function build(root, all = computeAll(root)) {
  const atlases = buildAtlases(all);
  const atlasDir = path.join(root, PATHS.atlas);
  const wanted = new Set();
  for (const [page, levels] of atlases.pages) {
    for (const l of LEVELS) {
      if (!levels[l]) continue;
      const name = `${page}_${l}.png`;
      wanted.add(name);
      writeIfChanged(path.join(atlasDir, name), encodePng(levels[l].img));
    }
  }
  // Drops stale atlas pages only: anything else someone put here (a folder, a note) is left alone.
  if (fs.existsSync(atlasDir))
    for (const d of fs.readdirSync(atlasDir, { withFileTypes: true }))
      if (d.isFile() && /_(256|512)\.png$/.test(d.name) && !wanted.has(d.name))
        fs.rmSync(path.join(atlasDir, d.name));
  writeIfChanged(path.join(root, PATHS.gen), renderGen(all, atlases));
  return { all, atlases };
}

/** Files in the inbox, grouped by the frame or strip they deliver. */
export function scanInbox(inbox, all) {
  const report = { targets: [], unknown: [], takes: [] };
  if (!fs.existsSync(inbox)) return { ...report, missing: true };
  const shots = new Map(all.doc.shots.map((s) => [s.id, s]));
  const groups = new Map();
  for (const name of fs.readdirSync(inbox).sort()) {
    if (name.startsWith(".") || !/\.(png|webp|jpe?g)$/i.test(name)) continue;
    const stem = name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .split("__")[0];
    let target = null;
    if (all.byId.has(stem)) target = { kind: "frame", id: stem };
    else if (shots.has(stem))
      target =
        shots.get(stem).frames === 1
          ? { kind: "frame", id: `${stem}_01` }
          : { kind: "strip", id: stem };
    if (!target) {
      report.unknown.push(name);
      continue;
    }
    const file = path.join(inbox, name);
    const key = `${target.kind}:${target.id}`;
    if (!groups.has(key)) groups.set(key, { ...target, files: [] });
    groups.get(key).files.push({ file, mtime: fs.statSync(file).mtimeMs });
  }
  for (const g of groups.values()) {
    g.files.sort((a, b) => b.mtime - a.mtime || (a.file < b.file ? -1 : 1));
    if (g.files.length > 1)
      report.takes.push({
        id: g.id,
        used: path.basename(g.files[0].file),
        ignored: g.files.slice(1).map((f) => path.basename(f.file)),
      });
    report.targets.push({
      kind: g.kind,
      id: g.id,
      file: g.files[0].file,
      files: g.files.map((f) => f.file),
    });
  }
  const order = (t) => (t.kind === "strip" ? 2 : all.byId.get(t.id).anchor === "ovl" ? 1 : 0);
  const idx = new Map(all.frames.map((f, i) => [f.shot.id, i]));
  report.targets.sort(
    (a, b) =>
      order(a) - order(b) ||
      (idx.get(a.id.replace(/_\d\d$/, "")) ?? 0) - (idx.get(b.id.replace(/_\d\d$/, "")) ?? 0) ||
      (a.id < b.id ? -1 : 1),
  );
  return report;
}

/**
 * art:import: every inbox file becomes a 512 master in art/masters/. Returns per-frame outcomes.
 * Raws that imported cleanly (with any older takes of the same frame) move to <inbox>/imported/
 * unless `keep` is set; a raw that failed stays in the inbox to be fixed and re-run.
 */
export async function importInbox(root, { inbox, profile, keep = false, log = console.log }) {
  const all = computeAll(root);
  const prof = profile || all.doc.profile;
  const scan = scanInbox(inbox, all);
  const outcomes = [];
  const moved = [];
  if (scan.missing) {
    log(`art:import: no inbox at ${inbox}, nothing to import`);
    return { outcomes, scan, archived: [] };
  }
  if (!scan.targets.length) {
    log(`art:import: inbox ${inbox} is empty, nothing to import`);
    for (const u of scan.unknown)
      log(`  WARN skipped ${u}: not a shot or frame id from the shot list`);
    return { outcomes, scan, archived: [] };
  }
  if (!prof)
    throw new Error(
      'no style profile picked yet (plan D20, Q2): pass --profile v1-faithful|smooth or set "profile" in art/shots.json',
    );
  if (!["v1-faithful", "smooth"].includes(prof)) throw new Error(`unknown style profile ${prof}`);
  for (const u of scan.unknown)
    log(`  WARN skipped ${u}: not a shot or frame id from the shot list`);
  for (const t of scan.takes)
    log(
      `  WARN ${t.id}: several takes, using the newest ${t.used} (ignored ${t.ignored.join(", ")})`,
    );
  const masterDir = path.join(root, PATHS.masters);
  const masterOf = (id) => {
    const f = path.join(masterDir, `${id}.png`);
    return fs.existsSync(f) ? readPng(f) : null;
  };
  for (const t of scan.targets) {
    const name = path.basename(t.file);
    try {
      const raw = await readImageFile(t.file);
      const warn = [];
      if (/\.jpe?g$/i.test(name))
        warn.push("JPG accepted: lossy edges key worse, prefer PNG or WebP");
      if (Math.max(raw.width, raw.height) < 1024)
        warn.push(`only ${raw.width}x${raw.height}, deliver 1024 px or larger`);
      if (t.kind === "frame") {
        const frame = all.byId.get(t.id);
        const master = processRaw(raw, frame, all.byId, {
          profile: prof,
          baseMaster: frame.base ? masterOf(frame.base) : null,
        });
        writePng(path.join(masterDir, `${t.id}.png`), master);
        outcomes.push({ id: t.id, file: name, ok: true, warn });
      } else {
        const shot = all.doc.shots.find((s) => s.id === t.id);
        const bg = inspectBackground(raw);
        if (!bg.ok) throw new Error(bg.message);
        const keyed = softKey(raw, { profile: prof, fringy: shot.fringy });
        const segs = splitStrip(keyed, shot.frames);
        const frames = segs.map((_, k) =>
          all.byId.get(`${shot.id}_${String(k + 1).padStart(2, "0")}`),
        );
        const stripScale = stripScaleFor(shot, frames, segs, raw, masterOf);
        // Every frame is processed before any master is written, so a strip that fails partway
        // leaves no half-imported set behind. A base inside the strip (prop_fan) comes from here.
        const staged = new Map();
        for (const [k, seg] of segs.entries()) {
          const frame = frames[k];
          const master = processRaw(seg, frame, all.byId, {
            profile: prof,
            prekeyed: true,
            stripScale,
            baseMaster: frame.base ? (staged.get(frame.base) ?? masterOf(frame.base)) : null,
          });
          staged.set(frame.id, master);
        }
        for (const [id, master] of staged) {
          writePng(path.join(masterDir, `${id}.png`), master);
          outcomes.push({ id, file: name, ok: true, warn });
        }
      }
      if (!keep) moved.push(...t.files);
    } catch (e) {
      outcomes.push({ id: t.id, file: name, ok: false, error: e.message });
    }
  }
  const archived = moved.map((file) => archiveRaw(inbox, file));
  return { outcomes, scan, archived };
}

/**
 * The scale for every frame of a strip, so the frames keep their sizes relative to each other.
 * A strip whose frames derive from a master outside the strip (earl_run on earl_walk_02,
 * baby_walk on baby_sit_01, prop_blanket on prop_bed_01) is scaled so its tallest frame matches
 * that master. Any other strip (earl_walk and prop_bread have no base; prop_fan and
 * prop_parachute base later frames on their own earlier ones) is scaled the way a single raw
 * is: each evenly spaced cell, raw width / frames by raw height, fills the shot's canvas.
 */
export function stripScaleFor(shot, frames, segs, raw, masterOf) {
  const own = new Set(frames.map((f) => f.id));
  const base = frames.map((f) => f.base).find((b) => b && !own.has(b));
  if (!base) {
    const side = Math.max(...shot.canvas) * shot.masterScale;
    return side / Math.max(raw.width / shot.frames, raw.height);
  }
  const baseMaster = masterOf(base);
  if (!baseMaster)
    throw new Error(
      `${shot.id} is scaled to match its base ${base}: import ${base} first (or put both in the inbox together)`,
    );
  const tallest = Math.max(...segs.map((s) => A.alphaBBox(s)?.h || 1));
  return A.alphaBBox(baseMaster).h / tallest;
}

/**
 * Moves an imported raw into <inbox>/imported/ so the next import does not redo it and overwrite a
 * master that was cleaned up by hand. Nothing is deleted; a name clash gets a __N suffix, which
 * the importer reads as another take of the same frame.
 */
function archiveRaw(inbox, file) {
  const dir = path.join(inbox, "imported");
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(file);
  const stem = path.basename(file, ext);
  let dest = path.join(dir, `${stem}${ext}`);
  for (let n = 2; fs.existsSync(dest); n++) dest = path.join(dir, `${stem}__${n}${ext}`);
  fs.renameSync(file, dest);
  return dest;
}

/** art:templates: 1024 px references on magenta for each frame that has something to show. */
export function writeTemplates(root, all = computeAll(root)) {
  const dir = path.join(root, PATHS.templates);
  let count = 0;
  for (const f of all.frames) {
    const k = f.shot.kind;
    if (k !== "earl" && k !== "baby") continue;
    let r = all.results.get(f.id);
    if (!r.l1 && f.base) r = all.results.get(f.base);
    if (!r?.l1) continue;
    const img = r.l2 ? scaleNearest(r.l2, 2) : scaleNearest(r.l1, 4);
    const name = f.shot.frames === 1 ? `${f.shot.id}.png` : `${f.id}.png`;
    writePng(path.join(dir, name), flatten(img, KEY));
    count++;
  }
  return count;
}

/** art:check beyond per-frame lint: shot list sync, ids, orphans, profile. */
export function checkProject(root, all) {
  const errors = [];
  const doc = all.doc;
  const regenerated = regenerateDoc(root, doc);
  if (stringifyDoc(regenerated) !== stringifyDoc(doc))
    errors.push("art/shots.json is out of date with docs/ART_SHOTLIST.md: run npm run art:shots");
  const shotlistFile = path.join(root, PATHS.shotlist);
  if (!fs.existsSync(shotlistFile) || fs.readFileSync(shotlistFile, "utf8") !== renderShotlist(doc))
    errors.push("art/SHOTLIST.md is stale: run npm run art:shots");
  for (const p of catalogProblems(promptCatalog(doc))) errors.push(p);
  const seen = new Set();
  for (const f of all.frames) {
    if (seen.has(f.id)) errors.push(`duplicate frame id ${f.id}`);
    seen.add(f.id);
    if (!SHOT_ID.test(f.shot.id))
      errors.push(`shot id ${f.shot.id} is not snake_case with a known prefix`);
    if (f.placeholder && !fs.existsSync(path.join(root, f.placeholder)))
      errors.push(`${f.id}: placeholder ${f.placeholder} is missing`);
  }
  const masterDir = path.join(root, PATHS.masters);
  if (fs.existsSync(masterDir)) {
    for (const name of fs.readdirSync(masterDir)) {
      if (name.startsWith(".")) continue;
      if (!name.endsWith(".png") || !seen.has(name.slice(0, -4)))
        errors.push(`art/masters/${name} is not a frame of the shot list`);
    }
  }
  if (!doc.profile && [...all.results.values()].some((r) => r.source === "master"))
    errors.push("masters exist but no style profile is picked in art/shots.json (plan D20)");
  return errors;
}

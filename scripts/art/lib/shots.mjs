// The shot list model: docs/ART_SHOTLIST.md (hand-written) -> art/shots.json (committed, machine
// written, holds approvals and pipeline fields) -> art/SHOTLIST.md (generated, per-shot prompts).
import fs from "node:fs";
import path from "node:path";

export const PROFILES = ["v1-faithful", "smooth"];
export const KINDS = ["earl", "baby", "prop", "acc", "icon"];
export const SHOT_ID = /^(earl|baby|prop|acc|icon)(_[a-z0-9]+)+$/;
const FACING = {
  F: "front",
  R: "right",
  B: "back",
  "3/4 R": "three_quarter",
  P: "prop",
  "P (R)": "prop",
  I: "icon",
};

const splitRow = (line) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

/**
 * Parses the prompt templates (section 5), the shot tables (section 6) and the per-frame prompt
 * values (section 9) of a shot-list markdown.
 * The same parser reads docs/ART_SHOTLIST.md and the generated art/SHOTLIST.md, which is how
 * the two are compared.
 */
export function parseShotlist(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const templates = [];
  const sections = [];
  const values = [];
  let h2 = "";
  let i = 0;
  const shotIntro = [];
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      h2 = line.slice(3).trim();
      i++;
      if (/^6\./.test(h2)) {
        while (i < lines.length && !lines[i].startsWith("### ")) shotIntro.push(lines[i++]);
      }
      continue;
    }
    if (line.startsWith("### ") && /^5\./.test(h2)) {
      const heading = line.slice(4).trim();
      const m = heading.match(/^(BABY STYLE LOCK|STYLE LOCK|T\d+):?/);
      i++;
      if (!m) continue;
      const intro = [];
      while (i < lines.length && !lines[i].startsWith("```") && !lines[i].startsWith("#"))
        intro.push(lines[i++]);
      const body = [];
      if (lines[i] && lines[i].startsWith("```")) {
        i++;
        while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
        i++;
      }
      templates.push({
        key: m[1].replace(/ /g, "_"),
        heading,
        intro: intro.join("\n").trim(),
        body: body.join("\n"),
      });
      continue;
    }
    if (line.startsWith("### ") && /^9\./.test(h2)) {
      const m = line.slice(4).match(/^(T\d)\b/);
      i++;
      while (i < lines.length && !lines[i].startsWith("|") && !lines[i].startsWith("#")) i++;
      if (!m || !lines[i] || !lines[i].startsWith("|")) continue;
      const columns = splitRow(lines[i]);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(splitRow(lines[i++]));
      values.push({ key: m[1], columns, rows });
      continue;
    }
    if (line.startsWith("### ") && /^6\./.test(h2)) {
      const hm = line
        .slice(4)
        .trim()
        .match(/^(6\.\d+)\s+(.*)$/);
      i++;
      if (!hm) continue;
      const intro = [];
      while (i < lines.length && !lines[i].startsWith("|") && !lines[i].startsWith("#"))
        intro.push(lines[i++]);
      const columns = lines[i] && lines[i].startsWith("|") ? splitRow(lines[i]) : [];
      if (columns.length) i += 2;
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(splitRow(lines[i++]));
      const outro = [];
      while (i < lines.length && !lines[i].startsWith("#") && lines[i].trim() !== "---")
        outro.push(lines[i++]);
      sections.push({
        id: hm[1],
        title: hm[2],
        intro: intro.join("\n").trim(),
        columns,
        rows,
        outro: outro.join("\n").trim(),
      });
      continue;
    }
    i++;
  }
  return { templates, intro: shotIntro.join("\n").trim(), sections, values };
}

/** "P0" or "01 P0, 02 P2" or "01-03 P0, 04-05 P1" -> one value per frame. */
export function perFrame(text, frames, valueRe) {
  const out = new Array(frames).fill(null);
  const parts = [
    ...text.matchAll(new RegExp(`(\\d\\d)(?:-(\\d\\d))?\\s+(${valueRe.source})`, "g")),
  ];
  if (parts.length) {
    for (const p of parts) {
      const a = Number(p[1]);
      const b = p[2] ? Number(p[2]) : a;
      for (let k = a; k <= b; k++) if (k >= 1 && k <= frames) out[k - 1] = p[3];
    }
    const first = out.find((v) => v);
    return out.map((v) => v || first);
  }
  const m = text.match(valueRe);
  return out.fill(m ? m[0] : null);
}

const pad2 = (n) => String(n).padStart(2, "0");
export const frameId = (shot, n) => `${shot}_${pad2(n)}`;

function resolveName(name, kind, ids) {
  if (!name || name === "-" || /^v1\b/.test(name)) return null;
  const clean = name.replace(/`/g, "").trim();
  const m = clean.match(/^(.*?)_(\d\d)$/);
  const stem = m ? m[1] : clean;
  const n = m ? Number(m[2]) : 1;
  const prefixes =
    kind === "prop" || kind === "acc"
      ? ["prop_", "acc_", "earl_"]
      : [`${kind}_`, "earl_", "baby_", "prop_"];
  for (const p of ["", ...prefixes]) {
    if (ids.has(p + stem)) return frameId(p + stem, n);
  }
  return null;
}

function poseClass(shot, anchor, baseShot) {
  if (shot.kind !== "earl" && shot.kind !== "baby") return null;
  if (anchor === "ledge" || /peek/.test(shot.id)) return "ledge";
  if (["ctr", "grip", "hang"].includes(anchor)) return "air";
  if (anchor === "wall") return "side";
  if (/sleep_lie|baby_sleep/.test(shot.id)) return "lie";
  if (anchor === "ovl" && baseShot && baseShot.pose) return baseShot.pose;
  if (shot.facing === "right" || shot.facing === "three_quarter") return "side";
  if (/(^|_)sit(_|$)|plop|land_squish|dizzy|yawn|sulk|splash/.test(shot.id)) return "sit";
  return "stand";
}

const LINT_DEFAULTS = {
  earl_puffed_up: { headWidthTolerance: 0.15 },
  earl_plop: { headWidthTolerance: 0.15 },
  earl_land_squish: { headWidthTolerance: 0.15 },
  earl_stretch: { headWidthTolerance: 0.15 },
  earl_startle: { headWidthTolerance: 0.15 },
  prop_fan: { skip: ["holes"] },
};

const PROC_DEFAULTS = {
  earl_stretch: { scaleY: 1.08 },
  earl_plop: { scaleX: 1.1, scaleY: 0.9 },
  earl_held_side: { rotate: -20 },
};

// Section 9 column -> the value name the templates' placeholders read (see SLOTS).
const VALUE_FIELDS = {
  "pose note": "pose",
  pose: "pose",
  facing: "facing",
  expression: "expression",
  "face change": "face",
  "frame clause": "clause",
  prop: "prop",
  view: "view",
  size: "size",
  colors: "colors",
  "state change": "change",
  crop: "crop",
};

/** Copies the section 9 prompt values onto their frames; a row for no frame, or twice, is an error. */
function attachValues(shots, tables) {
  const frames = new Map();
  for (const s of shots) for (let k = 1; k <= s.frames; k++) frames.set(frameId(s.id, k), [s, k]);
  for (const t of tables) {
    const fields = t.columns.slice(1).map((c) => {
      const f = VALUE_FIELDS[c.toLowerCase()];
      if (!f) throw new Error(`ART_SHOTLIST section 9 ${t.key}: unknown column "${c}"`);
      return f;
    });
    for (const cells of t.rows) {
      const hit = frames.get(cells[0]);
      if (!hit) throw new Error(`ART_SHOTLIST section 9 ${t.key}: no frame "${cells[0]}"`);
      const [s, k] = hit;
      if (!(s.templates[k - 1] || "").split("/").includes(t.key))
        throw new Error(`ART_SHOTLIST section 9 ${t.key}: ${cells[0]} does not use ${t.key}`);
      if (s.values[k - 1][t.key])
        throw new Error(`ART_SHOTLIST section 9 ${t.key}: ${cells[0]} twice`);
      s.values[k - 1][t.key] = Object.fromEntries(
        fields.map((f, i) => [f, (cells[i + 1] || "").replace(/\.+$/, "").trim()]),
      );
    }
  }
}

/** Builds the art/shots.json document from a parsed shot list, keeping hand-kept fields of `prev`. */
export function buildShotsDoc(parsed, prev = null) {
  const prevShots = new Map((prev?.shots || []).map((s) => [s.id, s]));
  const rows = [];
  for (const sec of parsed.sections) {
    if (sec.id === "6.10") continue;
    const col = (name) => sec.columns.findIndex((c) => c.toLowerCase().startsWith(name));
    const ci = {
      no: col("#"),
      shot: col("shot"),
      facing: col("facing"),
      frames: col("frames"),
      depicts: col("depicts"),
      base: col("base"),
      t: col("t"),
      anchor: col("anchor"),
      canvas: col("canvas"),
      tier: col("tier"),
    };
    for (const cells of sec.rows) {
      const id = cells[ci.shot];
      const frames = Number(cells[ci.frames]);
      if (!SHOT_ID.test(id) || !(frames >= 1)) continue;
      rows.push({ sec, ci, cells, id, frames });
    }
  }
  const ids = new Set(rows.map((r) => r.id));
  const v1map = new Map();
  const v1sec = parsed.sections.find((s) => s.id === "6.10");
  let pastExisting = false;
  for (const [v1, target] of v1sec ? v1sec.rows : []) {
    // Rows from "v1's 12 missing files" on name files that never existed: no placeholder.
    if (/missing files/.test(v1)) pastExisting = true;
    if (pastExisting) continue;
    const f = target.trim().match(/^([a-z0-9_]+_\d\d)$/);
    const src = v1.replace(/\(April\)/, "").trim();
    if (f && /^[A-Za-z0-9_]+$/.test(src)) v1map.set(f[1], `art/reference/v1/${src}.png`);
  }
  const shots = [];
  const byId = new Map();
  for (const { sec, ci, cells, id, frames } of rows) {
    const kind = id.split("_")[0];
    const isDuck = kind === "earl" || kind === "baby";
    const baseText = cells[ci.base];
    const mainBase = baseText.replace(/\s*\(.*\)\s*$/, "").trim();
    const bases = new Array(frames).fill(resolveName(mainBase, kind, ids));
    for (const m of baseText.matchAll(/\((\d\d)(?:-(\d\d))?:\s*([a-z0-9_]+)\)/g)) {
      for (let k = Number(m[1]); k <= Number(m[2] || m[1]); k++)
        bases[k - 1] = resolveName(m[3], kind, ids);
    }
    const depicts = cells[ci.depicts];
    const anchorText = ci.anchor >= 0 ? cells[ci.anchor] : null;
    const canvasText = ci.canvas >= 0 ? cells[ci.canvas] : null;
    let canvas = [256, 256];
    if (canvasText) {
      const m = canvasText.match(/^(\d+)x(\d+)$/);
      const one = canvasText.match(/^(\d+)$/);
      if (m) canvas = [Number(m[1]), Number(m[2])];
      else if (one) canvas = [Number(one[1]), Number(one[1])];
    }
    const anchors = isDuck
      ? perFrame(anchorText, frames, /gnd|ovl|ctr|grip|hang|ledge|wall/)
      : new Array(frames).fill(kind === "icon" ? "icon" : "prop");
    const attachM = depicts.match(
      /Attach (?:line|lines|point|points): ((?:`\w+`(?:,\s*|\s+and\s+)?)+)/,
    );
    const targetM = depicts.match(/about (\d+) (?:wide|long|across)/i);
    const prevShot = prevShots.get(id) || {};
    const shot = {
      no: cells[ci.no],
      id,
      kind,
      section: sec.id,
      facing: FACING[cells[ci.facing]] || cells[ci.facing],
      frames,
      tiers: perFrame(cells[ci.tier], frames, /P[0-2]/),
      anchors,
      bases,
      templates: perFrame(cells[ci.t], frames, /T\d(?:\/T\d)?/),
      canvas,
      masterScale: canvas[0] >= 1024 ? 1 : 2,
      atlas: !(kind === "icon" && canvas[0] >= 1024),
      pose: null,
      placeholders: {},
      fallback: [],
      proc: prevShot.proc ?? PROC_DEFAULTS[id] ?? null,
      lint: prevShot.lint ?? LINT_DEFAULTS[id] ?? null,
      fringy: prevShot.fringy ?? false,
      attachRequired: attachM ? [...attachM[1].matchAll(/`(\w+)`/g)].map((m) => m[1]) : [],
      attach: prevShot.attach ?? {},
      target: targetM ? { w: Number(targetM[1]) } : null,
      approved: prevShot.approved ?? [],
      values: Array.from({ length: frames }, () => ({})),
      row: cells,
    };
    for (let k = 1; k <= frames; k++) {
      const ph = v1map.get(frameId(id, k));
      if (ph) shot.placeholders[pad2(k)] = ph;
    }
    shots.push(shot);
    byId.set(id, shot);
  }
  attachValues(shots, parsed.values || []);
  for (const shot of shots) {
    const baseShot = shot.bases[0] ? byId.get(shot.bases[0].replace(/_\d\d$/, "")) : null;
    shot.pose = prevShots.get(shot.id)?.pose ?? poseClass(shot, shot.anchors[0], baseShot);
    if (prevShots.get(shot.id)?.fallback) {
      shot.fallback = prevShots.get(shot.id).fallback;
    } else if (shot.kind === "earl") {
      shot.fallback = [
        ...new Set([shot.bases[0], "earl_sit_idle_01"].filter((f) => f && !f.startsWith(shot.id))),
      ];
    } else if (shot.kind === "baby") {
      shot.fallback = ["earl_sit_idle_01"];
      shot.proc = prevShots.get(shot.id)?.proc ?? { tint: "#FFE68A", scale: 0.55 };
    } else {
      shot.fallback = [];
      if (shot.kind !== "icon")
        shot.proc = prevShots.get(shot.id)?.proc ?? { canvasPlaceholder: true };
    }
  }
  return {
    $comment:
      "Machine-written by `npm run art:shots` from docs/ART_SHOTLIST.md. Hand-kept per shot: approved, attach, lint, fringy, fallback, proc, pose (delete a field to regenerate its default). The rest is regenerated.",
    version: 1,
    profile: prev?.profile ?? null,
    source: "docs/ART_SHOTLIST.md",
    templates: parsed.templates,
    intro: parsed.intro,
    sections: parsed.sections.map((s) => ({ ...s, rows: s.id === "6.10" ? s.rows : undefined })),
    shots,
  };
}

/** Every frame of every shot, in shot-list order. */
export function listFrames(doc) {
  const frames = [];
  for (const shot of doc.shots) {
    for (let k = 1; k <= shot.frames; k++) {
      const id = frameId(shot.id, k);
      const anchor = shot.anchors[k - 1];
      const base = shot.bases[k - 1];
      const own = k > 1 ? [frameId(shot.id, 1)] : [];
      let page = null;
      if (shot.atlas) {
        if (shot.kind === "earl") page = shot.tiers[k - 1] === "P0" ? "core" : "duck2";
        else if (shot.kind === "baby") page = "baby";
        else if (shot.kind === "icon") page = "ui";
        else page = "props";
      }
      frames.push({
        id,
        n: k,
        shot,
        tier: shot.tiers[k - 1],
        anchor,
        base,
        template: shot.templates[k - 1],
        placeholder: shot.placeholders[pad2(k)] || null,
        fallback: [...new Set([...own, ...shot.fallback])].filter((f) => f !== id),
        approved: shot.approved.includes(k) || shot.approved.includes(pad2(k)),
        page,
      });
    }
  }
  return frames;
}

/** Resolves the anchor type used for alignment: ovl follows its base chain. */
export function resolvedAnchor(frame, framesById) {
  let f = frame;
  for (let guard = 0; f && f.anchor === "ovl" && guard < 8; guard++) f = framesById.get(f.base);
  return f && f.anchor !== "ovl" ? f.anchor : "gnd";
}

/** The profile a prompt uses while none is picked: plan Q2's default ("the literal reading of original style"). */
export const DEFAULT_PROFILE = "v1-faithful";

// A strip (T4) is one wide 16:9 image, so the style lock's square FRAMING line would contradict
// it, and a small duck in a tall cell imports small (ART_SHOTLIST T4 sizing note).
const STRIP_FRAMING =
  "FRAMING: wide 16:9 image, one row of frames, every figure whole and not cropped and drawn " +
  "large enough to fill most of the frame height, all on the same ground line.";

// T2 asks for the feet on the ground line; a pose aligned in the air (ART_SHOTLIST section 3) says so instead.
const AIR_ANCHORS = new Set(["ctr", "grip", "hang"]);
const GROUND_LINE = "Keep his feet on the same ground line and his body centered.";
const MID_AIR =
  "He is in mid-air, so his feet do not touch the ground line; keep his body centered on the canvas.";

// Template placeholder -> the section 9 value that fills it.
const SLOTS = {
  "POSE NOTE": "pose",
  POSE: "pose",
  EXPRESSION: "expression",
  "right | front | back": "facing",
  "EYES / LIDS / BROWS / BILL": "face",
  PROP: "prop",
  VIEW: "view",
  "SIZE vs duck": "size",
  PALETTE: "colors",
  "STATE CHANGE": "change",
  CROP: "crop",
};

const templateKeys = (t) => (t ? t.split("/") : []);

/**
 * The images a shot is generated as: one per frame and template, except that the T4 frames of a
 * shot are one strip image with a single prompt.
 */
export function promptUnits(shot) {
  const units = [];
  let strip = null;
  for (let k = 1; k <= shot.frames; k++) {
    for (const template of templateKeys(shot.templates[k - 1])) {
      if (template === "T4") {
        strip ??= {
          key: `${shot.id}:T4`,
          template,
          strip: true,
          frames: [],
          file: `${shot.id}.png`,
        };
        strip.frames.push(k);
      } else {
        const id = frameId(shot.id, k);
        units.push({
          key: `${id}:${template}`,
          template,
          strip: false,
          frames: [k],
          file: `${id}.png`,
        });
      }
    }
  }
  if (strip) units.push(strip);
  return units;
}

/**
 * The finished, ready-to-paste prompt for one template of one frame (a strip, T4, covers every
 * frame of the shot): the template with its style lock pasted in, the EDGES wording of the profile
 * picked, and every placeholder filled from the frame's section 9 values. A value that is missing
 * leaves its placeholder, which promptProblems reports.
 */
export function shotPrompt(doc, shot, key, { frame = 1, profile = null } = {}) {
  const tpl = new Map(doc.templates.map((t) => [t.key, t.body]));
  const lock = tpl.get(shot.kind === "baby" ? "BABY_STYLE_LOCK" : "STYLE_LOCK") || "";
  const prof = profile || doc.profile || DEFAULT_PROFILE;
  let text = (tpl.get(key) || "").replace(/<(BABY )?STYLE LOCK>/g, () => lock);
  text = text.replace(/<EDGES: v1-faithful = "([^"]*)" \| smooth = "([^"]*)">/g, (_, v1, smooth) =>
    prof === "smooth" ? smooth : v1,
  );
  const values = shot.values || [];
  if (key === "T4") {
    const ks = promptUnits(shot).find((u) => u.strip)?.frames || [];
    text = text.replace(/^FRAMING: square image.*$/m, STRIP_FRAMING);
    if (shot.kind === "baby") text = text.replace("this exact duck", "this exact baby duckling");
    text = text.replace("<N>", String(ks.length));
    return text.replace(/Frame 1: <\.\.\.>\.(?: Frame \d+: <\.\.\.>\.)*/, () =>
      ks.map((k, i) => `Frame ${i + 1}: ${values[k - 1]?.T4?.clause || "<...>"}.`).join(" "),
    );
  }
  const v = values[frame - 1]?.[key] || {};
  if (key === "T2" && AIR_ANCHORS.has(shot.anchors[frame - 1]))
    text = text.replace(GROUND_LINE, MID_AIR);
  return text.replace(/<([^<>]+)>/g, (m, name) => (SLOTS[name] && v[SLOTS[name]]) || m);
}

/** What makes a prompt not copy-ready: placeholders, markdown, doubled periods, notes for us. */
export function promptProblems(text) {
  const out = [];
  if (!text.trim()) out.push("empty");
  for (const m of text.matchAll(/<[^<>]*>/g)) out.push(`placeholder ${m[0]}`);
  if (text.includes("`")) out.push("backtick");
  if (/(?<!\.)\.\.(?!\.)/.test(text)) out.push("doubled period");
  if (/\.png\b|\bart\/|\bscripts?\/|\bnpm\b|\btauri\b|\blineup\b|\bset in the\b/i.test(text))
    out.push("file path, tool name or internal note");
  for (const line of text.split("\n"))
    if (!/^[A-Z]/.test(line)) out.push(`line not in sentence case: ${line.slice(0, 40)}`);
  for (const m of text.matchAll(/[.!?]\s+([a-z]\S*)/g))
    out.push(`sentence not in sentence case: ${m[1]}`);
  return out;
}

const BATCH_OF = (kind, tier) =>
  tier === "P2" ? "E" : kind === "earl" ? (tier === "P0" ? "A" : "C") : tier === "P0" ? "B" : "D";

/** The images to attach to a prompt (ART_SHOTLIST section 5), as frame ids or repo paths. */
function attachFor(shot, unit) {
  const k = unit.frames[0];
  const base = shot.bases[k - 1];
  const own = (n) => frameId(shot.id, n);
  switch (unit.template) {
    case "T1":
      return [`art/templates/${shot.frames === 1 ? shot.id : own(k)}.png`];
    case "T2":
    case "T3":
      return base ? [base] : [];
    case "T4":
      // A strip with no base outside it (earl_walk) is drawn from the standing side master.
      return base ? [base] : shot.kind === "earl" ? ["earl_walk_02"] : [];
    case "T7":
      return [k > 1 && (!base || !base.startsWith(`${shot.id}_`)) ? own(1) : base || own(1)];
    default:
      return ["earl_sit_idle_01", ...(base && !base.startsWith(`${shot.id}_`) ? [base] : [])];
  }
}

/**
 * The machine-readable prompt list (node scripts/art.mjs shots --json): every shot, every frame
 * with its template, tier and batch, and every prompt finished in both style profiles.
 */
export function promptCatalog(doc) {
  const shots = doc.shots.map((shot) => {
    const units = promptUnits(shot);
    const prompts = units.map((u) => {
      const tier = u.frames.map((k) => shot.tiers[k - 1]).sort()[0];
      return {
        key: u.key,
        template: u.template,
        strip: u.strip,
        file: u.file,
        frames: u.frames.map((k) => frameId(shot.id, k)),
        tier,
        batch: BATCH_OF(shot.kind, tier),
        attach: attachFor(shot, u),
        text: Object.fromEntries(
          PROFILES.map((p) => [
            p,
            shotPrompt(doc, shot, u.template, { frame: u.frames[0], profile: p }),
          ]),
        ),
      };
    });
    const frames = Array.from({ length: shot.frames }, (_, i) => ({
      id: frameId(shot.id, i + 1),
      n: i + 1,
      file: `${frameId(shot.id, i + 1)}.png`,
      tier: shot.tiers[i],
      batch: BATCH_OF(shot.kind, shot.tiers[i]),
      template: shot.templates[i],
      anchor: shot.anchors[i],
      base: shot.bases[i],
      prompts: units.filter((u) => u.frames.includes(i + 1)).map((u) => u.key),
    }));
    return {
      id: shot.id,
      no: shot.no,
      kind: shot.kind,
      section: shot.section,
      facing: shot.facing,
      depicts: shot.row[4].replace(/\*\*/g, "").trim(),
      frames,
      prompts,
    };
  });
  return {
    version: 1,
    source: doc.source,
    profile: doc.profile,
    defaultProfile: DEFAULT_PROFILE,
    profiles: PROFILES,
    templates: Object.fromEntries(
      doc.templates
        .filter((t) => /^T\d$/.test(t.key))
        .map((t) => [t.key, t.heading.replace(/^T\d+:\s*/, "")]),
    ),
    counts: {
      shots: shots.length,
      frames: shots.reduce((n, s) => n + s.frames.length, 0),
      prompts: shots.reduce((n, s) => n + s.prompts.length, 0),
    },
    shots,
  };
}

/** Every reason a frame is not ready to generate: a frame with no prompt, or a prompt with problems. */
export function catalogProblems(catalog) {
  const out = [];
  for (const shot of catalog.shots) {
    for (const f of shot.frames) if (!f.prompts.length) out.push(`${f.id}: no prompt (T column)`);
    for (const p of shot.prompts)
      for (const [profile, text] of Object.entries(p.text))
        for (const problem of promptProblems(text))
          out.push(`prompt ${p.key} (${profile}): ${problem}`);
  }
  return out;
}

const table = (columns, rows) =>
  [
    `| ${columns.join(" | ")} |`,
    `|${columns.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");

/** Renders art/SHOTLIST.md from art/shots.json. */
export function renderShotlist(doc) {
  const out = [];
  out.push("# Earl v2 - Shot list (generated)", "");
  out.push(
    "Generated by `npm run art:shots` from `art/shots.json`, which is generated from `docs/ART_SHOTLIST.md`. Do not edit this file: edit `docs/ART_SHOTLIST.md` and rerun. `npm run art:check` fails when it is stale.",
    "",
    `Style profile: ${doc.profile ? `\`${doc.profile}\`` : `not picked yet (plan D20, Q2), so the prompts below use the default \`${DEFAULT_PROFILE}\` EDGES wording; \`node scripts/art.mjs shots --json\` has every prompt in both profiles`}.`,
    "",
    "## 5. Prompt templates",
    "",
  );
  for (const t of doc.templates) {
    out.push(`### ${t.heading}`, "");
    if (t.intro) out.push(t.intro, "");
    out.push("```", t.body, "```", "");
  }
  out.push("## 6. Shot list", "");
  if (doc.intro) out.push(doc.intro, "");
  const bySection = new Map();
  for (const s of doc.shots) {
    if (!bySection.has(s.section)) bySection.set(s.section, []);
    bySection.get(s.section).push(s);
  }
  for (const sec of doc.sections) {
    out.push(`### ${sec.id} ${sec.title}`, "");
    if (sec.intro) out.push(sec.intro, "");
    const rows = sec.rows || [];
    if (!sec.rows) {
      for (const s of bySection.get(sec.id) || []) rows.push(s.row);
      for (const extra of sec.extraRows || []) rows.push(extra);
    }
    if (sec.columns.length) out.push(table(sec.columns, rows), "");
    if (sec.outro) out.push(sec.outro, "");
  }
  out.push("## Per-shot prompts", "");
  out.push(
    "One finished prompt per image (one per frame, one per strip): the template with the STYLE LOCK (or, for babies, the BABY STYLE LOCK) pasted in and every placeholder filled from section 9 of `docs/ART_SHOTLIST.md`. Attach the images named with each prompt.",
    "",
  );
  for (const s of doc.shots) {
    const files = Array.from({ length: s.frames }, (_, k) => `${frameId(s.id, k + 1)}.png`).join(
      ", ",
    );
    out.push(`### ${s.id}`, "");
    out.push(
      `#${s.no}, ${[...new Set(s.tiers)].join("/")}, ${s.frames} frame${s.frames > 1 ? "s" : ""}: ${files}. Base: ${s.row[5]}.`,
      "",
    );
    for (const u of promptUnits(s)) {
      const what = u.strip ? `a strip of ${u.frames.length} frames` : u.template;
      const attach = attachFor(s, u);
      out.push(
        `${u.file} (${what}${u.strip ? `, ${u.template}` : ""}). Attach: ${attach.length ? attach.join(", ") : "nothing"}.`,
        "",
        "```",
        shotPrompt(doc, s, u.template, { frame: u.frames[0] }),
        "```",
        "",
      );
    }
  }
  return (
    out
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}

/** Rows the generator keeps verbatim that are not shots (the automatic toolbox icons line). */
export function attachExtraRows(doc, parsed) {
  for (const sec of doc.sections) {
    if (sec.rows) continue;
    const src = parsed.sections.find((s) => s.id === sec.id);
    const shotIds = new Set(doc.shots.map((s) => s.id));
    const extras = (src?.rows || []).filter(
      (r) => !shotIds.has(r[sec.columns.findIndex((c) => c.toLowerCase().startsWith("shot"))]),
    );
    if (extras.length) sec.extraRows = extras;
  }
  return doc;
}

export function loadShots(root) {
  return JSON.parse(fs.readFileSync(path.join(root, "art/shots.json"), "utf8"));
}

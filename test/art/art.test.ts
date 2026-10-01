import { describe, expect, it } from "vitest";
import {
  alignFrame,
  alignOverlay,
  alphaBBox,
  alphaIoU,
  analyzeFrame,
  blit,
  build,
  buildShotsDoc,
  checkFrame,
  computeAll,
  coverage,
  coverageLine,
  createImage,
  decodePng,
  detectEyes,
  drawOver,
  encodePng,
  findHoles,
  importInbox,
  inspectBackground,
  listFrames,
  loadDoc,
  magentaPixels,
  pack,
  catalogProblems,
  parseShotlist,
  promptCatalog,
  promptUnits,
  regenerateDoc,
  renderShotlist,
  rimStats,
  shotPrompt,
  softKey,
  splitStrip,
  stringifyDoc,
  wrapWords,
  writePng,
  type Frame,
  type Img,
} from "../../scripts/art/lib/index.mjs";
import {
  runNode,
  ROOT,
  copy,
  envFlag,
  exists,
  join,
  listFiles,
  makeTempDir,
  mkdirp,
  readBytes,
  readText,
  removeDir,
  writeBytes,
} from "./node-helpers.mjs";
import { CREAM, MAGENTA, duck, paint, type Disc, type RGB } from "./synth";

const GOLDEN = join(ROOT, "test/fixtures/art/keyer-circle.golden.png");

function frameFor(
  kind = "earl",
  facing = "front",
  anchor = "gnd",
  lint: Frame["shot"]["lint"] = null,
): Frame {
  return {
    id: `${kind}_test_01`,
    n: 1,
    tier: "P0",
    anchor,
    base: null,
    placeholder: null,
    fallback: [],
    approved: false,
    page: "core",
    shot: {
      id: `${kind}_test`,
      kind,
      facing,
      frames: 1,
      tiers: ["P0"],
      anchors: [anchor],
      bases: [null],
      templates: [],
      canvas: [256, 256],
      masterScale: 2,
      pose: "sit",
      placeholders: {},
      lint,
      attachRequired: [],
      attach: {},
      target: null,
      approved: [],
      row: [],
    },
  };
}

function lint(img: Img, frame = frameFor()) {
  const meta = analyzeFrame(img, frame, new Map());
  return checkFrame(img, frame, meta, { profile: "smooth" }).map((i) => `${i.level} ${i.code}`);
}

/** A keyed disc sitting on the ground line, with an optional rim painted around it. */
function groundDisc(rim?: { colour: RGB; width: number }) {
  const discs: Disc[] = [];
  if (rim) discs.push({ cx: 128, cy: 150, r: 90, colour: rim.colour });
  discs.push({ cx: 128, cy: 150, r: rim ? 90 - rim.width : 90, colour: CREAM });
  discs.push(
    { cx: 97, cy: 120, r: 11, colour: [0, 0, 0] as RGB },
    { cx: 159, cy: 120, r: 11, colour: [0, 0, 0] as RGB },
  );
  const keyed = softKey(paint(256, 256, MAGENTA, discs).img);
  return alignFrame(keyed, { anchorType: "gnd", facing: "front", canvas: [256, 256] }, 1).image;
}

/** A raw strip of `n` duck frames side by side, each in a `cell` px square, bobbing by `bob`. */
function duckStrip(n: number, cell: number, bob: number[] = []) {
  const discs = Array.from({ length: n }, (_, k) =>
    duck(cell, cell, 0, bob[k] ?? 0).map((d) => ({ ...d, cx: d.cx + k * cell })),
  ).flat();
  return encodePng(paint(n * cell, cell, MAGENTA, discs, 2).img);
}

// These suites push real images through the pipeline. They take about a second each, but v8
// coverage instrumentation (npm run test:coverage, CI) slows the pixel loops about 10x, so
// they get a generous timeout instead of vitest's 5 s default.
const HEAVY = { timeout: 60_000 };

describe("soft keyer", HEAVY, () => {
  const { img: raw, coverage: truth } = paint(256, 256, MAGENTA, [
    { cx: 128.3, cy: 121.7, r: 70.4, colour: CREAM },
  ]);
  const keyed = softKey(raw);

  it("recovers the anti-aliased coverage of a circle on magenta (golden image)", () => {
    let maxErr = 0;
    let colourErr = 0;
    for (let i = 0; i < truth.length; i++) {
      maxErr = Math.max(maxErr, Math.abs(keyed.data[i * 4 + 3] - truth[i] * 255));
      // Unmixing divides by alpha, so 8-bit rounding is amplified on faint pixels; judge colour where alpha >= 25%.
      if (keyed.data[i * 4 + 3] >= 64) {
        for (let c = 0; c < 3; c++)
          colourErr = Math.max(colourErr, Math.abs(keyed.data[i * 4 + c] - CREAM[c]));
      }
    }
    // Coverage below t0 (about 4%) is dropped as background noise; everything else is exact.
    expect(maxErr).toBeLessThanOrEqual(11);
    expect(colourErr).toBeLessThanOrEqual(3);
    if (envFlag("UPDATE_GOLDEN")) writePng(GOLDEN, keyed);
    const golden = decodePng(readBytes(GOLDEN));
    expect([golden.width, golden.height]).toEqual([256, 256]);
    let diff = 0;
    for (let i = 0; i < golden.data.length; i++)
      diff = Math.max(diff, Math.abs(golden.data[i] - keyed.data[i]));
    expect(diff).toBeLessThanOrEqual(1);
  });

  it("leaves no magenta fringe, and the fringe check catches one", () => {
    expect(magentaPixels(keyed)).toBe(0);
    const fringed = groundDisc();
    const ring = paint(256, 256, MAGENTA, [
      { cx: 128, cy: 150, r: 90, colour: [250, 120, 235] },
    ]).img;
    for (let i = 0; i < fringed.data.length; i += 4) {
      if (fringed.data[i + 3] > 0 && fringed.data[i + 3] < 255)
        fringed.data.set([ring.data[i], ring.data[i + 1], ring.data[i + 2]], i);
    }
    expect(magentaPixels(fringed)).toBeGreaterThan(0);
    expect(lint(fringed)).toContain("ERR magenta");
    expect(lint(groundDisc())).not.toContain("ERR magenta");
  });

  it("despills a magenta-tinted edge colour", () => {
    const { img } = paint(128, 128, MAGENTA, [{ cx: 64, cy: 64, r: 40, colour: CREAM }]);
    // Tint the whole anti-aliased ring pink (the classic generator halo) and key again.
    for (let i = 0; i < img.data.length; i += 4) {
      const g = img.data[i + 1];
      if (g > 20 && g < 200) img.data[i + 1] = Math.max(0, g - 30);
    }
    expect(magentaPixels(softKey(img))).toBe(0);
  });

  it("v1-faithful hard-thresholds alpha", () => {
    const hard = softKey(raw, { profile: "v1-faithful" });
    const values = new Set<number>();
    for (let i = 3; i < hard.data.length; i += 4) values.add(hard.data[i]);
    expect([...values].sort((a, b) => a - b)).toEqual([0, 255]);
  });
});

describe("background inspection", () => {
  it("accepts flat magenta", () => {
    expect(inspectBackground(paint(256, 256, MAGENTA, duck()).img).ok).toBe(true);
  });

  it("rejects a painted checkerboard", () => {
    const img = createImage(256, 256, [255, 255, 255, 255]);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++)
        if (((x >> 4) + (y >> 4)) % 2) img.data.set([204, 204, 204, 255], (y * 256 + x) * 4);
    }
    drawOver(img, softKey(paint(256, 256, MAGENTA, duck()).img), 0, 0);
    const res = inspectBackground(img);
    expect(res.ok).toBe(false);
    expect(res.checkerboard).toBe(true);
    expect(res.message).toMatch(/regenerate on #FF00FF/);
  });
});

describe("frame lint", HEAVY, () => {
  it("flags see-through eye holes and passes solid eyes", () => {
    const solid = groundDisc();
    expect(findHoles(solid)).toHaveLength(0);
    const eyes = detectEyes(solid);
    expect(eyes).toHaveLength(2);
    for (const e of eyes) expect(Math.abs(e.r * 2 - 22)).toBeLessThanOrEqual(2);
    const holed = softKey(
      paint(256, 256, MAGENTA, [
        { cx: 128, cy: 150, r: 90, colour: CREAM },
        { cx: 97, cy: 120, r: 11, colour: CREAM, cut: true },
      ]).img,
    );
    expect(findHoles(holed).length).toBe(1);
    expect(lint(holed)).toContain("ERR holes");
    expect(lint(solid)).not.toContain("ERR holes");
  });

  it("errors on a dark outline or a grey halo, not on an own-colour rim", () => {
    expect(lint(groundDisc({ colour: [40, 36, 34], width: 3 }))).toContain("ERR dark_rim");
    expect(lint(groundDisc({ colour: [150, 150, 150], width: 3 }))).toContain("ERR dark_rim");
    expect(lint(groundDisc({ colour: [0xcc, 0xa9, 0x82], width: 3 }))).not.toContain(
      "ERR dark_rim",
    );
    expect(rimStats(groundDisc()).darkShare).toBe(0);
    // Props may have dark rims; only earl_* and baby_* frames are held to it.
    expect(
      lint(groundDisc({ colour: [40, 36, 34], width: 3 }), frameFor("prop", "prop", "prop")),
    ).not.toContain("ERR dark_rim");
  });

  it("honours per-shot lint skips", () => {
    const holed = softKey(
      paint(256, 256, MAGENTA, [
        { cx: 128, cy: 150, r: 90, colour: CREAM },
        { cx: 97, cy: 120, r: 11, colour: CREAM, cut: true },
      ]).img,
    );
    expect(lint(holed, frameFor("earl", "front", "gnd", { skip: ["holes"] }))).not.toContain(
      "ERR holes",
    );
  });
});

describe("alignment", HEAVY, () => {
  it("puts gnd feet on y=240 and the eye midpoint on x=128", () => {
    const keyed = softKey(paint(256, 256, MAGENTA, duck(256, 256, -30, -40)).img);
    const { image } = alignFrame(
      keyed,
      { anchorType: "gnd", facing: "front", canvas: [256, 256] },
      1,
    );
    expect(alphaBBox(image)?.y1).toBe(240);
    const eyes = detectEyes(image);
    expect(Math.abs((eyes[0].x + eyes[1].x) / 2 - 128)).toBeLessThanOrEqual(1);
    expect(lint(image)).not.toContain("ERR baseline");
  });

  it("aligns at the 512 master level with the same rules", () => {
    const keyed = softKey(paint(512, 512, MAGENTA, duck(512, 512, 12, 25)).img);
    const { image } = alignFrame(
      keyed,
      { anchorType: "gnd", facing: "front", canvas: [256, 256] },
      2,
    );
    expect([image.width, image.height]).toEqual([512, 512]);
    expect(alphaBBox(image)?.y1).toBe(481);
  });

  it("centres ctr frames and puts props on their ground line", () => {
    const keyed = softKey(paint(256, 256, MAGENTA, [{ cx: 60, cy: 70, r: 40, colour: CREAM }]).img);
    const ctr = alphaBBox(
      alignFrame(keyed, { anchorType: "ctr", facing: "front", canvas: [256, 256] }, 1).image,
    );
    expect(Math.abs((ctr!.x0 + ctr!.x1) / 2 - 128)).toBeLessThanOrEqual(1);
    expect(Math.abs((ctr!.y0 + ctr!.y1) / 2 - 128)).toBeLessThanOrEqual(1);
    const prop = alphaBBox(
      alignFrame(keyed, { anchorType: "prop", facing: "prop", canvas: [384, 192] }, 1).image,
    );
    expect(prop!.y1).toBe(176);
  });

  it("lines an expression edit up with its base", () => {
    const base = groundDisc();
    const moved = createImage(256, 256);
    blit(moved, base, 6, -4);
    const res = alignOverlay(moved, base);
    expect(res.scale).toBe(1);
    expect([res.tx, res.ty]).toEqual([-6, 4]);
    expect(alphaIoU(res.image, base)).toBeGreaterThan(0.99);
  });

  it("splits a strip on its magenta gaps and checks the frame count", () => {
    const { img } = paint(600, 200, MAGENTA, [
      { cx: 100, cy: 100, r: 60, colour: CREAM },
      { cx: 300, cy: 100, r: 60, colour: CREAM },
      { cx: 500, cy: 100, r: 60, colour: CREAM },
    ]);
    const keyed = softKey(img);
    expect(splitStrip(keyed, 3)).toHaveLength(3);
    expect(() => splitStrip(keyed, 2)).toThrow(/3 frames/);
  });
});

const regenerateFrom = (md: string) => buildShotsDoc(parseShotlist(md), null);

describe("shot list", () => {
  const doc = loadDoc(ROOT);
  const frames = listFrames(doc);

  it("has the 135 frames of ART_SHOTLIST section 8", () => {
    expect(frames).toHaveLength(135);
    const tiers: Record<string, number> = {};
    const kinds: Record<string, number> = {};
    for (const f of frames) {
      tiers[f.tier] = (tiers[f.tier] || 0) + 1;
      const k = f.shot.kind === "acc" ? "prop" : f.shot.kind;
      kinds[k] = (kinds[k] || 0) + 1;
    }
    expect(tiers).toEqual({ P0: 63, P1: 61, P2: 11 });
    expect(kinds).toEqual({ earl: 98, baby: 5, prop: 29, icon: 3 });
    for (const f of frames) expect(f.id).toMatch(/^(earl|baby|prop|acc|icon)(_[a-z0-9]+)+_\d\d$/);
  });

  it("art/shots.json is in sync with docs/ART_SHOTLIST.md", () => {
    expect(stringifyDoc(regenerateDoc(ROOT, doc))).toBe(stringifyDoc(doc));
  });

  it("art/SHOTLIST.md regenerates and matches ART_SHOTLIST.md", () => {
    const generated = renderShotlist(doc);
    expect(readText(join(ROOT, "art/SHOTLIST.md"))).toBe(generated);
    const src = parseShotlist(readText(join(ROOT, "docs/ART_SHOTLIST.md")));
    const gen = parseShotlist(generated);
    expect(gen.templates).toEqual(src.templates);
    expect(gen.intro).toBe(src.intro);
    expect(gen.sections.map((s) => [s.id, s.title, s.columns, s.rows, s.intro, s.outro])).toEqual(
      src.sections.map((s) => [s.id, s.title, s.columns, s.rows, s.intro, s.outro]),
    );
  });

  // Every prompt of a shot, finished for the default profile.
  const promptsOf = (s: (typeof doc.shots)[number]) =>
    promptUnits(s).map((u) => ({
      ...u,
      text: shotPrompt(doc, s, u.template, { frame: u.frames[0] }),
    }));
  const prompt = (key: string) => {
    for (const s of doc.shots) for (const p of promptsOf(s)) if (p.key === key) return p.text;
    throw new Error(`no prompt ${key}`);
  };

  it("gives every baby prompt the baby body colour, never Earl's cream", () => {
    const babies = doc.shots.filter((s) => s.kind === "baby");
    expect(babies.length).toBe(4);
    for (const s of babies)
      for (const p of promptsOf(s)) {
        expect(p.text, p.key).toMatch(/butter-yellow/);
        expect(p.text, p.key).toMatch(/BABY STYLE LOCK/);
        expect(p.text, p.key).not.toMatch(/pale cream body/);
      }
    expect(prompt("baby_sit_01:T5")).toMatch(/butter-yellow fluff \(#FFE68A base/);
    expect(prompt("earl_sit_idle_01:T1")).toMatch(/pale cream body \(#F8E9C7\)/);
  });

  it("has v1's six held poses: still, left/right (mirrored), up, down and fast", () => {
    const ids = new Set(frames.map((f) => f.id));
    for (const id of [
      "earl_held_01",
      "earl_held_side_01",
      "earl_held_up_01",
      "earl_held_down_01",
      "earl_flail_01",
    ])
      expect(ids.has(id), id).toBe(true);
  });

  it("fills strip prompts (T4) with the frame count, every Frame clause, and wide framing", () => {
    const strips = doc.shots.filter((s) =>
      s.templates.some((t) => (t ? t.split("/") : []).includes("T4")),
    );
    expect(strips.map((s) => s.id)).toEqual([
      "earl_walk",
      "earl_run",
      "earl_climb",
      "earl_carry_overhead",
      "baby_walk",
    ]);
    for (const s of strips) {
      const p = shotPrompt(doc, s, "T4");
      expect(p).toContain(`strip of ${s.frames} frames`);
      expect(p.match(/Frame \d+: [a-z][^.<]+\./g)?.length, s.id).toBe(s.frames);
      expect(p).toMatch(/FRAMING: wide 16:9 image/);
      expect(p).toMatch(/fill most of the frame height/);
      expect(p).not.toMatch(/square image/);
    }
    expect(prompt("earl_run:T4")).toContain(
      "Frame 2: airborne, body leaning forward, wings flared back, both feet tucked up under him.",
    );
    expect(prompt("baby_walk:T4")).toContain("of this exact baby duckling");
    // Single images keep the lock's square framing.
    expect(prompt("earl_sit_idle_01:T1")).toMatch(/FRAMING: square image/);
  });

  it("finishes every prompt: no placeholder, backtick, doubled period or note, in both profiles", () => {
    const catalog = promptCatalog(doc);
    expect(catalogProblems(catalog)).toEqual([]);
    for (const s of catalog.shots)
      for (const p of s.prompts)
        for (const text of Object.values(p.text)) {
          expect(text, p.key).not.toMatch(/[<>`]/);
          expect(text, p.key).not.toMatch(/(?<!\.)\.\.(?!\.)/);
          expect(text, p.key).not.toMatch(/set in the lineup|tauri|\.png/i);
          expect(text, p.key).not.toMatch(/\bno dithering\. crisp/);
        }
    expect(catalog.shots[0].prompts[0].text["v1-faithful"]).toMatch(
      /no dithering\. Crisp sprite edges like the reference, no soft blur\./,
    );
    expect(catalog.shots[0].prompts[0].text.smooth).toMatch(
      /no dithering\. Smooth clean anti-aliased edges\./,
    );
  });

  it("gives every frame its own prompt, with the old guide's values filled in", () => {
    for (const s of doc.shots)
      for (let k = 1; k <= s.frames; k++)
        expect(
          promptUnits(s).some((u) => u.frames.includes(k)),
          `${s.id} ${k}`,
        ).toBe(true);
    expect(prompt("earl_tilt_01:T2")).toContain(
      "Expression: curious, eyes extra glossy, bill slightly open.",
    );
    const ball = prompt("prop_ball_01:T6");
    expect(ball).toContain("Colors: teal #3FA7A0 with a cream #FBF3DD stripe.");
    expect(ball).toContain(
      "Size: about 84 px across next to Earl's 212 px height, a bit over half his width.",
    );
    expect(ball).toContain("View: front.");
    expect(prompt("earl_held_down_01:T2")).toContain("pulled fast downward by the scruff");
    expect(prompt("prop_bread_02:T7")).toContain(
      "Change ONLY: take one bite out of the top corner",
    );
  });

  it("describes only its own frame in each frame's prompt (Master #2 is earl_walk_02)", () => {
    const master2 = prompt("earl_walk_02:T1");
    expect(master2).toContain("feet together under his body");
    expect(master2).not.toMatch(
      /near foot stepping forward|far foot stepping forward|Master|\b0\d:/,
    );
    for (const s of doc.shots.filter((x) => x.frames > 1))
      for (const p of promptsOf(s).filter((u) => !u.strip))
        expect(p.text, p.key).not.toMatch(/\b0\d[:\s-]/);
  });

  it("puts the STYLE LOCK on face edits (T3) and keeps air poses off the ground line (T2)", () => {
    for (const s of doc.shots)
      for (const p of promptsOf(s).filter((u) => u.template === "T3"))
        expect(p.text, p.key).toMatch(/\nSTYLE LOCK: .*\nBACKGROUND: .*\nFRAMING: square image/);
    expect(prompt("earl_flail_01:T2")).toContain(
      "He is in mid-air, so his feet do not touch the ground line",
    );
    expect(prompt("earl_flail_01:T2")).not.toContain("Keep his feet on the same ground line");
    expect(prompt("earl_tilt_01:T2")).toContain("Keep his feet on the same ground line");
  });

  it("emits every shot, frame and finished prompt as JSON (art.mjs shots --json)", () => {
    const run = runNode(["scripts/art.mjs", "shots", "--json"], ROOT);
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    const json = JSON.parse(run.stdout);
    expect(json.counts).toEqual({ shots: 101, frames: 135, prompts: 130 });
    expect(json.shots).toHaveLength(101);
    const ids = json.shots.flatMap((s: { frames: { id: string }[] }) => s.frames.map((f) => f.id));
    expect(ids).toEqual(frames.map((f) => f.id));
    const byKey = new Map<string, { text: Record<string, string> }>();
    for (const s of json.shots) for (const p of s.prompts) byKey.set(p.key, p);
    for (const s of json.shots)
      for (const f of s.frames) {
        expect(f.prompts.length, f.id).toBeGreaterThan(0);
        expect(["A", "B", "C", "D", "E"]).toContain(f.batch);
        expect(f.tier).toMatch(/^P[0-2]$/);
        expect(f.template).toMatch(/^T\d(\/T\d)?$/);
        for (const key of f.prompts) expect(byKey.get(key)?.text["v1-faithful"], key).toBeTruthy();
      }
    expect(json.shots[0].frames[0]).toMatchObject({
      id: "earl_sit_idle_01",
      tier: "P0",
      batch: "A",
    });
    expect(json).toEqual(JSON.parse(JSON.stringify(promptCatalog(doc))));
  });

  it("rejects prompt values for a frame or template that does not exist", () => {
    const md = readText(join(ROOT, "docs/ART_SHOTLIST.md"));
    const typo = md.replace("| earl_tilt_01 | sitting", "| earl_tilt_09 | sitting");
    expect(() => regenerateFrom(typo)).toThrow(/no frame "earl_tilt_09"/);
    const wrong = md.replace("| baby_sit_01 | sitting", "| earl_tilt_01 | sitting");
    expect(() => regenerateFrom(wrong)).toThrow(/earl_tilt_01 does not use T5/);
  });

  it("maps the v1 sprites that exist to placeholders", () => {
    const withPh = frames.filter((f) => f.placeholder);
    expect(withPh.length).toBe(21);
    for (const f of withPh) expect(exists(join(ROOT, f.placeholder!))).toBe(true);
  });
});

describe("pipeline", HEAVY, () => {
  it("builds placeholders from v1 art at 2x and reports coverage", () => {
    const all = computeAll(ROOT);
    expect(coverageLine(coverage(all))).toBe("final 0/135, placeholder 21");
    const idle = all.results.get("earl_sit_idle_01")!;
    expect(idle.source).toBe("placeholder");
    expect([idle.l1!.width, idle.l2!.width]).toEqual([256, 512]);
    expect(idle.meta!.bbox!.y1).toBe(240);
    expect(idle.issues.filter((i) => i.level === "ERR")).toEqual([]);
    // v1 pouty and huffy are separate drawings, not edits of sit_idle: they keep the ground line.
    for (const id of ["earl_sit_pouty_01", "earl_sit_huffy_01"]) {
      const r = all.results.get(id)!;
      expect(r.meta!.bbox!.y1).toBe(240);
      expect(r.issues.map((i) => i.code)).not.toContain("baseline");
    }
    // v1 blink really is an edit of sit_idle, so it still lines up with it.
    expect(all.results.get("earl_sit_blink_01")!.issues.map((i) => i.code)).not.toContain(
      "ovl_moved",
    );
  });

  it("packs atlas rects without overlap, deterministically", () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      id: `f${String(i).padStart(2, "0")}`,
      w: 20 + ((i * 37) % 90),
      h: 15 + ((i * 53) % 80),
    }));
    const a = pack(items);
    expect(pack([...items].reverse())).toEqual(a);
    const rects = [...a.rects.values()];
    for (let i = 0; i < rects.length; i++) {
      const [x, y, w, h] = rects[i];
      expect(x + w).toBeLessThanOrEqual(a.width);
      expect(y + h).toBeLessThanOrEqual(a.height);
      for (let j = i + 1; j < rects.length; j++) {
        const [x2, y2, w2, h2] = rects[j];
        expect(x < x2 + w2 && x2 < x + w && y < y2 + h2 && y2 < y + h).toBe(false);
      }
    }
  });

  it("imports a raw export from an inbox into an aligned master and builds", async () => {
    const tmp = makeTempDir("earl-art-");
    try {
      mkdirp(join(tmp, "art/inbox"));
      mkdirp(join(tmp, "docs"));
      copy(join(ROOT, "art/shots.json"), join(tmp, "art/shots.json"));
      copy(join(ROOT, "docs/ART_SHOTLIST.md"), join(tmp, "docs/ART_SHOTLIST.md"));
      const quiet = () => {};
      expect(
        (await importInbox(tmp, { inbox: join(tmp, "missing"), log: quiet })).outcomes,
      ).toEqual([]);
      expect(
        (await importInbox(tmp, { inbox: join(tmp, "art/inbox"), log: quiet })).outcomes,
      ).toEqual([]);
      writeBytes(
        join(tmp, "art/inbox/earl_sit_idle__take1.png"),
        encodePng(paint(1024, 1024, MAGENTA, duck(1024, 1024, 40, -60), 2).img),
      );
      writeBytes(join(tmp, "art/inbox/not_a_shot.png"), encodePng(createImage(4, 4)));
      const { outcomes } = await importInbox(tmp, {
        inbox: join(tmp, "art/inbox"),
        profile: "smooth",
        log: quiet,
      });
      expect(outcomes.map((o) => [o.id, o.ok])).toEqual([["earl_sit_idle_01", true]]);
      expect(listFiles(join(tmp, "art/inbox"))).toEqual(["not_a_shot.png"]);
      expect(listFiles(join(tmp, "art/inbox/imported"))).toEqual(["earl_sit_idle__take1.png"]);
      const master = decodePng(readBytes(join(tmp, "art/masters/earl_sit_idle_01.png")));
      expect([master.width, master.height]).toEqual([512, 512]);
      expect(alphaBBox(master)?.y1).toBe(481);
      // A stale atlas page is dropped; anything else in the atlas folder is left alone.
      const atlas = join(tmp, "src/assets/atlas");
      mkdirp(join(atlas, "notes"));
      writeBytes(join(atlas, "old_256.png"), encodePng(createImage(4, 4)));
      const { all } = build(tmp, computeAll(tmp, { ...loadDoc(tmp), profile: "smooth" }));
      expect(exists(join(atlas, "old_256.png"))).toBe(false);
      expect(exists(join(atlas, "notes"))).toBe(true);
      expect(all.results.get("earl_sit_idle_01")!.status).toMatch(/^(OK|WARN)$/);
      const gen = readText(join(tmp, "src/sim/anim/sprites.gen.ts"));
      expect(gen).toMatch(/export type FrameId =/);
      expect(gen).toMatch(/core_512\.png/);
      expect(exists(join(tmp, "src/assets/atlas/core_256.png"))).toBe(true);
    } finally {
      removeDir(tmp);
    }
  });

  it("imports strips: baseless ones fill the canvas, based ones match their base", async () => {
    const tmp = makeTempDir("earl-art-");
    try {
      const inbox = join(tmp, "art/inbox");
      mkdirp(inbox);
      mkdirp(join(tmp, "docs"));
      copy(join(ROOT, "art/shots.json"), join(tmp, "art/shots.json"));
      copy(join(ROOT, "docs/ART_SHOTLIST.md"), join(tmp, "docs/ART_SHOTLIST.md"));
      const run = () => importInbox(tmp, { inbox, profile: "smooth", log: () => {} });
      const bbox = (id: string) =>
        alphaBBox(decodePng(readBytes(join(tmp, `art/masters/${id}.png`))))!;

      // earl_run is scaled to match earl_walk_02: on its own it fails and stays in the inbox.
      writeBytes(join(inbox, "earl_run.png"), duckStrip(4, 256));
      const first = await run();
      expect(first.outcomes).toHaveLength(1);
      expect(first.outcomes[0]).toMatchObject({ id: "earl_run", ok: false });
      expect(first.outcomes[0].error).toMatch(/import earl_walk_02 first/);
      expect(listFiles(inbox)).toEqual(["earl_run.png"]);

      // earl_walk (the docs' strip example) has no base and prop_fan's base is its own first
      // frame, so both scale like a single raw of the same cell size. (prop_blanket bases
      // prop_bed_01, outside its strip, so it scales to match that master the way earl_run does.)
      writeBytes(join(inbox, "earl_walk.png"), duckStrip(3, 512, [0, -6, 0]));
      writeBytes(join(inbox, "prop_fan.png"), duckStrip(3, 512));
      const second = await run();
      const ids = (shot: string, n: number) =>
        Array.from({ length: n }, (_, k) => `${shot}_0${k + 1}`);
      expect(second.outcomes.filter((o) => !o.ok)).toEqual([]);
      expect(second.outcomes.map((o) => o.id)).toEqual([
        ...ids("earl_walk", 3),
        ...ids("earl_run", 4),
        ...ids("prop_fan", 3),
      ]);
      for (const id of ids("earl_walk", 3)) {
        const bb = bbox(id);
        expect(bb.y1).toBe(481);
        // A 512 px cell fills the 512 master 1:1, as a 1024 px single raw does at half scale.
        expect(Math.abs(bb.h - 360)).toBeLessThanOrEqual(3);
      }
      for (const id of ids("prop_fan", 3))
        expect(Math.abs(bbox(id).h - 360)).toBeLessThanOrEqual(3);
      const walkH = bbox("earl_walk_02").h;
      for (const id of ids("earl_run", 4))
        expect(Math.abs(bbox(id).h - walkH)).toBeLessThanOrEqual(2);

      // Imported raws move aside, so the next import has nothing to redo.
      expect(listFiles(inbox)).toEqual([]);
      expect(listFiles(join(inbox, "imported"))).toEqual([
        "earl_run.png",
        "earl_walk.png",
        "prop_fan.png",
      ]);
      expect((await run()).outcomes).toEqual([]);
    } finally {
      removeDir(tmp);
    }
  });
});

describe("contact sheet", () => {
  it("wraps the status line at word boundaries instead of cutting codes off", () => {
    const words = [
      "PLACEHOLDER",
      "P0",
      "baseline,",
      "holes,",
      "dark_rim,",
      "eye_size,",
      "body_colour",
    ];
    const lines = wrapWords(words, 31);
    expect(lines).toEqual(["PLACEHOLDER P0 baseline, holes,", "dark_rim, eye_size, body_colour"]);
    expect(wrapWords(["OK", "P1"], 31)).toEqual(["OK P1"]);
  });
});

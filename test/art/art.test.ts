import { describe, expect, it } from "vitest";
import {
  alignFrame,
  alignOverlay,
  alphaBBox,
  alphaIoU,
  analyzeFrame,
  blit,
  build,
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
  parseShotlist,
  regenerateDoc,
  renderShotlist,
  rimStats,
  shotPrompt,
  softKey,
  splitStrip,
  stringifyDoc,
  writePng,
  type Frame,
  type Img,
} from "../../scripts/art/lib/index.mjs";
import {
  ROOT,
  copy,
  envFlag,
  exists,
  join,
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

describe("shot list", () => {
  const doc = loadDoc(ROOT);
  const frames = listFrames(doc);

  it("has the 133 frames of ART_SHOTLIST section 8", () => {
    expect(frames).toHaveLength(133);
    const tiers: Record<string, number> = {};
    const kinds: Record<string, number> = {};
    for (const f of frames) {
      tiers[f.tier] = (tiers[f.tier] || 0) + 1;
      const k = f.shot.kind === "acc" ? "prop" : f.shot.kind;
      kinds[k] = (kinds[k] || 0) + 1;
    }
    expect(tiers).toEqual({ P0: 63, P1: 59, P2: 11 });
    expect(kinds).toEqual({ earl: 96, baby: 5, prop: 29, icon: 3 });
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

  it("gives every baby prompt the baby body colour, never Earl's cream", () => {
    const babies = doc.shots.filter((s) => s.kind === "baby");
    expect(babies.length).toBe(4);
    for (const s of babies) {
      const p = shotPrompt(doc, s, "T5");
      expect(p).toMatch(/butter-yellow/);
      expect(p).not.toMatch(/pale cream body/);
    }
    const earl = shotPrompt(doc, doc.shots[0], "T1");
    expect(earl).toMatch(/pale cream body \(#F8E9C7\)/);
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
    expect(coverageLine(coverage(all))).toBe("final 0/133, placeholder 21");
    const idle = all.results.get("earl_sit_idle_01")!;
    expect(idle.source).toBe("placeholder");
    expect([idle.l1!.width, idle.l2!.width]).toEqual([256, 512]);
    expect(idle.meta!.bbox!.y1).toBe(240);
    expect(idle.issues.filter((i) => i.level === "ERR")).toEqual([]);
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
      const master = decodePng(readBytes(join(tmp, "art/masters/earl_sit_idle_01.png")));
      expect([master.width, master.height]).toEqual([512, 512]);
      expect(alphaBBox(master)?.y1).toBe(481);
      const { all } = build(tmp, computeAll(tmp, { ...loadDoc(tmp), profile: "smooth" }));
      expect(all.results.get("earl_sit_idle_01")!.status).toMatch(/^(OK|WARN)$/);
      const gen = readText(join(tmp, "src/sim/anim/sprites.gen.ts"));
      expect(gen).toMatch(/export type FrameId =/);
      expect(gen).toMatch(/core_512\.png/);
      expect(exists(join(tmp, "src/assets/atlas/core_256.png"))).toBe(true);
    } finally {
      removeDir(tmp);
    }
  });
});

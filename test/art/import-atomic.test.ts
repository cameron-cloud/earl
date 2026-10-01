// importInbox stages every frame of a strip before it writes any master (pipeline.mjs), so a
// strip that fails partway leaves no half-imported set behind and its raw stays in the inbox.
// The failure is injected into alignFrame, which processRaw calls once per frame; it lives in
// its own file because vi.mock replaces the module for the whole test file.
import { describe, expect, it, vi } from "vitest";
import { encodePng, importInbox } from "../../scripts/art/lib/index.mjs";
import {
  copy,
  exists,
  join,
  listFiles,
  makeTempDir,
  mkdirp,
  removeDir,
  ROOT,
  writeBytes,
} from "./node-helpers.mjs";
import { MAGENTA, duck, paint } from "./synth";

const inject = vi.hoisted(() => ({ calls: 0, failOn: 0 }));

vi.mock("../../scripts/art/lib/align.mjs", async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  const alignFrame = real.alignFrame as (...args: unknown[]) => unknown;
  return {
    ...real,
    alignFrame: (...args: unknown[]) => {
      inject.calls++;
      if (inject.calls === inject.failOn)
        throw new Error(`injected failure on call ${inject.calls}`);
      return alignFrame(...args);
    },
  };
});

function duckStrip(n: number, cell: number) {
  const discs = Array.from({ length: n }, (_, k) =>
    duck(cell, cell, 0, 0).map((d) => ({ ...d, cx: d.cx + k * cell })),
  ).flat();
  return encodePng(paint(n * cell, cell, MAGENTA, discs, 2).img);
}

describe("importInbox strip staging", { timeout: 60_000 }, () => {
  it("writes no master when a strip fails partway, then imports it whole on retry", async () => {
    const tmp = makeTempDir("earl-art-atomic-");
    try {
      const inbox = join(tmp, "art/inbox");
      mkdirp(inbox);
      mkdirp(join(tmp, "docs"));
      copy(join(ROOT, "art/shots.json"), join(tmp, "art/shots.json"));
      copy(join(ROOT, "docs/ART_SHOTLIST.md"), join(tmp, "docs/ART_SHOTLIST.md"));
      writeBytes(join(inbox, "earl_walk.png"), duckStrip(3, 512));
      const run = () => importInbox(tmp, { inbox, profile: "smooth", log: () => {} });
      const masters = ["earl_walk_01", "earl_walk_02", "earl_walk_03"].map((id) =>
        join(tmp, `art/masters/${id}.png`),
      );

      // Frame 1 processes fine, frame 2 throws: nothing may reach art/masters.
      inject.calls = 0;
      inject.failOn = 2;
      const failed = await run();
      expect(inject.calls).toBe(2);
      expect(failed.outcomes).toHaveLength(1);
      expect(failed.outcomes[0]).toMatchObject({ id: "earl_walk", ok: false });
      expect(failed.outcomes[0].error).toMatch(/injected failure on call 2/);
      for (const m of masters) expect(exists(m), m).toBe(false);
      expect(listFiles(inbox)).toEqual(["earl_walk.png"]);

      // The same raw imports whole once nothing fails.
      inject.calls = 0;
      inject.failOn = 0;
      const ok = await run();
      expect(ok.outcomes.map((o) => [o.id, o.ok])).toEqual([
        ["earl_walk_01", true],
        ["earl_walk_02", true],
        ["earl_walk_03", true],
      ]);
      for (const m of masters) expect(exists(m), m).toBe(true);
      expect(listFiles(inbox)).toEqual([]);
    } finally {
      removeDir(tmp);
    }
  });
});

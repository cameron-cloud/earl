// Vitest smoke test: exercises the dash scanner that `npm run check:dashes` runs in CI.
import { describe, expect, test } from "vitest";
import { findDashes, isBinary } from "../scripts/check-dashes.mjs";
import { join, makeTempDir, removeDir, ROOT, runNode, symlink } from "./art/node-helpers.mjs";

const EN = "\u2013";
const EM = "\u2014";

describe("check-dashes", () => {
  test("accepts plain hyphens", () => {
    expect(findDashes("a - b\nc-d\n")).toEqual([]);
  });

  test("reports en and em dashes with 1-based positions", () => {
    expect(findDashes(`ok\nx ${EN} y\n${EM}`)).toEqual([
      { line: 2, column: 3, name: "en dash (U+2013)" },
      { line: 3, column: 1, name: "em dash (U+2014)" },
    ]);
  });

  test("skips binary files by extension or NUL byte", () => {
    const text = new TextEncoder().encode("hello");
    expect(isBinary("a.png", text)).toBe(true);
    expect(isBinary("a.txt", new Uint8Array([104, 0, 105]))).toBe(true);
    expect(isBinary("a.txt", text)).toBe(false);
  });

  test("scans when run through a symlink instead of exiting 0 unchecked", () => {
    const tmp = makeTempDir("earl-dashes-");
    try {
      const link = join(tmp, "check-dashes.mjs");
      symlink(join(ROOT, "scripts/check-dashes.mjs"), link);
      const run = runNode([link], ROOT);
      expect(run.status).toBe(0);
      const scanned = /check-dashes: (\d+) tracked text files/.exec(run.stdout);
      expect(Number(scanned?.[1])).toBeGreaterThan(0);
    } finally {
      removeDir(tmp);
    }
  });
});

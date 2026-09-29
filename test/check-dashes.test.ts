// Vitest smoke test: exercises the dash scanner that `npm run check:dashes` runs in CI.
import { describe, expect, test } from "vitest";
import { findDashes, isBinary } from "../scripts/check-dashes.mjs";

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
});

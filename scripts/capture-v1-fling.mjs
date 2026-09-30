// Regenerates test/fixtures/v1-fling/*.json from v1's own fling code (docs/V2_PLAN.md 5.4).
// It runs test/v1-fling-capture.test.ts with CAPTURE_V1_FLING=1; plain `npm test` only checks
// that the committed fixtures still match. Works until M1.4 deletes the v1 engine.
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["vitest", "run", "test/v1-fling-capture.test.ts"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, CAPTURE_V1_FLING: "1" },
});
process.exit(result.status ?? 1);

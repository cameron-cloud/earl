// v1 fling capture (M0.6). Drives v1's own fling code headlessly and records golden
// trajectories for the M1.3 parity test (docs/V2_PLAN.md 5.4).
//
// v1's step functions are pure (src/engine/physics.ts, stateMachine.ts, animator.ts), but the
// frame loop that calls them lives in a React hook (src/hooks/useEarlBehavior.ts:200-314). This
// file replays that loop body in the same order for the airborne states, with v1's release
// handler (useEarlBehavior.ts:600-647). Mood, sound and the window shrink are left out: they do
// not change the path.
//
// Normal runs (npm test): recompute every case and require the committed fixtures to match, so
// the fixtures are provably what v1 produces. Regenerate with: npm run capture:v1-fling
// M1.4 deletes the v1 engine and this file with it; the fixtures stay for M1.3's parity test.
import { describe, expect, it } from "vitest";
import {
  clampToScreen,
  createPosition,
  updatePosition,
  type Position,
} from "../src/engine/physics";
import {
  createStateMachine,
  getAnimationForState,
  updateStateMachine,
  type StateMachineState,
} from "../src/engine/stateMachine";
import { createAnimatorState, updateAnimator, type AnimatorState } from "../src/engine/animator";
import { createMoodState } from "../src/engine/mood";
import { envFlag, exists, join, mkdirp, readText, ROOT, writeBytes } from "./art/node-helpers.mjs";

const FIXTURE_DIR = join(ROOT, "test", "fixtures", "v1-fling");
const CAPTURE = envFlag("CAPTURE_V1_FLING");

// A 1920x1080 monitor at 100% scaling with the taskbar visible, Earl at v1's default 64 px.
const WORLD = {
  screenW: 1920,
  screenH: 1080,
  taskbarPad: 40, // TASKBAR_HEIGHT, constants.ts:8
  size: 64, // config.rs:63, constants.ts:3
  stepMs: 1000 / 60,
  animationSpeed: 1, // "normal", constants.ts:31-35
};
const GROUND_Y = WORLD.screenH - WORLD.taskbarPad - WORLD.size; // physics.ts:49
const MAX_STEPS = 60 * 12;
const PATH_EVERY = 3; // record the path every 3 steps (50 ms)
// F1 threshold (docs/V2_PLAN.md 5.4.3): a release counts as upward only when vy <= -200 px/s,
// v1's own drop-or-throw speed (stateMachine.ts:169-184). Below it v2 keeps v1's max(vy, 0), so
// "lift him up, pause, let go" stays a v1 drop and never arms the chute.
const V_UP_MIN = 200;

interface FlingCase {
  id: string;
  note: string;
  x: number; // box left at release, px
  height: number; // box top above its ground position at release, px
  vx: number; // release velocity from useDrag.ts:91-102, CSS px/s, y down
  vy: number;
}

// Release x and height are chosen so each case shows one v1 rule. The 150 px cases sit below the
// parachute's 200 px arming floor (5.5), so they match with the chute on under any arming rule.
// The cases released higher than 200 px (300 px and up) are the ones that check F3: a level,
// downward or slow upward release never arms the chute, so they must still match with it on.
const CASES: FlingCase[] = [
  {
    id: "slow-drop",
    note: "under 200 px/s: FALLING, vx discarded",
    x: 900,
    height: 150,
    vx: 120,
    vy: 60,
  },
  {
    id: "gentle-right",
    note: "200-599 px/s: SLIDING at 0.5 vx",
    x: 900,
    height: 150,
    vx: 400,
    vy: 0,
  },
  {
    id: "fast-left",
    note: "600-1199 px/s: TUMBLING at 0.8 vx",
    x: 900,
    height: 150,
    vx: -1000,
    vy: 100,
  },
  {
    id: "fast-right",
    note: "1200+ px/s: TUMBLING at 1.0 vx",
    x: 900,
    height: 150,
    vx: 1500,
    vy: 100,
  },
  {
    id: "diagonal-down",
    note: "TUMBLING, downward start under terminal",
    x: 700,
    height: 300,
    vx: 700,
    vy: 500,
  },
  {
    id: "straight-down",
    note: "slow straight down: FALLING with vy kept",
    x: 900,
    height: 300,
    vx: 0,
    vy: 180,
  },
  {
    id: "straight-down-fast",
    note: "TUMBLING with no vx: v1 mid-air stop (K3)",
    x: 900,
    height: 300,
    vx: 0,
    vy: 900,
  },
  {
    id: "upward",
    note: "up and right: v1 drops the upward part (bug 13)",
    x: 900,
    height: 150,
    vx: 400,
    vy: -900,
  },
  {
    id: "upward-straight",
    note: "straight up: v1 mid-air stop (K3)",
    x: 900,
    height: 150,
    vx: 0,
    vy: -1000,
  },
  {
    id: "wall-slide",
    note: "SLIDING into the left wall: pinned, no reflect (K4)",
    x: 30,
    height: 400,
    vx: -560,
    vy: 0,
  },
  {
    id: "wall-tumble",
    note: "TUMBLING into the right wall: reflect at 0.6",
    x: 1500,
    height: 400,
    vx: 1400,
    vy: 0,
  },
  {
    id: "v1-cap",
    note: "vy above terminal (600) and a fast vx from high up",
    x: 200,
    height: 700,
    vx: 3000,
    vy: 900,
  },
  {
    id: "high-drop",
    note: "plain drop from high: reaches terminal velocity",
    x: 900,
    height: 800,
    vx: 0,
    vy: 0,
  },
  {
    id: "upward-under-min",
    note: "straight up at 195 px/s, just under the 200 px/s upward minimum: a v1 drop in v2 too",
    x: 900,
    height: 400,
    vx: 0,
    vy: -195,
  },
  {
    id: "upward-over-min",
    note: "straight up at 205 px/s, just over the upward minimum: v2 rises, then falls (F1)",
    x: 900,
    height: 400,
    vx: 0,
    vy: -205,
  },
  {
    id: "ceiling",
    note: "steep up and right: v2 reaches the screen top and reflects at 0.6 (F2)",
    x: 900,
    height: 600,
    vx: 300,
    vy: -2000,
  },
];

type Variant = "v1" | "v2";

interface Metrics {
  tier: string;
  landX: number | null;
  landT: number | null;
  bounces: number;
  wallContacts: number;
  wallHitFrames: number;
  ceilingHits: number;
  midairStop: { t: number; x: number; y: number } | null;
  settleT: number | null;
  controlT: number | null;
  path: [number, number, number][];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function run(c: FlingCase, variant: Variant): Metrics {
  const dt = WORLD.stepMs;
  const mood = createMoodState();
  const { screenW: W, screenH: H, size, taskbarPad: tb } = WORLD;

  // Held: PICKED_UP, box at the release point. The ground is the full-monitor ground (the window
  // is expanded while airborne, useEarlBehavior.ts:574-584).
  let sm: StateMachineState = { ...createStateMachine(false, null), current: "PICKED_UP" };
  let pos: Position = { ...createPosition(c.x, GROUND_Y), y: GROUND_Y - c.height };
  let anim: AnimatorState = createAnimatorState("picked_up");

  // Release, useEarlBehavior.ts:600-647.
  const speed = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
  sm = updateStateMachine(sm, { type: "DRAG_END", velocityX: c.vx, velocityY: c.vy, speed });
  pos = {
    ...pos,
    // v1 discards the upward part (line 619). v2 keeps it when the release counts as upward
    // (vy <= -V_UP_MIN, F1): the one deliberate physics change. A slower upward release is v1's.
    velocityY: variant === "v2" && c.vy <= -V_UP_MIN ? c.vy : Math.max(c.vy, 0),
    velocityX: c.vx,
    fallStartY: pos.y,
    bounceCount: 0,
  };
  let prevState = sm.current;
  anim = createAnimatorState(getAnimationForState(sm.current, false, mood));

  const m: Metrics = {
    tier: sm.current,
    landX: null,
    landT: null,
    bounces: 0,
    wallContacts: 0,
    wallHitFrames: 0,
    ceilingHits: 0,
    midairStop: null,
    settleT: null,
    controlT: null,
    path: [[0, r2(pos.x), r2(pos.y)]],
  };
  let inWall = false;

  for (let step = 1; step <= MAX_STEPS; step++) {
    const t = step * dt;
    const before = { x: pos.x, y: pos.y };

    // 2. State machine tick (slide and tumble friction, stop rules).
    const smBefore = sm.current;
    sm = updateStateMachine(sm, { type: "TICK", deltaMs: dt, mood });
    const airborne = pos.y < GROUND_Y - 1e-6;
    if (smBefore === "TUMBLING" && sm.current === "DROPPED" && airborne && m.landT === null) {
      // K3 (plan 5.4.1): v1 puts a mid-air tumble whose vx fell under 20 px/s straight onto the ground.
      m.midairStop = { t: r2(t), x: r2(pos.x), y: r2(pos.y) };
      if (variant === "v2") {
        // v2: fall straight down from here instead (v1's own SLIDING stop rule, stateMachine.ts:307).
        sm = { ...sm, current: "FALLING", timer: 0, slideVelocityX: 0 };
      }
    }

    // 3. Animation, useEarlBehavior.ts:225-246.
    if (sm.current !== prevState) {
      anim = createAnimatorState(getAnimationForState(sm.current, false, mood));
      prevState = sm.current;
    } else {
      const updated = updateAnimator(anim, dt, WORLD.animationSpeed);
      if (updated.finished && !anim.finished) {
        const after = updateStateMachine(sm, { type: "ANIMATION_FINISHED" });
        if (after.current !== sm.current) {
          anim = createAnimatorState(getAnimationForState(after.current, false, mood));
          prevState = after.current;
        } else {
          anim = updated;
        }
        sm = after;
      } else {
        anim = updated;
      }
    }

    // 4. Physics, useEarlBehavior.ts:248-254.
    const res = updatePosition(
      pos,
      sm.current,
      dt,
      anim.frameIndex,
      W,
      H,
      size,
      sm.slideVelocityX,
      tb,
    );
    pos = res.position;

    if (variant === "v2" && pos.y < 0) {
      // v2 only (upward throws): the screen top reflects like v1's walls (stateMachine.ts:202).
      pos = { ...pos, y: 0, velocityY: -0.6 * pos.velocityY };
      m.ceilingHits++;
    }

    // 5. Events, useEarlBehavior.ts:257-312.
    if (res.landed) {
      if (m.landT === null) {
        m.landT = r2(t);
        m.landX = r2(pos.x);
      } else {
        m.bounces++;
      }
      sm = updateStateMachine(sm, { type: "LANDED", fallDistance: res.fallDistance });
      if (sm.current !== prevState) {
        anim = createAnimatorState(getAnimationForState(sm.current, false, mood));
        prevState = sm.current;
      }
    }
    if (res.tumbleWallHit) {
      m.wallHitFrames++;
      if (!inWall) m.wallContacts++;
      sm = updateStateMachine(sm, { type: "TUMBLE_WALL_HIT" });
    }
    inWall = res.tumbleWallHit;

    // 6. Clamp, useEarlBehavior.ts:314.
    pos = clampToScreen(pos, W, H, size, tb);

    // A mid-air stop with no fall is also a landing (on the ground, at that x).
    if (m.landT === null && m.midairStop && sm.current === "DROPPED") {
      m.landT = r2(t);
      m.landX = r2(pos.x);
    }
    // IDLE sits 0.06 x size lower (physics.ts:155-156): a posture offset, not motion.
    const moved = pos.x !== before.x || pos.y !== before.y;
    if (moved && sm.current !== "IDLE") m.settleT = r2(t);
    if (step % PATH_EVERY === 0) m.path.push([r2(t), r2(pos.x), r2(pos.y)]);

    if (sm.current === "IDLE") {
      // The landing reaction (dropped, 650 ms) finished: the brain has control again.
      m.controlT = r2(t);
      if (step % PATH_EVERY !== 0) m.path.push([r2(t), r2(pos.x), r2(pos.y)]);
      break;
    }
  }
  return m;
}

function capture(c: FlingCase) {
  const speed = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
  const v1 = run(c, "v1");
  const v2 = run(c, "v2");
  const same = JSON.stringify(v1) === JSON.stringify(v2);
  return {
    id: c.id,
    note: c.note,
    source:
      "v1 (origin/master) src/engine/physics.ts, stateMachine.ts, animator.ts, driven in the " +
      "useEarlBehavior.ts:200-314 frame order by test/v1-fling-capture.test.ts",
    world: { ...WORLD, stepMs: r2(WORLD.stepMs), groundY: GROUND_Y },
    release: {
      x: c.x,
      y: GROUND_Y - c.height,
      height: c.height,
      vx: c.vx,
      vy: c.vy,
      speed: r2(speed),
    },
    units: "px (CSS / logical), ms, y down; x is the box's left edge; t is from release",
    v1,
    // What v2 must produce: v1's code with only the deliberate 5.4 changes applied (upward kept
    // at vy <= -V_UP_MIN, ceiling reflect, K3 mid-air stop falls instead). Equal to v1 when none
    // of them apply.
    v2Expected: same ? "same-as-v1" : v2,
  };
}

describe("v1 fling capture", () => {
  for (const c of CASES) {
    it(`${c.id} matches test/fixtures/v1-fling/${c.id}.json`, () => {
      const got = JSON.stringify(capture(c), null, 2) + "\n";
      const file = join(FIXTURE_DIR, `${c.id}.json`);
      if (CAPTURE) {
        mkdirp(FIXTURE_DIR);
        writeBytes(file, new TextEncoder().encode(got));
      }
      expect(exists(file), `${file} missing: run npm run capture:v1-fling`).toBe(true);
      expect(readText(file).replace(/\r\n/g, "\n")).toBe(got);
    });
  }
});

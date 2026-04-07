// Mood system: tracks Earl's emotional state (0-100, default 50)
// Higher = happier, lower = angrier

export interface MoodState {
  value: number;           // 0-100
  driftTimer: number;      // ms since last drift toward 50
  clickTimes: number[];    // timestamps of recent clicks (for spam detection)
  pickupCount: number;     // consecutive pickups for escalating penalty
  pickupResetTimer: number; // ms since last pickup
  wallBumpSameWall: number; // consecutive bumps on same wall
  lastWallSide: "left" | "right" | null;
  justForgave: boolean;    // true when mood crosses back above a threshold
}

export type MoodTier = "normal" | "pouty" | "huffy" | "angry";

const DRIFT_INTERVAL = 15_000;  // drift 3 points toward 50 every 15s
const DRIFT_AMOUNT = 3;
const CLICK_SPAM_WINDOW = 5_000; // 5 seconds
const CLICK_SPAM_THRESHOLD = 3;
const PICKUP_RESET_TIME = 30_000; // reset escalation after 30s

export function createMoodState(savedValue?: number): MoodState {
  // On launch, if mood was below 25, reset to 30
  let value = savedValue ?? 50;
  if (value < 25) value = 30;
  return {
    value,
    driftTimer: 0,
    clickTimes: [],
    pickupCount: 0,
    pickupResetTimer: 0,
    wallBumpSameWall: 0,
    lastWallSide: null,
    justForgave: false,
  };
}

export function getMoodTier(value: number): MoodTier {
  if (value < 8) return "angry";
  if (value < 18) return "huffy";
  if (value < 28) return "pouty";
  return "normal";
}

function clampMood(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export type MoodEvent =
  | { type: "TICK"; deltaMs: number }
  | { type: "CLICK" }
  | { type: "PET" }
  | { type: "PICKUP" }
  | { type: "DROPPED_FROM_HEIGHT"; distance: number }
  | { type: "FLUNG_INTO_WALL" }
  | { type: "WALL_BUMP_WALK"; side: "left" | "right" }
  | { type: "WALL_BUMP_RUN"; side: "left" | "right" };

export function updateMood(state: MoodState, event: MoodEvent): MoodState {
  const prevTier = getMoodTier(state.value);

  switch (event.type) {
    case "TICK": {
      let s = { ...state };
      s.driftTimer += event.deltaMs;
      s.pickupResetTimer += event.deltaMs;

      // Reset pickup escalation after timeout
      if (s.pickupResetTimer >= PICKUP_RESET_TIME) {
        s.pickupCount = 0;
      }

      // Drift toward 50
      if (s.driftTimer >= DRIFT_INTERVAL) {
        s.driftTimer -= DRIFT_INTERVAL;
        if (s.value < 50) {
          s.value = clampMood(s.value + DRIFT_AMOUNT);
        } else if (s.value > 50) {
          s.value = clampMood(s.value - DRIFT_AMOUNT);
        }
      }

      // Check forgiveness: mood crossed above a threshold
      const newTier = getMoodTier(s.value);
      s.justForgave = newTier !== prevTier && tierRank(newTier) > tierRank(prevTier);

      return s;
    }

    case "CLICK": {
      const now = Date.now();
      const recentClicks = [...state.clickTimes, now].filter(
        (t) => now - t < CLICK_SPAM_WINDOW
      );
      let delta = 5; // normal click boost
      if (recentClicks.length >= CLICK_SPAM_THRESHOLD) {
        delta = -10; // spam penalty
      }
      const newValue = clampMood(state.value + delta);
      return {
        ...state,
        value: newValue,
        clickTimes: recentClicks,
        justForgave: checkForgave(prevTier, newValue),
      };
    }

    case "PET": {
      // Move up roughly one mood tier per pet (+12 ensures crossing a 10-wide tier)
      const newValue = clampMood(state.value + 12);
      return {
        ...state,
        value: newValue,
        justForgave: checkForgave(prevTier, newValue),
      };
    }

    case "PICKUP": {
      const penalties = [-3, -8, -15];
      const penalty = penalties[Math.min(state.pickupCount, penalties.length - 1)];
      const newValue = clampMood(state.value + penalty);
      return {
        ...state,
        value: newValue,
        pickupCount: state.pickupCount + 1,
        pickupResetTimer: 0,
        justForgave: false,
      };
    }

    case "DROPPED_FROM_HEIGHT": {
      let penalty: number;
      if (event.distance < 100) penalty = -3;
      else if (event.distance < 300) penalty = -8;
      else penalty = -15;
      const newValue = clampMood(state.value + penalty);
      return {
        ...state,
        value: newValue,
        justForgave: checkForgave(prevTier, newValue),
      };
    }

    case "FLUNG_INTO_WALL": {
      const newValue = clampMood(state.value - 10);
      return {
        ...state,
        value: newValue,
        justForgave: false,
      };
    }

    case "WALL_BUMP_WALK": {
      const sameWall = state.lastWallSide === event.side ? state.wallBumpSameWall + 1 : 1;
      const newValue = clampMood(state.value - 5);
      return {
        ...state,
        value: newValue,
        wallBumpSameWall: sameWall,
        lastWallSide: event.side,
        justForgave: checkForgave(prevTier, newValue),
      };
    }

    case "WALL_BUMP_RUN": {
      const sameWall = state.lastWallSide === event.side ? state.wallBumpSameWall + 1 : 1;
      const newValue = clampMood(state.value - 8);
      return {
        ...state,
        value: newValue,
        wallBumpSameWall: sameWall,
        lastWallSide: event.side,
        justForgave: checkForgave(prevTier, newValue),
      };
    }
  }
}

function tierRank(tier: MoodTier): number {
  switch (tier) {
    case "angry": return 0;
    case "huffy": return 1;
    case "pouty": return 2;
    case "normal": return 3;
  }
}

function checkForgave(prevTier: MoodTier, newValue: number): boolean {
  const newTier = getMoodTier(newValue);
  return tierRank(newTier) > tierRank(prevTier);
}

// Should Earl dodge a pickup attempt? (angry mood)
export function shouldDodgePickup(mood: MoodState): boolean {
  return getMoodTier(mood.value) === "angry";
}

// Should Earl avoid the wall (learned after bumping same wall twice)?
export function shouldAvoidWall(mood: MoodState): boolean {
  return mood.wallBumpSameWall >= 2 && Math.random() < 0.3;
}

// Get idle animation based on mood
export function getMoodIdleAnimation(mood: MoodState, isBirthday: boolean): string {
  if (isBirthday) return "birthday";
  const tier = getMoodTier(mood.value);
  switch (tier) {
    case "angry": return "puffed_up";
    case "huffy": return "huffy";
    case "pouty": return "pouty";
    case "normal": return "idle_front";
  }
}

// Get speech bubble for mood state
export function getMoodSpeech(mood: MoodState): string | null {
  if (mood.justForgave) return "...fine.";
  const tier = getMoodTier(mood.value);
  if (tier === "pouty") {
    const phrases = ["Hmph.", "...", "Really?", "*sigh*"];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }
  if (tier === "angry") {
    const phrases = ["!!!", ">:(", "STOP.", "*fuming*"];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }
  return null;
}

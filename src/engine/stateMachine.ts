import {
  IDLE_BEFORE_WALK_MIN,
  IDLE_BEFORE_WALK_MAX,
  WALK_DURATION_MIN,
  WALK_DURATION_MAX,
  IDLE_BEFORE_SLEEP_MIN,
  IDLE_BEFORE_SLEEP_MAX,
  RUN_CHANCE,
  RUN_CHANCE_HAPPY,
  STRETCH_CHANCE_AFTER_IDLE,
  STRETCH_IDLE_THRESHOLD,
} from "../utils/constants";
import { getMoodTier, MoodState } from "./mood";

export type EarlState =
  | "IDLE"
  | "WALK_RIGHT"
  | "WALK_LEFT"
  | "RUN_RIGHT"
  | "RUN_LEFT"
  | "HOP"
  | "SLEEP"
  | "PICKED_UP"
  | "FALLING"
  | "DROPPED"
  | "SLIDING"
  | "TUMBLING"
  | "WALL_BUMP"
  | "WALL_BUMP_RUN"
  | "BIRTHDAY_IDLE"
  | "SITTING_TO_STANDING"
  | "STANDING_TO_SITTING"
  | "STRETCH"
  | "TANTRUM";

export interface StateMachineState {
  current: EarlState;
  timer: number;
  walkTimer: number;
  sleepTimer: number;
  isBirthday: boolean;
  birthdayName: string | null;
  pendingDirection: "left" | "right" | null;
  pendingRun: boolean;
  idleDuration: number;
  slideVelocityX: number;
  wasRunning: boolean;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function createStateMachine(
  isBirthday: boolean,
  birthdayName: string | null
): StateMachineState {
  return {
    current: isBirthday ? "BIRTHDAY_IDLE" : "IDLE",
    timer: 0,
    walkTimer: randomBetween(IDLE_BEFORE_WALK_MIN, IDLE_BEFORE_WALK_MAX),
    sleepTimer: randomBetween(IDLE_BEFORE_SLEEP_MIN, IDLE_BEFORE_SLEEP_MAX),
    isBirthday,
    birthdayName,
    pendingDirection: null,
    pendingRun: false,
    idleDuration: 0,
    slideVelocityX: 0,
    wasRunning: false,
  };
}

export function getAnimationForState(state: EarlState, isBirthday: boolean, mood?: MoodState): string {
  switch (state) {
    case "IDLE": {
      if (isBirthday) return "birthday";
      if (mood) {
        const tier = getMoodTier(mood.value);
        if (tier === "angry") return "puffed_up";
        if (tier === "huffy") return "huffy";
        if (tier === "pouty") return "pouty";
      }
      return "idle_front";
    }
    case "BIRTHDAY_IDLE":
      return "birthday";
    case "WALK_RIGHT":
      return "walk_right";
    case "WALK_LEFT":
      return "walk_left";
    case "RUN_RIGHT":
      return "run_right";
    case "RUN_LEFT":
      return "run_left";
    case "HOP":
      return "hop";
    case "SLEEP":
      return "sleep";
    case "PICKED_UP":
      return "picked_up";
    case "FALLING":
      return "picked_up";
    case "DROPPED":
      return "dropped";
    case "SLIDING":
      return "tumble";
    case "TUMBLING":
      return "tumble";
    case "WALL_BUMP":
      return "wall_bump";
    case "WALL_BUMP_RUN":
      return "wall_bump_run";
    case "SITTING_TO_STANDING":
      return "sitting_to_standing";
    case "STANDING_TO_SITTING":
      return "standing_to_sitting";
    case "STRETCH":
      return "stretch";
    case "TANTRUM":
      return "tantrum_stomp";
  }
}

export type StateEvent =
  | { type: "TICK"; deltaMs: number; mood?: MoodState }
  | { type: "CLICK"; mood?: MoodState }
  | { type: "DRAG_START" }
  | { type: "DRAG_END"; velocityX?: number; velocityY?: number; speed?: number }
  | { type: "HOVER" }
  | { type: "ANIMATION_FINISHED" }
  | { type: "LANDED"; fallDistance?: number }
  | { type: "WALL_HIT" }
  | { type: "SLIDE_STOPPED" }
  | { type: "TUMBLE_WALL_HIT" };

function toIdle(sm: StateMachineState): StateMachineState {
  return {
    ...sm,
    current: sm.isBirthday ? "BIRTHDAY_IDLE" : "IDLE",
    timer: 0,
    walkTimer: randomBetween(IDLE_BEFORE_WALK_MIN, IDLE_BEFORE_WALK_MAX),
    sleepTimer: randomBetween(IDLE_BEFORE_SLEEP_MIN, IDLE_BEFORE_SLEEP_MAX),
    pendingDirection: null,
    pendingRun: false,
    idleDuration: 0,
  };
}

function shouldRun(mood?: MoodState): boolean {
  if (mood) {
    const tier = getMoodTier(mood.value);
    if (tier === "huffy" || tier === "angry" || tier === "pouty") return false;
    if (mood.value >= 75) return Math.random() < RUN_CHANCE_HAPPY;
  }
  return Math.random() < RUN_CHANCE;
}

export function updateStateMachine(
  sm: StateMachineState,
  event: StateEvent
): StateMachineState {
  switch (event.type) {
    case "DRAG_START":
      if (sm.current !== "PICKED_UP") {
        return { ...sm, current: "PICKED_UP", timer: 0 };
      }
      return sm;

    case "DRAG_END": {
      if (sm.current !== "PICKED_UP") return sm;
      const speed = event.speed ?? 0;
      const vx = event.velocityX ?? 0;

      if (speed >= 1200) {
        return { ...sm, current: "TUMBLING", timer: 0, slideVelocityX: vx };
      }
      if (speed >= 600) {
        return { ...sm, current: "TUMBLING", timer: 0, slideVelocityX: vx * 0.8 };
      }
      if (speed >= 200) {
        return { ...sm, current: "SLIDING", timer: 0, slideVelocityX: vx * 0.5 };
      }
      return { ...sm, current: "FALLING", timer: 0 };
    }

    case "LANDED": {
      if (sm.current === "FALLING" || sm.current === "SLIDING" || sm.current === "TUMBLING") {
        return { ...sm, current: "DROPPED", timer: 0 };
      }
      return sm;
    }

    case "SLIDE_STOPPED": {
      if (sm.current === "SLIDING") {
        return { ...sm, current: "FALLING", timer: 0 };
      }
      return sm;
    }

    case "TUMBLE_WALL_HIT": {
      if (sm.current === "TUMBLING") {
        return { ...sm, slideVelocityX: -sm.slideVelocityX * 0.6 };
      }
      return sm;
    }

    case "WALL_HIT": {
      if (sm.current === "RUN_RIGHT" || sm.current === "RUN_LEFT") {
        return { ...sm, current: "WALL_BUMP_RUN", timer: 0, wasRunning: true };
      }
      if (sm.current === "WALK_RIGHT" || sm.current === "WALK_LEFT") {
        return { ...sm, current: "WALL_BUMP", timer: 0, wasRunning: false };
      }
      return sm;
    }

    case "CLICK": {
      const mood = event.mood;
      if (sm.current === "SLEEP") {
        return toIdle(sm);
      }
      if (sm.current === "IDLE" || sm.current === "BIRTHDAY_IDLE") {
        if (mood && getMoodTier(mood.value) === "angry") {
          return { ...sm, current: "TANTRUM", timer: 0 };
        }
        return { ...sm, current: "HOP", timer: 0 };
      }
      return sm;
    }

    case "HOVER":
      if (sm.current === "SLEEP") {
        return toIdle(sm);
      }
      return sm;

    case "ANIMATION_FINISHED": {
      if (
        sm.current === "HOP" ||
        sm.current === "DROPPED" ||
        sm.current === "TANTRUM"
      ) {
        return toIdle(sm);
      }
      if (sm.current === "WALL_BUMP" || sm.current === "WALL_BUMP_RUN") {
        return toIdle(sm);
      }
      if (sm.current === "SITTING_TO_STANDING") {
        if (sm.pendingDirection) {
          const isRun = sm.pendingRun;
          const dir = sm.pendingDirection;
          if (isRun) {
            return {
              ...sm,
              current: dir === "right" ? "RUN_RIGHT" : "RUN_LEFT",
              timer: 0,
              walkTimer: randomBetween(WALK_DURATION_MIN, WALK_DURATION_MAX),
              pendingDirection: null,
              pendingRun: false,
            };
          }
          return {
            ...sm,
            current: dir === "right" ? "WALK_RIGHT" : "WALK_LEFT",
            timer: 0,
            walkTimer: randomBetween(WALK_DURATION_MIN, WALK_DURATION_MAX),
            pendingDirection: null,
            pendingRun: false,
          };
        }
        return toIdle(sm);
      }
      if (sm.current === "STANDING_TO_SITTING" || sm.current === "STRETCH") {
        return toIdle(sm);
      }
      if (sm.current === "TUMBLING") {
        if (Math.abs(sm.slideVelocityX) < 30) {
          return { ...sm, current: "DROPPED", timer: 0 };
        }
        return sm;
      }
      return sm;
    }

    case "TICK": {
      const mood = event.mood;
      if (
        sm.current !== "IDLE" &&
        sm.current !== "BIRTHDAY_IDLE" &&
        sm.current !== "WALK_RIGHT" &&
        sm.current !== "WALK_LEFT" &&
        sm.current !== "RUN_RIGHT" &&
        sm.current !== "RUN_LEFT"
      ) {
        if (sm.current === "TUMBLING") {
          const friction = Math.pow(0.95, event.deltaMs / 16.67);
          const newVx = sm.slideVelocityX * friction;
          if (Math.abs(newVx) < 20) {
            return { ...sm, current: "DROPPED", timer: 0 };
          }
          return { ...sm, timer: sm.timer + event.deltaMs, slideVelocityX: newVx };
        }
        if (sm.current === "SLIDING") {
          const friction = Math.pow(0.92, event.deltaMs / 16.67);
          const newVx = sm.slideVelocityX * friction;
          if (Math.abs(newVx) < 15) {
            return { ...sm, current: "FALLING", timer: 0, slideVelocityX: 0 };
          }
          return { ...sm, timer: sm.timer + event.deltaMs, slideVelocityX: newVx };
        }
        return { ...sm, timer: sm.timer + event.deltaMs };
      }

      const newTimer = sm.timer + event.deltaMs;

      // Walking/running — check duration
      if (
        sm.current === "WALK_RIGHT" ||
        sm.current === "WALK_LEFT" ||
        sm.current === "RUN_RIGHT" ||
        sm.current === "RUN_LEFT"
      ) {
        if (newTimer >= sm.walkTimer) {
          return {
            ...sm,
            current: "STANDING_TO_SITTING",
            timer: 0,
            walkTimer: randomBetween(IDLE_BEFORE_WALK_MIN, IDLE_BEFORE_WALK_MAX),
            sleepTimer: randomBetween(IDLE_BEFORE_SLEEP_MIN, IDLE_BEFORE_SLEEP_MAX),
          };
        }
        return { ...sm, timer: newTimer };
      }

      // Idle — check walk/sleep timers and idle duration
      const newWalkTimer = sm.walkTimer - event.deltaMs;
      const newSleepTimer = sm.sleepTimer - event.deltaMs;
      const newIdleDuration = sm.idleDuration + event.deltaMs;

      // Stretch check (per-frame chance after threshold)
      if (
        newIdleDuration >= STRETCH_IDLE_THRESHOLD &&
        sm.idleDuration < STRETCH_IDLE_THRESHOLD &&
        Math.random() < STRETCH_CHANCE_AFTER_IDLE
      ) {
        return {
          ...sm,
          current: "STRETCH",
          timer: 0,
          idleDuration: 0,
        };
      }

      if (newWalkTimer <= 0) {
        const direction: "left" | "right" = Math.random() > 0.5 ? "right" : "left";
        const isRun = shouldRun(mood);

        return {
          ...sm,
          current: "SITTING_TO_STANDING",
          timer: 0,
          walkTimer: randomBetween(WALK_DURATION_MIN, WALK_DURATION_MAX),
          sleepTimer: newSleepTimer,
          pendingDirection: direction,
          pendingRun: isRun,
          idleDuration: 0,
        };
      }

      if (newSleepTimer <= 0) {
        return {
          ...sm,
          current: "SLEEP",
          timer: 0,
          walkTimer: newWalkTimer,
          sleepTimer: randomBetween(IDLE_BEFORE_SLEEP_MIN, IDLE_BEFORE_SLEEP_MAX),
          idleDuration: 0,
        };
      }

      return {
        ...sm,
        timer: newTimer,
        walkTimer: newWalkTimer,
        sleepTimer: newSleepTimer,
        idleDuration: newIdleDuration,
      };
    }
  }
}

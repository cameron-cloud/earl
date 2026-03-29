import {
  IDLE_BEFORE_WALK_MIN,
  IDLE_BEFORE_WALK_MAX,
  WALK_DURATION_MIN,
  WALK_DURATION_MAX,
  IDLE_BEFORE_SLEEP_MIN,
  IDLE_BEFORE_SLEEP_MAX,
} from "../utils/constants";

export type EarlState =
  | "IDLE"
  | "WALK_RIGHT"
  | "WALK_LEFT"
  | "HOP"
  | "SLEEP"
  | "PICKED_UP"
  | "DROPPED"
  | "BIRTHDAY_IDLE";

export interface StateMachineState {
  current: EarlState;
  timer: number;
  walkTimer: number;
  sleepTimer: number;
  isBirthday: boolean;
  birthdayName: string | null;
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
  };
}

export function getAnimationForState(state: EarlState, isBirthday: boolean): string {
  switch (state) {
    case "IDLE":
      return isBirthday ? "birthday" : "idle_front";
    case "BIRTHDAY_IDLE":
      return "birthday";
    case "WALK_RIGHT":
      return "walk_right";
    case "WALK_LEFT":
      return "walk_left";
    case "HOP":
      return "hop";
    case "SLEEP":
      return "sleep";
    case "PICKED_UP":
      return "picked_up";
    case "DROPPED":
      return "dropped";
  }
}

export type StateEvent =
  | { type: "TICK"; deltaMs: number }
  | { type: "CLICK" }
  | { type: "DRAG_START" }
  | { type: "DRAG_END" }
  | { type: "HOVER" }
  | { type: "ANIMATION_FINISHED" };

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

    case "DRAG_END":
      if (sm.current === "PICKED_UP") {
        return { ...sm, current: "DROPPED", timer: 0 };
      }
      return sm;

    case "CLICK":
      if (sm.current === "SLEEP") {
        return {
          ...sm,
          current: sm.isBirthday ? "BIRTHDAY_IDLE" : "IDLE",
          timer: 0,
          walkTimer: randomBetween(IDLE_BEFORE_WALK_MIN, IDLE_BEFORE_WALK_MAX),
          sleepTimer: randomBetween(IDLE_BEFORE_SLEEP_MIN, IDLE_BEFORE_SLEEP_MAX),
        };
      }
      if (sm.current === "IDLE" || sm.current === "BIRTHDAY_IDLE") {
        return { ...sm, current: "HOP", timer: 0 };
      }
      return sm;

    case "HOVER":
      if (sm.current === "SLEEP") {
        return {
          ...sm,
          current: sm.isBirthday ? "BIRTHDAY_IDLE" : "IDLE",
          timer: 0,
          walkTimer: randomBetween(IDLE_BEFORE_WALK_MIN, IDLE_BEFORE_WALK_MAX),
          sleepTimer: randomBetween(IDLE_BEFORE_SLEEP_MIN, IDLE_BEFORE_SLEEP_MAX),
        };
      }
      return sm;

    case "ANIMATION_FINISHED":
      if (sm.current === "HOP" || sm.current === "DROPPED") {
        return {
          ...sm,
          current: sm.isBirthday ? "BIRTHDAY_IDLE" : "IDLE",
          timer: 0,
          walkTimer: randomBetween(IDLE_BEFORE_WALK_MIN, IDLE_BEFORE_WALK_MAX),
          sleepTimer: randomBetween(IDLE_BEFORE_SLEEP_MIN, IDLE_BEFORE_SLEEP_MAX),
        };
      }
      return sm;

    case "TICK": {
      if (
        sm.current !== "IDLE" &&
        sm.current !== "BIRTHDAY_IDLE" &&
        sm.current !== "WALK_RIGHT" &&
        sm.current !== "WALK_LEFT"
      ) {
        return { ...sm, timer: sm.timer + event.deltaMs };
      }

      const newTimer = sm.timer + event.deltaMs;

      // Walking state — check if walk duration elapsed
      if (sm.current === "WALK_RIGHT" || sm.current === "WALK_LEFT") {
        if (newTimer >= sm.walkTimer) {
          return {
            ...sm,
            current: sm.isBirthday ? "BIRTHDAY_IDLE" : "IDLE",
            timer: 0,
            walkTimer: randomBetween(IDLE_BEFORE_WALK_MIN, IDLE_BEFORE_WALK_MAX),
            sleepTimer: randomBetween(IDLE_BEFORE_SLEEP_MIN, IDLE_BEFORE_SLEEP_MAX),
          };
        }
        return { ...sm, timer: newTimer };
      }

      // Idle state — check walk and sleep timers
      const newWalkTimer = sm.walkTimer - event.deltaMs;
      const newSleepTimer = sm.sleepTimer - event.deltaMs;

      if (newWalkTimer <= 0) {
        const direction = Math.random() > 0.5 ? "WALK_RIGHT" : "WALK_LEFT";
        return {
          ...sm,
          current: direction,
          timer: 0,
          walkTimer: randomBetween(WALK_DURATION_MIN, WALK_DURATION_MAX),
          sleepTimer: newSleepTimer,
        };
      }

      if (newSleepTimer <= 0) {
        return {
          ...sm,
          current: "SLEEP",
          timer: 0,
          walkTimer: newWalkTimer,
          sleepTimer: randomBetween(IDLE_BEFORE_SLEEP_MIN, IDLE_BEFORE_SLEEP_MAX),
        };
      }

      return {
        ...sm,
        timer: newTimer,
        walkTimer: newWalkTimer,
        sleepTimer: newSleepTimer,
      };
    }
  }
}

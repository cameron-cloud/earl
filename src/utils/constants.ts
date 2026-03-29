// Display
export const SPRITE_SOURCE_SIZE = 128;
export const DEFAULT_DISPLAY_SIZE = 64;
export const SIZE_OPTIONS = [48, 64, 80, 96] as const;

// Window
export const WINDOW_HEIGHT = 200;
export const TASKBAR_HEIGHT = 48;

// Behavior timing (milliseconds)
export const IDLE_BEFORE_WALK_MIN = 10_000;
export const IDLE_BEFORE_WALK_MAX = 30_000;
export const WALK_DURATION_MIN = 3_000;
export const WALK_DURATION_MAX = 8_000;
export const IDLE_BEFORE_SLEEP_MIN = 60_000;
export const IDLE_BEFORE_SLEEP_MAX = 120_000;

// Movement
export const WALK_SPEED = 40; // pixels per second

// Animation speed multipliers
export const SPEED_MULTIPLIERS: Record<string, number> = {
  chill: 1.5,
  normal: 1.0,
  hyper: 0.5,
};

// Hop physics (pixels, relative to ground)
export const HOP_OFFSETS = [0, 5, -20, -20, 5, 0];

// Speech bubble
export const SPEECH_BUBBLE_DURATION = 3_000;

// Confetti
export const CONFETTI_PARTICLE_LIFETIME = 3_000;
export const CONFETTI_SPAWN_CHANCE = 0.01;
export const CONFETTI_BURST_COUNT = 8;
export const CONFETTI_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#F1948A",
];

// Birthday dates
export const BIRTHDAYS: { month: number; day: number; name: string }[] = [
  { month: 4, day: 4, name: "Juliette" },
  { month: 6, day: 23, name: "Cam" },
];

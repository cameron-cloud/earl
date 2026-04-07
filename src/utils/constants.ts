// Display
export const SPRITE_SOURCE_SIZE = 128;
export const DEFAULT_DISPLAY_SIZE = 64;
export const SIZE_OPTIONS = [48, 64, 80, 96] as const;

// Window
export const WINDOW_HEIGHT = 200;
export const TASKBAR_HEIGHT = 40;

// Behavior timing (milliseconds)
export const IDLE_BEFORE_WALK_MIN = 10_000;
export const IDLE_BEFORE_WALK_MAX = 30_000;
export const WALK_DURATION_MIN = 3_000;
export const WALK_DURATION_MAX = 8_000;
export const IDLE_BEFORE_SLEEP_MIN = 60_000;
export const IDLE_BEFORE_SLEEP_MAX = 120_000;

// Movement
export const WALK_SPEED = 40; // pixels per second
export const RUN_SPEED = 135; // pixels per second (120-150 range)

// Running chance
export const RUN_CHANCE = 0.2; // 20% chance to run instead of walk
export const RUN_CHANCE_HAPPY = 0.4; // 40% when mood >= 75

// Transitions
export const STRETCH_IDLE_THRESHOLD = 60_000; // 60s idle before stretch chance
export const STRETCH_CHANCE_AFTER_IDLE = 0.05; // 5% when threshold crossed

// Animation speed multipliers
export const SPEED_MULTIPLIERS: Record<string, number> = {
  chill: 1.5,
  normal: 1.0,
  hyper: 0.5,
};

// Hop physics (pixels, relative to ground)
export const HOP_OFFSETS = [0, 5, -20, -20, 5, 0];

// Gravity / falling physics
export const GRAVITY = 1200; // px/s²
export const TERMINAL_VELOCITY = 600; // max fall speed px/s

// Drag inertia
export const DRAG_SWING_DAMPING = 0.85; // how quickly swing decays
export const DRAG_SWING_SCALE = 0.15; // how much velocity affects swing angle

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

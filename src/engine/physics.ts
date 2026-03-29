import { WALK_SPEED, HOP_OFFSETS } from "../utils/constants";

export interface Position {
  x: number;
  y: number;
  groundY: number;
}

export function updatePosition(
  pos: Position,
  state: string,
  deltaMs: number,
  hopFrameIndex: number,
  screenWidth: number,
  displaySize: number
): Position {
  const deltaSec = deltaMs / 1000;

  switch (state) {
    case "WALK_RIGHT": {
      const newX = Math.min(pos.x + WALK_SPEED * deltaSec, screenWidth - displaySize);
      return { ...pos, x: newX, y: pos.groundY };
    }
    case "WALK_LEFT": {
      const newX = Math.max(pos.x - WALK_SPEED * deltaSec, 0);
      return { ...pos, x: newX, y: pos.groundY };
    }
    case "HOP": {
      const offset = HOP_OFFSETS[hopFrameIndex] ?? 0;
      return { ...pos, y: pos.groundY - offset };
    }
    case "DROPPED": {
      return { ...pos, y: pos.groundY };
    }
    default:
      return { ...pos, y: pos.groundY };
  }
}

export function clampToScreen(
  pos: Position,
  screenWidth: number,
  displaySize: number
): Position {
  return {
    ...pos,
    x: Math.max(0, Math.min(pos.x, screenWidth - displaySize)),
  };
}

import {
  WALK_SPEED,
  RUN_SPEED,
  HOP_OFFSETS,
  GRAVITY,
  TERMINAL_VELOCITY,
  TASKBAR_HEIGHT,
} from "../utils/constants";

export interface Position {
  x: number;
  y: number;
  groundY: number;
  velocityY: number;
  velocityX: number;
  bounceCount: number;
  fallStartY: number;
}

export interface PhysicsResult {
  position: Position;
  landed: boolean;
  wallHit: boolean;
  tumbleWallHit: boolean;
  fallDistance: number;
}

const NO_EVENTS: Pick<PhysicsResult, "landed" | "wallHit" | "tumbleWallHit" | "fallDistance"> = {
  landed: false, wallHit: false, tumbleWallHit: false, fallDistance: 0,
};

export function createPosition(x: number, groundY: number): Position {
  return { x, y: groundY, groundY, velocityY: 0, velocityX: 0, bounceCount: 0, fallStartY: groundY };
}

export function updatePosition(
  pos: Position,
  state: string,
  deltaMs: number,
  hopFrameIndex: number,
  screenWidth: number,
  screenHeight: number,
  displaySize: number,
  slideVelocityX?: number,
  taskbarPadding?: number
): PhysicsResult {
  const deltaSec = deltaMs / 1000;
  const tbPad = taskbarPadding ?? TASKBAR_HEIGHT;
  const groundLevel = screenHeight - tbPad - displaySize;

  switch (state) {
    case "WALK_RIGHT": {
      const newX = pos.x + WALK_SPEED * deltaSec;
      if (newX >= screenWidth - displaySize) {
        return { position: { ...pos, x: screenWidth - displaySize, y: pos.groundY }, ...NO_EVENTS, wallHit: true };
      }
      return { position: { ...pos, x: newX, y: pos.groundY }, ...NO_EVENTS };
    }
    case "WALK_LEFT": {
      const newX = pos.x - WALK_SPEED * deltaSec;
      if (newX <= 0) {
        return { position: { ...pos, x: 0, y: pos.groundY }, ...NO_EVENTS, wallHit: true };
      }
      return { position: { ...pos, x: newX, y: pos.groundY }, ...NO_EVENTS };
    }
    case "RUN_RIGHT": {
      const newX = pos.x + RUN_SPEED * deltaSec;
      if (newX >= screenWidth - displaySize) {
        return { position: { ...pos, x: screenWidth - displaySize, y: pos.groundY }, ...NO_EVENTS, wallHit: true };
      }
      return { position: { ...pos, x: newX, y: pos.groundY }, ...NO_EVENTS };
    }
    case "RUN_LEFT": {
      const newX = pos.x - RUN_SPEED * deltaSec;
      if (newX <= 0) {
        return { position: { ...pos, x: 0, y: pos.groundY }, ...NO_EVENTS, wallHit: true };
      }
      return { position: { ...pos, x: newX, y: pos.groundY }, ...NO_EVENTS };
    }
    case "HOP": {
      const offset = HOP_OFFSETS[hopFrameIndex] ?? 0;
      return { position: { ...pos, y: pos.groundY - offset }, ...NO_EVENTS };
    }
    case "PICKED_UP":
      return { position: pos, ...NO_EVENTS };
    case "SLIDING": {
      const vx = slideVelocityX ?? pos.velocityX;
      let newX = pos.x + vx * deltaSec;
      let newVY = pos.velocityY + GRAVITY * deltaSec;
      if (newVY > TERMINAL_VELOCITY) newVY = TERMINAL_VELOCITY;
      let newY = pos.y + newVY * deltaSec;
      let hitWall = false;

      if (newX <= 0) { newX = 0; hitWall = true; }
      if (newX >= screenWidth - displaySize) { newX = screenWidth - displaySize; hitWall = true; }

      if (newY >= groundLevel) {
        const fallDist = Math.abs(groundLevel - pos.fallStartY);
        return {
          position: { ...pos, x: newX, y: groundLevel, groundY: groundLevel, velocityY: 0, velocityX: 0, fallStartY: groundLevel, bounceCount: 0 },
          landed: true, wallHit: false, tumbleWallHit: hitWall, fallDistance: fallDist,
        };
      }

      return {
        position: { ...pos, x: newX, y: newY, velocityY: newVY, velocityX: vx },
        ...NO_EVENTS, tumbleWallHit: hitWall,
      };
    }
    case "TUMBLING": {
      const vx = slideVelocityX ?? pos.velocityX;
      let newX = pos.x + vx * deltaSec;
      let hitWall = false;

      let newVY = pos.velocityY + GRAVITY * deltaSec;
      if (newVY > TERMINAL_VELOCITY) newVY = TERMINAL_VELOCITY;
      let newY = pos.y + newVY * deltaSec;

      if (newX <= 0) { newX = 0; hitWall = true; }
      if (newX >= screenWidth - displaySize) { newX = screenWidth - displaySize; hitWall = true; }

      if (newY >= groundLevel) {
        const fallDist = Math.abs(groundLevel - pos.fallStartY);
        return {
          position: { ...pos, x: newX, y: groundLevel, groundY: groundLevel, velocityY: 0, velocityX: vx, fallStartY: groundLevel, bounceCount: 0 },
          landed: true, wallHit: false, tumbleWallHit: hitWall, fallDistance: fallDist,
        };
      }

      return {
        position: { ...pos, x: newX, y: newY, velocityY: newVY, velocityX: vx },
        ...NO_EVENTS, tumbleWallHit: hitWall,
      };
    }
    case "FALLING": {
      let newVY = pos.velocityY + GRAVITY * deltaSec;
      if (newVY > TERMINAL_VELOCITY) newVY = TERMINAL_VELOCITY;
      let newY = pos.y + newVY * deltaSec;

      if (newY >= groundLevel) {
        const fallDist = Math.abs(groundLevel - pos.fallStartY);

        return {
          position: { ...pos, y: groundLevel, groundY: groundLevel, velocityY: 0, bounceCount: 0, fallStartY: groundLevel },
          landed: true, wallHit: false, tumbleWallHit: false, fallDistance: fallDist,
        };
      }

      return {
        position: { ...pos, y: newY, velocityY: newVY },
        ...NO_EVENTS,
      };
    }
    default: {
      const sittingStates = ["IDLE", "BIRTHDAY_IDLE", "SLEEP", "STANDING_TO_SITTING", "STRETCH"];
      const sittingOffset = sittingStates.includes(state) ? displaySize * 0.06 : 0;
      return { position: { ...pos, y: pos.groundY + sittingOffset }, ...NO_EVENTS };
    }
  }
}

export function clampToScreen(
  pos: Position,
  screenWidth: number,
  screenHeight: number,
  displaySize: number,
  taskbarPadding?: number
): Position {
  const tbPad = taskbarPadding ?? TASKBAR_HEIGHT;
  const groundLevel = screenHeight - tbPad - displaySize;
  return {
    ...pos,
    x: Math.max(0, Math.min(pos.x, screenWidth - displaySize)),
    groundY: Math.min(pos.groundY, groundLevel),
  };
}

export function getGroundLevel(screenHeight: number, displaySize: number, taskbarPadding?: number): number {
  const tbPad = taskbarPadding ?? TASKBAR_HEIGHT;
  return screenHeight - tbPad - displaySize;
}

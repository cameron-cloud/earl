import { useState, useRef, useCallback, useEffect } from "react";
import {
  AnimatorState,
  createAnimatorState,
  updateAnimator,
  preloadSprites,
} from "../engine/animator";
import {
  StateMachineState,
  createStateMachine,
  updateStateMachine,
  getAnimationForState,
  EarlState,
} from "../engine/stateMachine";
import { Position, updatePosition, clampToScreen, createPosition } from "../engine/physics";
import {
  MoodState,
  createMoodState,
  updateMood,
  shouldDodgePickup,
} from "../engine/mood";
import {
  playHopSound,
  playPickUpSound,
  playDropSound,
  playBirthdaySound,
  playWallBumpSound,
  playTumbleSound,
  playTantrumSound,
} from "../engine/sound";
import {
  SPEED_MULTIPLIERS,
  DEFAULT_DISPLAY_SIZE,
  WINDOW_HEIGHT,
  TASKBAR_HEIGHT,
  DRAG_SWING_DAMPING,
} from "../utils/constants";
import { EarlConfig, getConfig, saveConfig, expandWindow, shrinkWindow, updateHitTest, getTaskbarState } from "../utils/config";

interface EarlBehavior {
  position: Position;
  animatorState: AnimatorState;
  stateMachine: StateMachineState;
  displaySize: number;
  config: EarlConfig | null;
  speechMessage: string | null;
  ready: boolean;
  sleepBreathOffset: number;
  confettiBurst: boolean;
  swingAngle: number;
  mood: MoodState;
  handleClick: () => void;
  handlePet: () => boolean;
  handleDragStart: () => Promise<void>;
  handleDragMove: (x: number, y: number) => void;
  handleDragEnd: (x: number, y: number, vx: number, vy: number) => void;
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
  dismissSpeech: () => void;
  clearConfettiBurst: () => void;
}

export function useEarlBehavior(
  isBirthday: boolean,
  birthdayName: string | null,
  screenWidth: number,
  screenHeight: number
): EarlBehavior {
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<EarlConfig | null>(null);

  const displaySize = config?.display.size ?? DEFAULT_DISPLAY_SIZE;
  const speedMult = SPEED_MULTIPLIERS[config?.display.animationSpeed ?? "normal"] ?? 1;
  const soundEnabled = config?.sound.enabled ?? false;
  const soundVolume = config?.sound.volume ?? 0.5;

  // Dynamic taskbar padding inside the 200px window.
  // When the OS taskbar is visible, we use TASKBAR_HEIGHT (40px) as internal padding.
  // When hidden, we use a small 4px gap from the window bottom.
  const taskbarPadRef = useRef(TASKBAR_HEIGHT);

  const normalGroundY = WINDOW_HEIGHT - taskbarPadRef.current - displaySize;

  // React state — only used for rendering
  const [position, setPosition] = useState<Position>(
    createPosition(screenWidth / 2 - DEFAULT_DISPLAY_SIZE / 2, normalGroundY)
  );
  const [animState, setAnimState] = useState<AnimatorState>(
    createAnimatorState(isBirthday ? "birthday" : "idle_front")
  );
  const [smState, setSmState] = useState<StateMachineState>(
    createStateMachine(isBirthday, birthdayName)
  );
  const [mood, setMood] = useState<MoodState>(createMoodState(50));
  const [speechMessage, setSpeechMessage] = useState<string | null>(null);
  const [sleepBreathOffset, setSleepBreathOffset] = useState(0);
  const [confettiBurst, setConfettiBurst] = useState(false);
  const [swingAngle, setSwingAngle] = useState(0);

  // Refs — authoritative game state, updated synchronously in the game loop
  const configRef = useRef(config);
  const smRef = useRef(smState);
  const posRef = useRef(position);
  const animRef = useRef(animState);
  const moodRef = useRef(mood);
  const prevStateRef = useRef<EarlState>(smState.current);
  const dragTarget = useRef({ x: 0, y: 0 });
  const dragVelocity = useRef({ x: 0, y: 0 });
  const windowExpanded = useRef(false);
  const swingRef = useRef(0);

  configRef.current = config;
  // posRef, animRef, moodRef synced from refs in game loop — don't overwrite from React state

  // Update ground level when display size changes
  useEffect(() => {
    const state = smRef.current.current;
    if (state !== "FALLING" && state !== "PICKED_UP" && state !== "SLIDING" && state !== "TUMBLING") {
      const newGround = WINDOW_HEIGHT - taskbarPadRef.current - displaySize;
      const newPos = { ...posRef.current, groundY: newGround, y: newGround };
      posRef.current = newPos;
      setPosition(newPos);
    }
  }, [displaySize]);

  // Init: load sprites + config
  useEffect(() => {
    Promise.all([preloadSprites(), getConfig().catch(() => null)]).then(
      ([, loadedConfig]) => {
        if (loadedConfig) {
          setConfig(loadedConfig);
          if (loadedConfig.position.x != null) {
            posRef.current = { ...posRef.current, x: loadedConfig.position.x! };
            setPosition(posRef.current);
          }
          const savedMood = loadedConfig.mood?.value;
          if (savedMood != null) {
            const m = createMoodState(savedMood);
            moodRef.current = m;
            setMood(m);
          }
        }
        setReady(true);
      }
    );
  }, []);

  // Listen for config changes from settings panel
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<EarlConfig>("config-changed", (event) => {
        setConfig(event.payload);
      }).then((fn) => { unlisten = fn; });
    });
    return () => { if (unlisten) unlisten(); };
  }, []);

  // Listen for reset-position from tray menu
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("reset-position", () => {
        const groundY = WINDOW_HEIGHT - taskbarPadRef.current - displaySize;
        const centerX = screenWidth / 2 - displaySize / 2;
        posRef.current = { ...posRef.current, x: centerX, y: groundY, groundY };
        setPosition(posRef.current);
        // Reset to idle
        const idleSm = createStateMachine(isBirthday, birthdayName);
        smRef.current = idleSm;
        setSmState(idleSm);
        const idleAnim = createAnimatorState(isBirthday ? "birthday" : "idle_front");
        animRef.current = idleAnim;
        setAnimState(idleAnim);
        prevStateRef.current = idleSm.current;
      }).then((fn) => { unlisten = fn; });
    });
    return () => { if (unlisten) unlisten(); };
  }, [displaySize, screenWidth, isBirthday, birthdayName]);

  // Helper: update animation if state changed
  function syncAnim(sm: StateMachineState, anim: AnimatorState): AnimatorState {
    if (sm.current !== prevStateRef.current) {
      const animName = getAnimationForState(sm.current, sm.isBirthday, moodRef.current);
      prevStateRef.current = sm.current;
      return createAnimatorState(animName);
    }
    return anim;
  }

  // ─── Main game loop ───
  // All game logic uses refs. React state is pushed once at the end of each frame.
  // No side effects inside setState updaters.
  useEffect(() => {
    if (!ready) return;

    let lastTime = 0;
    let rafId: number;

    const loop = (time: number) => {
      const delta = lastTime ? time - lastTime : 16;
      lastTime = time;

      let sm = smRef.current;
      let anim = animRef.current;
      let pos = posRef.current;
      let moodVal = moodRef.current;

      // ── 1. Mood tick ──
      moodVal = updateMood(moodVal, { type: "TICK", deltaMs: delta });

      // Forgiveness gesture: small hop when mood recovers
      if (moodVal.justForgave && sm.current === "IDLE") {
        sm = updateStateMachine(sm, { type: "CLICK", mood: moodVal });
        if (sm.current === "HOP") {
          anim = createAnimatorState("hop");
          prevStateRef.current = "HOP";
        }
      }

      // ── 2. State machine tick ──
      sm = updateStateMachine(sm, { type: "TICK", deltaMs: delta, mood: moodVal });

      // ── 3. Animation update ──
      if (sm.current !== prevStateRef.current) {
        // State changed — set new animation
        anim = createAnimatorState(getAnimationForState(sm.current, sm.isBirthday, moodVal));
        prevStateRef.current = sm.current;
      } else {
        // Same state — advance animation frames
        const updated = updateAnimator(anim, delta, speedMult);

        if (updated.finished && !anim.finished) {
          // Animation just finished — dispatch event
          const afterFinish = updateStateMachine(sm, { type: "ANIMATION_FINISHED" });
          if (afterFinish.current !== sm.current) {
            anim = createAnimatorState(getAnimationForState(afterFinish.current, afterFinish.isBirthday, moodVal));
            prevStateRef.current = afterFinish.current;
          } else {
            anim = updated;
          }
          sm = afterFinish;
        } else {
          anim = updated;
        }
      }

      // ── 4. Physics ──
      const tbPad = taskbarPadRef.current;
      const result = updatePosition(
        pos, sm.current, delta, anim.frameIndex,
        screenWidth, screenHeight, displaySize, sm.slideVelocityX, tbPad
      );
      pos = result.position;

      // ── 5. Handle physics events ──
      if (result.landed) {
        const prevSm = sm;
        sm = updateStateMachine(sm, { type: "LANDED", fallDistance: result.fallDistance });
        anim = syncAnim(sm, anim);

        if (result.fallDistance > 20) {
          moodVal = updateMood(moodVal, { type: "DROPPED_FROM_HEIGHT", distance: result.fallDistance });
        }
        if (soundEnabled && prevSm.current === "FALLING") {
          playDropSound(soundVolume);
        }
        // Shrink window back if expanded
        if (windowExpanded.current) {
          windowExpanded.current = false;
          shrinkWindow().then(() => {
            const groundY = WINDOW_HEIGHT - taskbarPadRef.current - displaySize;
            posRef.current = { ...posRef.current, y: groundY, groundY };
            setPosition(posRef.current);
          }).catch(() => {});
        }
      }

      // Shrink window for ground states
      if (windowExpanded.current) {
        const groundStates: EarlState[] = [
          "IDLE", "BIRTHDAY_IDLE", "DROPPED", "WALL_BUMP", "WALL_BUMP_RUN",
          "HOP", "STANDING_TO_SITTING", "SITTING_TO_STANDING", "STRETCH", "TANTRUM",
        ];
        if (groundStates.includes(sm.current)) {
          windowExpanded.current = false;
          shrinkWindow().then(() => {
            const groundY = WINDOW_HEIGHT - taskbarPadRef.current - displaySize;
            posRef.current = { ...posRef.current, y: groundY, groundY };
            setPosition(posRef.current);
          }).catch(() => {});
        }
      }

      if (result.wallHit) {
        const beforeWall = sm.current;
        sm = updateStateMachine(sm, { type: "WALL_HIT" });
        anim = syncAnim(sm, anim);
        if (soundEnabled) playWallBumpSound(soundVolume);
        const wasRunning = beforeWall === "RUN_RIGHT" || beforeWall === "RUN_LEFT";
        const side: "left" | "right" = (beforeWall === "WALK_LEFT" || beforeWall === "RUN_LEFT") ? "left" : "right";
        moodVal = updateMood(moodVal, wasRunning
          ? { type: "WALL_BUMP_RUN", side }
          : { type: "WALL_BUMP_WALK", side }
        );
      }

      if (result.tumbleWallHit) {
        sm = updateStateMachine(sm, { type: "TUMBLE_WALL_HIT" });
        moodVal = updateMood(moodVal, { type: "FLUNG_INTO_WALL" });
        if (soundEnabled) playWallBumpSound(soundVolume);
      }

      pos = clampToScreen(pos, screenWidth, screenHeight, displaySize, tbPad);

      // ── 6. Drag interpolation ──
      if (sm.current === "PICKED_UP") {
        const t = dragTarget.current;
        const lerp = 0.25;
        const dx = t.x - pos.x;
        const dy = t.y - pos.y;

        dragVelocity.current = { x: dx / (delta / 1000 || 1), y: dy / (delta / 1000 || 1) };

        // Swing angle
        const swingTarget = Math.max(-35, Math.min(35, dx * 0.8));
        swingRef.current = swingRef.current * 0.6 + swingTarget * 0.4;

        // Direction-based drag sprite
        const dSpeed = Math.sqrt(dx * dx + dy * dy) * 60;
        let dragAnim = "picked_up";
        if (dSpeed > 800) {
          dragAnim = "drag_fast";
        } else if (Math.abs(dx) > Math.abs(dy)) {
          dragAnim = dx < 0 ? "drag_left" : "drag_right";
        } else if (Math.abs(dy) > 2) {
          dragAnim = dy < 0 ? "drag_up" : "drag_down";
        }
        if (anim.animation !== dragAnim) {
          anim = createAnimatorState(dragAnim);
        }

        pos = { ...pos, x: pos.x + dx * lerp, y: pos.y + dy * lerp };
      }

      // ── 7. Sleep breathing ──
      const breath = sm.current === "SLEEP" ? Math.sin(time / 1000) * 1.5 : 0;

      // ── 8. Swing decay ──
      if (sm.current !== "PICKED_UP") {
        if (Math.abs(swingRef.current) < 0.5) swingRef.current = 0;
        else swingRef.current *= DRAG_SWING_DAMPING;
      }

      // ── 9. Commit to refs ──
      smRef.current = sm;
      animRef.current = anim;
      posRef.current = pos;
      moodRef.current = moodVal;

      // ── 10. Push to React state for rendering ──
      setSmState(sm);
      setAnimState(anim);
      setPosition(pos);
      setMood(moodVal);
      setSleepBreathOffset(breath);
      setSwingAngle(swingRef.current);

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [ready, screenWidth, screenHeight, displaySize, speedMult, soundEnabled, soundVolume]);

  // Poll taskbar visibility — adjust ground level and window position
  useEffect(() => {
    if (!ready) return;
    let lastVisible: boolean | null = null;

    const poll = async () => {
      // Don't reposition while dragging or window is expanded
      if (windowExpanded.current) return;

      try {
        const { visible } = await getTaskbarState();

        // First poll — just record state
        if (lastVisible === null) {
          lastVisible = visible;
          taskbarPadRef.current = visible ? TASKBAR_HEIGHT : 4;
          return;
        }

        if (visible === lastVisible) return;
        lastVisible = visible;

        const state = smRef.current.current;

        if (!visible) {
          // Taskbar just hid — move window flush to bottom, reduce padding
          taskbarPadRef.current = 4;
          shrinkWindow(false).catch(() => {});

          const newGround = WINDOW_HEIGHT - 4 - displaySize;
          posRef.current = { ...posRef.current, groundY: newGround };

          // If Earl is on the ground, let him fall to the new lower ground
          const groundStates: EarlState[] = [
            "IDLE", "BIRTHDAY_IDLE", "SLEEP", "STANDING_TO_SITTING",
            "SITTING_TO_STANDING", "STRETCH", "DROPPED", "WALK_RIGHT",
            "WALK_LEFT", "RUN_RIGHT", "RUN_LEFT",
          ];
          if (groundStates.includes(state)) {
            const fallSm: StateMachineState = { ...smRef.current, current: "FALLING", timer: 0 };
            smRef.current = fallSm;
            setSmState(fallSm);
            animRef.current = createAnimatorState("picked_up");
            setAnimState(animRef.current);
            prevStateRef.current = "FALLING";
          }
        } else {
          // Taskbar just appeared — move window up, raise padding, snap Earl
          taskbarPadRef.current = TASKBAR_HEIGHT;
          shrinkWindow(true).catch(() => {});

          const newGround = WINDOW_HEIGHT - TASKBAR_HEIGHT - displaySize;
          posRef.current = { ...posRef.current, y: newGround, groundY: newGround };
          setPosition(posRef.current);
        }
      } catch {
        // ignore polling errors
      }
    };

    const interval = setInterval(poll, 500);
    poll();
    return () => clearInterval(interval);
  }, [ready, displaySize]);

  // Cursor hit-test polling
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      const state = smRef.current.current;
      if (state === "PICKED_UP" || state === "FALLING" || state === "SLIDING" || state === "TUMBLING") return;
      const p = posRef.current;
      updateHitTest(p.x, p.y, displaySize).catch(() => {});
    }, 50);
    return () => clearInterval(interval);
  }, [ready, displaySize]);

  // Save config + mood periodically
  useEffect(() => {
    if (!config) return;
    const interval = setInterval(() => {
      const c = configRef.current;
      if (c) {
        c.position.x = posRef.current.x;
        c.mood = { value: moodRef.current.value };
        saveConfig(c).catch(() => {});
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [config]);

  const handleClick = useCallback(() => {
    const sm = smRef.current;
    const currentMood = moodRef.current;

    moodRef.current = updateMood(currentMood, { type: "CLICK" });
    setMood(moodRef.current);

    const newSm = updateStateMachine(sm, { type: "CLICK", mood: currentMood });
    smRef.current = newSm;
    setSmState(newSm);

    if (newSm.current === "HOP") {
      if (soundEnabled) {
        if (isBirthday) playBirthdaySound(soundVolume);
        else playHopSound(soundVolume);
      }
      if (isBirthday && birthdayName) {
        setSpeechMessage(`Happy Birthday ${birthdayName}!`);
        setConfettiBurst(true);
      }
      if (configRef.current) {
        configRef.current.stats.totalHops += 1;
      }
    }

    if (newSm.current === "TANTRUM") {
      if (soundEnabled) playTantrumSound(soundVolume);
    }

    if (newSm.current !== sm.current) {
      const animName = getAnimationForState(newSm.current, newSm.isBirthday, currentMood);
      const newAnim = createAnimatorState(animName);
      animRef.current = newAnim;
      setAnimState(newAnim);
      prevStateRef.current = newSm.current;
    }
  }, [soundEnabled, soundVolume, isBirthday, birthdayName]);

  const petCooldownRef = useRef(0);

  const handlePet = useCallback((): boolean => {
    // 2 second cooldown between pets
    const now = Date.now();
    if (now - petCooldownRef.current < 2000) return false;
    petCooldownRef.current = now;

    moodRef.current = updateMood(moodRef.current, { type: "PET" });
    setMood(moodRef.current);

    // Physical reaction: quick squish down and back up (like a happy nuzzle)
    // Use the hop animation for the physical bounce
    const sm = smRef.current;
    if (sm.current === "IDLE" || sm.current === "BIRTHDAY_IDLE" || sm.current === "SLEEP") {
      const hopSm = updateStateMachine(sm, { type: "CLICK", mood: moodRef.current });
      smRef.current = hopSm;
      setSmState(hopSm);
      if (hopSm.current === "HOP") {
        const hopAnim = createAnimatorState("hop");
        animRef.current = hopAnim;
        setAnimState(hopAnim);
        prevStateRef.current = "HOP";
      }
    } else {
      // If not in a state that can hop, just update the animation to match new mood
      const animName = getAnimationForState(sm.current, sm.isBirthday, moodRef.current);
      const newAnim = createAnimatorState(animName);
      animRef.current = newAnim;
      setAnimState(newAnim);
    }
    return true;
  }, []);

  const handleDragStart = useCallback(async (): Promise<void> => {
    const currentMood = moodRef.current;

    // Angry Earl dodges pickup — puff up briefly via TANTRUM state
    if (shouldDodgePickup(currentMood)) {
      const dodgeX = Math.random() > 0.5 ? 40 : -40;
      posRef.current = { ...posRef.current, x: posRef.current.x + dodgeX };
      setPosition(posRef.current);

      const newSm: StateMachineState = { ...smRef.current, current: "TANTRUM", timer: 0 };
      smRef.current = newSm;
      setSmState(newSm);
      const newAnim = createAnimatorState("tantrum_stomp");
      animRef.current = newAnim;
      setAnimState(newAnim);
      prevStateRef.current = "TANTRUM";

      if (soundEnabled) playTantrumSound(soundVolume);
      return;
    }

    // Mood penalty for pickup
    moodRef.current = updateMood(currentMood, { type: "PICKUP" });
    setMood(moodRef.current);

    const newSm = updateStateMachine(smRef.current, { type: "DRAG_START" });
    smRef.current = newSm;
    setSmState(newSm);
    const newAnim = createAnimatorState("picked_up");
    animRef.current = newAnim;
    setAnimState(newAnim);
    prevStateRef.current = "PICKED_UP";
    dragTarget.current = { x: posRef.current.x, y: posRef.current.y };
    if (soundEnabled) playPickUpSound(soundVolume);

    try {
      const yOffset = await expandWindow();
      windowExpanded.current = true;
      posRef.current = {
        ...posRef.current,
        y: posRef.current.y + yOffset,
        fallStartY: posRef.current.y + yOffset,
      };
      // Also shift drag target so Earl doesn't teleport toward the old position
      dragTarget.current = { x: dragTarget.current.x, y: dragTarget.current.y + yOffset };
      setPosition(posRef.current);
    } catch {
      // continue
    }
  }, [soundEnabled, soundVolume]);

  const handleDragMove = useCallback(
    (x: number, y: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const clampedX = Math.max(0, Math.min(x, w - displaySize));
      const clampedY = Math.max(0, Math.min(y, h - displaySize));
      dragTarget.current = { x: clampedX, y: clampedY };
    },
    [displaySize]
  );

  const handleDragEnd = useCallback(
    (_x: number, _y: number, vx: number, vy: number) => {
      // Only process if actually in PICKED_UP state (not after a dodge)
      if (smRef.current.current !== "PICKED_UP") return;

      const speed = Math.sqrt(vx * vx + vy * vy);
      const newSm = updateStateMachine(smRef.current, {
        type: "DRAG_END",
        velocityX: vx,
        velocityY: vy,
        speed,
      });
      smRef.current = newSm;
      setSmState(newSm);

      // Set initial velocities
      posRef.current = {
        ...posRef.current,
        velocityY: Math.max(vy, 0),
        velocityX: vx,
        fallStartY: posRef.current.y,
        bounceCount: 0,
      };
      setPosition(posRef.current);

      // Update animation for new post-drag state
      if (newSm.current !== "PICKED_UP") {
        const animName = getAnimationForState(newSm.current, newSm.isBirthday, moodRef.current);
        const newAnim = createAnimatorState(animName);
        animRef.current = newAnim;
        setAnimState(newAnim);
        prevStateRef.current = newSm.current;
      }

      if (soundEnabled) {
        if (speed >= 600) {
          playTumbleSound(soundVolume);
        } else {
          playDropSound(soundVolume);
        }
      }

      if (speed > 400) {
        moodRef.current = updateMood(moodRef.current, { type: "FLUNG_INTO_WALL" });
        setMood(moodRef.current);
      }
    },
    [soundEnabled, soundVolume]
  );

  const handleMouseEnter = useCallback(() => {
    if (smRef.current.current === "SLEEP") {
      const newSm = updateStateMachine(smRef.current, { type: "HOVER" });
      smRef.current = newSm;
      setSmState(newSm);
      if (newSm.current !== prevStateRef.current) {
        const animName = getAnimationForState(newSm.current, newSm.isBirthday, moodRef.current);
        const newAnim = createAnimatorState(animName);
        animRef.current = newAnim;
        setAnimState(newAnim);
        prevStateRef.current = newSm.current;
      }
    }
  }, []);

  const handleMouseLeave = useCallback(() => {}, []);

  const dismissSpeech = useCallback(() => { setSpeechMessage(null); }, []);
  const clearConfettiBurst = useCallback(() => { setConfettiBurst(false); }, []);

  return {
    position,
    animatorState: animState,
    stateMachine: smState,
    displaySize,
    config,
    speechMessage,
    ready,
    sleepBreathOffset,
    confettiBurst,
    swingAngle,
    mood,
    handleClick,
    handlePet,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleMouseEnter,
    handleMouseLeave,
    dismissSpeech,
    clearConfettiBurst,
  };
}

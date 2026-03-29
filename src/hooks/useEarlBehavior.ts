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
import { Position, updatePosition, clampToScreen } from "../engine/physics";
import { playHopSound, playPickUpSound, playDropSound, playBirthdaySound } from "../engine/sound";
import { SPEED_MULTIPLIERS, DEFAULT_DISPLAY_SIZE, WINDOW_HEIGHT } from "../utils/constants";
import { EarlConfig, getConfig, saveConfig, setIgnoreCursorEvents } from "../utils/config";

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
  handleClick: () => void;
  handleDragStart: () => void;
  handleDragMove: (x: number, y: number) => void;
  handleDragEnd: (x: number, y: number) => void;
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
  dismissSpeech: () => void;
  clearConfettiBurst: () => void;
}

export function useEarlBehavior(
  isBirthday: boolean,
  birthdayName: string | null,
  screenWidth: number
): EarlBehavior {
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<EarlConfig | null>(null);
  const [position, setPosition] = useState<Position>({
    x: screenWidth / 2 - DEFAULT_DISPLAY_SIZE / 2,
    y: WINDOW_HEIGHT - DEFAULT_DISPLAY_SIZE,
    groundY: WINDOW_HEIGHT - DEFAULT_DISPLAY_SIZE,
  });
  const [animState, setAnimState] = useState<AnimatorState>(
    createAnimatorState(isBirthday ? "birthday" : "idle_front")
  );
  const [smState, setSmState] = useState<StateMachineState>(
    createStateMachine(isBirthday, birthdayName)
  );
  const [speechMessage, setSpeechMessage] = useState<string | null>(null);
  const [sleepBreathOffset, setSleepBreathOffset] = useState(0);
  const [confettiBurst, setConfettiBurst] = useState(false);

  const configRef = useRef(config);
  const smRef = useRef(smState);
  const posRef = useRef(position);
  const animRef = useRef(animState);
  const prevStateRef = useRef<EarlState>(smState.current);

  configRef.current = config;
  smRef.current = smState;
  posRef.current = position;
  animRef.current = animState;

  const displaySize = config?.display.size ?? DEFAULT_DISPLAY_SIZE;
  const speedMult = SPEED_MULTIPLIERS[config?.display.animationSpeed ?? "normal"] ?? 1;
  const soundEnabled = config?.sound.enabled ?? false;
  const soundVolume = config?.sound.volume ?? 0.5;

  // Init: load sprites + config
  useEffect(() => {
    Promise.all([preloadSprites(), getConfig().catch(() => null)]).then(
      ([, loadedConfig]) => {
        if (loadedConfig) {
          setConfig(loadedConfig);
          if (loadedConfig.position.x != null) {
            setPosition((p) => ({
              ...p,
              x: loadedConfig.position.x!,
            }));
          }
        }
        setReady(true);
      }
    );
  }, []);

  // Main game loop
  useEffect(() => {
    if (!ready) return;

    let lastTime = 0;
    let rafId: number;

    const loop = (time: number) => {
      const delta = lastTime ? time - lastTime : 16;
      lastTime = time;

      // Update state machine
      const newSm = updateStateMachine(smRef.current, { type: "TICK", deltaMs: delta });

      // Detect state change — update animation
      if (newSm.current !== prevStateRef.current) {
        const animName = getAnimationForState(newSm.current, newSm.isBirthday);
        setAnimState(createAnimatorState(animName));
        prevStateRef.current = newSm.current;
      } else {
        // Update animation frame
        setAnimState((prev) => {
          const updated = updateAnimator(prev, delta, speedMult);
          if (updated.finished && !prev.finished) {
            // Animation finished — notify state machine
            const afterFinish = updateStateMachine(newSm, { type: "ANIMATION_FINISHED" });
            setSmState(afterFinish);
            if (afterFinish.current !== newSm.current) {
              const animName = getAnimationForState(afterFinish.current, afterFinish.isBirthday);
              prevStateRef.current = afterFinish.current;
              return createAnimatorState(animName);
            }
          }
          return updated;
        });
      }

      setSmState(newSm);

      // Update position
      setPosition((prev) => {
        const updated = updatePosition(
          prev,
          newSm.current,
          delta,
          animRef.current.frameIndex,
          screenWidth,
          displaySize
        );
        return clampToScreen(updated, screenWidth, displaySize);
      });

      // Sleep breathing
      if (newSm.current === "SLEEP") {
        setSleepBreathOffset(Math.sin(time / 1000) * 1.5);
      } else {
        setSleepBreathOffset(0);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [ready, screenWidth, displaySize, speedMult]);

  // Save config periodically
  useEffect(() => {
    if (!config) return;
    const interval = setInterval(() => {
      const c = configRef.current;
      if (c) {
        c.position.x = posRef.current.x;
        saveConfig(c).catch(() => {});
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [config]);

  const handleClick = useCallback(() => {
    const sm = smRef.current;
    const newSm = updateStateMachine(sm, { type: "CLICK" });
    setSmState(newSm);

    if (newSm.current === "HOP") {
      if (soundEnabled) {
        if (isBirthday) {
          playBirthdaySound(soundVolume);
        } else {
          playHopSound(soundVolume);
        }
      }
      if (isBirthday && birthdayName) {
        setSpeechMessage(`Happy Birthday ${birthdayName}! 🎉`);
        setConfettiBurst(true);
      }
      // Track stats
      if (configRef.current) {
        configRef.current.stats.totalHops += 1;
      }
    }

    if (newSm.current !== sm.current) {
      const animName = getAnimationForState(newSm.current, newSm.isBirthday);
      setAnimState(createAnimatorState(animName));
      prevStateRef.current = newSm.current;
    }
  }, [soundEnabled, soundVolume, isBirthday, birthdayName]);

  const handleDragStart = useCallback(() => {
    const newSm = updateStateMachine(smRef.current, { type: "DRAG_START" });
    setSmState(newSm);
    setAnimState(createAnimatorState("picked_up"));
    prevStateRef.current = "PICKED_UP";
    if (soundEnabled) playPickUpSound(soundVolume);
  }, [soundEnabled, soundVolume]);

  const handleDragMove = useCallback(
    (x: number, y: number) => {
      setPosition((prev) => ({
        ...prev,
        x: Math.max(0, Math.min(x, screenWidth - displaySize)),
        y: Math.max(0, Math.min(y, WINDOW_HEIGHT - displaySize)),
      }));
    },
    [screenWidth, displaySize]
  );

  const handleDragEnd = useCallback(
    (_x: number, _y: number) => {
      const newSm = updateStateMachine(smRef.current, { type: "DRAG_END" });
      setSmState(newSm);
      setAnimState(createAnimatorState("dropped"));
      prevStateRef.current = "DROPPED";
      if (soundEnabled) playDropSound(soundVolume);

      // Update ground position to where Earl was dropped
      setPosition((prev) => ({
        ...prev,
        groundY: prev.y,
      }));
    },
    [soundEnabled, soundVolume]
  );

  const handleMouseEnter = useCallback(() => {
    setIgnoreCursorEvents(false).catch(() => {});
    if (smRef.current.current === "SLEEP") {
      const newSm = updateStateMachine(smRef.current, { type: "HOVER" });
      setSmState(newSm);
      if (newSm.current !== smRef.current.current) {
        const animName = getAnimationForState(newSm.current, newSm.isBirthday);
        setAnimState(createAnimatorState(animName));
        prevStateRef.current = newSm.current;
      }
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIgnoreCursorEvents(true).catch(() => {});
  }, []);

  const dismissSpeech = useCallback(() => {
    setSpeechMessage(null);
  }, []);

  const clearConfettiBurst = useCallback(() => {
    setConfettiBurst(false);
  }, []);

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
    handleClick,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleMouseEnter,
    handleMouseLeave,
    dismissSpeech,
    clearConfettiBurst,
  };
}

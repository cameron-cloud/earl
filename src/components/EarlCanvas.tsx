import { useRef, useEffect } from "react";
import { getCurrentFrame, AnimatorState } from "../engine/animator";
import { SPRITE_SOURCE_SIZE } from "../utils/constants";

interface Props {
  animatorState: AnimatorState;
  displaySize: number;
  sleepBreathOffset?: number;
}

export default function EarlCanvas({ animatorState, displaySize, sleepBreathOffset = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, displaySize, displaySize);

    const frame = getCurrentFrame(animatorState);
    if (frame) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        frame,
        0,
        0,
        SPRITE_SOURCE_SIZE,
        SPRITE_SOURCE_SIZE,
        0,
        sleepBreathOffset,
        displaySize,
        displaySize
      );
    } else {
      // Placeholder: yellow ellipse
      ctx.fillStyle = "#FAEDB5";
      ctx.beginPath();
      ctx.ellipse(
        displaySize / 2,
        displaySize / 2,
        displaySize * 0.35,
        displaySize * 0.4,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      // Eyes
      ctx.fillStyle = "#0A0A0A";
      ctx.beginPath();
      ctx.arc(displaySize * 0.38, displaySize * 0.38, displaySize * 0.04, 0, Math.PI * 2);
      ctx.arc(displaySize * 0.62, displaySize * 0.38, displaySize * 0.04, 0, Math.PI * 2);
      ctx.fill();
      // Beak
      ctx.fillStyle = "#E8943A";
      ctx.beginPath();
      ctx.arc(displaySize * 0.5, displaySize * 0.48, displaySize * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [animatorState, displaySize, sleepBreathOffset]);

  return (
    <canvas
      ref={canvasRef}
      width={displaySize}
      height={displaySize}
      style={{
        width: displaySize,
        height: displaySize,
        background: "transparent",
        imageRendering: "auto",
      }}
    />
  );
}

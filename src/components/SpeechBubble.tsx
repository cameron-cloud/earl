import { useEffect, useState } from "react";
import { SPEECH_BUBBLE_DURATION } from "../utils/constants";

interface Props {
  message: string | null;
  onDone: () => void;
  displaySize: number;
}

export default function SpeechBubble({ message, onDone, displaySize }: Props) {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (!message) {
      setOpacity(0);
      return;
    }

    // Fade in
    setOpacity(1);

    // Hold, then fade out
    const holdTimer = setTimeout(() => {
      setOpacity(0);
    }, SPEECH_BUBBLE_DURATION - 500);

    const doneTimer = setTimeout(() => {
      onDone();
    }, SPEECH_BUBBLE_DURATION);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(doneTimer);
    };
  }, [message, onDone]);

  if (!message) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: displaySize + 10,
        left: "50%",
        transform: "translateX(-50%)",
        background: "white",
        borderRadius: 12,
        padding: "6px 12px",
        fontSize: 13,
        fontFamily: "'Segoe UI', sans-serif",
        color: "#333",
        whiteSpace: "nowrap",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        opacity,
        transition: "opacity 0.4s ease",
        pointerEvents: "none",
      }}
    >
      {message}
      {/* Tail */}
      <div
        style={{
          position: "absolute",
          bottom: -6,
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: "6px solid white",
        }}
      />
    </div>
  );
}

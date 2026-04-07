import { useState, useEffect } from "react";

interface Props {
  trigger: number; // increments each pet
  displaySize: number;
}

interface Heart {
  id: number;
  x: number;
}

export default function PetHeart({ trigger, displaySize }: Props) {
  const [hearts, setHearts] = useState<Heart[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    const id = trigger;
    const x = displaySize * 0.3 + Math.random() * displaySize * 0.4;
    setHearts((prev) => [...prev, { id, x }]);

    const timer = setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== id));
    }, 800);
    return () => clearTimeout(timer);
  }, [trigger, displaySize]);

  return (
    <>
      {hearts.map((h) => (
        <div
          key={h.id}
          style={{
            position: "absolute",
            left: h.x,
            top: displaySize * 0.1,
            fontSize: displaySize * 0.3,
            pointerEvents: "none",
            animation: "pet-heart-float 0.8s ease-out forwards",
            zIndex: 10,
          }}
        >
          <span style={{ filter: "drop-shadow(0 0 2px rgba(255,100,100,0.5))" }}>
            &#x2764;
          </span>
        </div>
      ))}
      <style>{`
        @keyframes pet-heart-float {
          0% { opacity: 1; transform: translateY(0) scale(0.5); }
          50% { opacity: 1; transform: translateY(-20px) scale(1); }
          100% { opacity: 0; transform: translateY(-40px) scale(0.8); }
        }
      `}</style>
    </>
  );
}

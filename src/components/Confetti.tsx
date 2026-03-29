import { useRef, useEffect, useCallback } from "react";
import {
  CONFETTI_PARTICLE_LIFETIME,
  CONFETTI_SPAWN_CHANCE,
  CONFETTI_COLORS,
} from "../utils/constants";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  life: number;
}

interface Props {
  active: boolean;
  burst: boolean;
  onBurstDone: () => void;
  areaWidth: number;
  areaHeight: number;
}

export default function Confetti({
  active,
  burst,
  onBurstDone,
  areaWidth,
  areaHeight,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(0);
  const burstHandled = useRef(false);

  const spawnParticle = useCallback(
    (x?: number, y?: number): Particle => ({
      x: x ?? Math.random() * areaWidth,
      y: y ?? -10,
      vx: (Math.random() - 0.5) * 60,
      vy: Math.random() * 30 + 20,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 300,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 3 + Math.random() * 4,
      life: CONFETTI_PARTICLE_LIFETIME,
    }),
    [areaWidth]
  );

  useEffect(() => {
    if (burst && !burstHandled.current) {
      burstHandled.current = true;
      const cx = areaWidth / 2;
      for (let i = 0; i < 8; i++) {
        particlesRef.current.push(spawnParticle(cx + (Math.random() - 0.5) * 40, 10));
      }
      setTimeout(() => {
        burstHandled.current = false;
        onBurstDone();
      }, 100);
    }
  }, [burst, areaWidth, spawnParticle, onBurstDone]);

  useEffect(() => {
    if (!active && particlesRef.current.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = (time: number) => {
      const delta = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 0;
      lastTimeRef.current = time;

      // Ambient spawn
      if (active && Math.random() < CONFETTI_SPAWN_CHANCE) {
        particlesRef.current.push(spawnParticle());
      }

      // Update
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.vy += 40 * delta; // gravity
        p.rotation += p.rotationSpeed * delta;
        p.life -= delta * 1000;
        return p.life > 0 && p.y < areaHeight + 20;
      });

      // Draw
      ctx.clearRect(0, 0, areaWidth, areaHeight);
      for (const p of particlesRef.current) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, p.life / 500);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }

      if (active || particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, areaWidth, areaHeight, spawnParticle]);

  if (!active && particlesRef.current.length === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      width={areaWidth}
      height={areaHeight}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
    />
  );
}

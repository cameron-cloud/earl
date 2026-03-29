import { useState, useEffect } from "react";
import { getConfig } from "../utils/config";
import EarlCanvas from "./EarlCanvas";
import { createAnimatorState, updateAnimator, preloadSprites } from "../engine/animator";

export default function AboutPanel() {
  const [firstLaunch, setFirstLaunch] = useState<string | null>(null);
  const [animState, setAnimState] = useState(createAnimatorState("idle_front"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      preloadSprites(),
      getConfig().catch(() => null),
    ]).then(([, config]) => {
      if (config?.stats.firstLaunchDate) {
        const date = new Date(config.stats.firstLaunchDate);
        setFirstLaunch(
          date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        );
      }
      setReady(true);
    });
  }, []);

  // Animate idle
  useEffect(() => {
    if (!ready) return;
    let lastTime = 0;
    let rafId: number;
    const loop = (time: number) => {
      const delta = lastTime ? time - lastTime : 16;
      lastTime = time;
      setAnimState((prev) => updateAnimator(prev, delta, 1));
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [ready]);

  return (
    <div style={styles.container}>
      <div style={styles.spriteWrapper}>
        <EarlCanvas animatorState={animState} displaySize={96} />
      </div>
      <h2 style={styles.title}>Earl v1.0</h2>
      <p style={styles.story}>
        Earl started as a real stuffed duck. He was so loved that he was brought
        to life digitally so he could live forever.
      </p>
      <p style={styles.love}>Made with love ❤️</p>
      {firstLaunch && (
        <p style={styles.companion}>
          Earl has been your companion since {firstLaunch}
        </p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 24,
    fontFamily: "'Segoe UI', sans-serif",
    color: "#333",
    background: "#fefefe",
    minHeight: "100vh",
    textAlign: "center",
  },
  spriteWrapper: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 12,
  },
  story: {
    fontSize: 14,
    lineHeight: 1.5,
    color: "#555",
    marginBottom: 12,
    maxWidth: 280,
    marginLeft: "auto",
    marginRight: "auto",
  },
  love: {
    fontSize: 14,
    marginBottom: 12,
  },
  companion: {
    fontSize: 12,
    color: "#888",
    fontStyle: "italic",
  },
};

import { useState, useEffect } from "react";
import { EarlConfig, getConfig, saveConfig } from "../utils/config";
import { SIZE_OPTIONS } from "../utils/constants";

export default function SettingsPanel() {
  const [config, setConfig] = useState<EarlConfig | null>(null);

  useEffect(() => {
    getConfig()
      .then(setConfig)
      .catch(() => {});
  }, []);

  if (!config) {
    return <div style={styles.container}>Loading...</div>;
  }

  const update = (partial: Partial<EarlConfig>) => {
    const updated = { ...config, ...partial };
    setConfig(updated);
    saveConfig(updated).catch(() => {});
  };

  const daysSinceFirstLaunch = config.stats.firstLaunchDate
    ? Math.floor(
        (Date.now() - new Date(config.stats.firstLaunchDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 0;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Earl Settings</h2>

      {/* Display Size */}
      <div style={styles.section}>
        <label style={styles.label}>Display Size</label>
        <div style={styles.sizeOptions}>
          {SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              onClick={() => update({ display: { ...config.display, size } })}
              style={{
                ...styles.sizeButton,
                ...(config.display.size === size ? styles.sizeButtonActive : {}),
              }}
            >
              {size}px
            </button>
          ))}
        </div>
      </div>

      {/* Animation Speed */}
      <div style={styles.section}>
        <label style={styles.label}>Animation Speed</label>
        <select
          value={config.display.animationSpeed}
          onChange={(e) =>
            update({ display: { ...config.display, animationSpeed: e.target.value } })
          }
          style={styles.select}
        >
          <option value="chill">Chill</option>
          <option value="normal">Normal</option>
          <option value="hyper">Hyper</option>
        </select>
      </div>

      {/* Sound */}
      <div style={styles.section}>
        <label style={styles.label}>
          <input
            type="checkbox"
            checked={config.sound.enabled}
            onChange={(e) =>
              update({ sound: { ...config.sound, enabled: e.target.checked } })
            }
            style={styles.checkbox}
          />
          Sound
        </label>
        {config.sound.enabled && (
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={config.sound.volume}
            onChange={(e) =>
              update({ sound: { ...config.sound, volume: parseFloat(e.target.value) } })
            }
            style={styles.slider}
          />
        )}
      </div>

      {/* Launch on Startup */}
      <div style={styles.section}>
        <label style={styles.label}>
          <input
            type="checkbox"
            checked={config.behavior.launchOnStartup}
            onChange={(e) =>
              update({ behavior: { launchOnStartup: e.target.checked } })
            }
            style={styles.checkbox}
          />
          Launch on startup
        </label>
      </div>

      {/* Stats */}
      <div style={styles.section}>
        <h3 style={styles.statsTitle}>Earl Stats</h3>
        <div style={styles.stat}>Total hops: {config.stats.totalHops}</div>
        <div style={styles.stat}>
          Distance waddled: {Math.round(config.stats.totalPixelsWaddled).toLocaleString()}px
        </div>
        <div style={styles.stat}>
          Days as companion: {daysSinceFirstLaunch}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 20,
    fontFamily: "'Segoe UI', sans-serif",
    color: "#333",
    background: "#fefefe",
    minHeight: "100vh",
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 16,
    color: "#222",
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  sizeOptions: {
    display: "flex",
    gap: 8,
  },
  sizeButton: {
    padding: "6px 14px",
    border: "1px solid #ccc",
    borderRadius: 6,
    background: "#f5f5f5",
    cursor: "pointer",
    fontSize: 13,
  },
  sizeButtonActive: {
    background: "#FFD666",
    borderColor: "#E8943A",
    fontWeight: 600,
  },
  select: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #ccc",
    fontSize: 13,
  },
  checkbox: {
    marginRight: 4,
  },
  slider: {
    width: "100%",
    marginTop: 6,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 8,
    color: "#555",
  },
  stat: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
  },
};

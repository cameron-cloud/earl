import { invoke } from "@tauri-apps/api/core";

export interface EarlConfig {
  version: number;
  display: {
    size: number;
    animationSpeed: string;
  };
  sound: {
    enabled: boolean;
    volume: number;
  };
  behavior: {
    launchOnStartup: boolean;
  };
  stats: {
    firstLaunchDate: string | null;
    totalHops: number;
    totalPixelsWaddled: number;
  };
  position: {
    x: number | null;
    y: number | null;
    onTaskbar: boolean;
  };
}

export interface ScreenInfo {
  width: number;
  height: number;
  scale_factor: number;
}

export async function getConfig(): Promise<EarlConfig> {
  return invoke<EarlConfig>("get_config");
}

export async function saveConfig(config: EarlConfig): Promise<void> {
  return invoke("save_config", { config });
}

export async function getScreenInfo(): Promise<ScreenInfo> {
  return invoke<ScreenInfo>("get_screen_info");
}

export async function setIgnoreCursorEvents(ignore: boolean): Promise<void> {
  return invoke("set_ignore_cursor_events", { ignore });
}

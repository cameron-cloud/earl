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
  mood?: {
    value: number;
  };
}

export interface ScreenInfo {
  width: number;
  height: number;
  scale_factor: number;
}

export async function showWindow(): Promise<void> {
  return invoke("show_window");
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

/** Expand window to full screen for drag. Returns Y offset to add to Earl's position. */
export async function expandWindow(): Promise<number> {
  return invoke<number>("expand_window");
}

/** Shrink window back to 200px strip at bottom. */
export async function shrinkWindow(taskbarVisible: boolean = true): Promise<void> {
  return invoke("shrink_window", { taskbarVisible });
}

/** Check if the Windows taskbar is currently visible on screen. */
export async function getTaskbarState(): Promise<{ visible: boolean }> {
  return invoke<{ visible: boolean }>("get_taskbar_state");
}

/** Poll cursor position and toggle click-through. Returns true if cursor is over Earl. */
export async function updateHitTest(
  earlX: number,
  earlY: number,
  earlSize: number
): Promise<boolean> {
  return invoke<boolean>("update_hit_test", {
    earlX,
    earlY,
    earlSize,
  });
}

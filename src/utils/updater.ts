import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/** Check for updates on startup. Downloads and installs silently if available. */
export async function checkForUpdates(): Promise<void> {
  try {
    const update = await check();
    if (!update?.available) return;

    console.log(`Earl update ${update.version} available, installing...`);
    await update.downloadAndInstall();
    await relaunch();
  } catch (e) {
    // Silent fail — don't interrupt Earl if update check fails
    console.warn("Update check failed:", e);
  }
}

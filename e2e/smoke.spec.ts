// Playwright smoke test: the web bundle is served, boots, and stays fully offline.
import { expect, test } from "@playwright/test";

test("the page loads every module from the local server and nothing else", async ({
  page,
  baseURL,
}) => {
  const offline: string[] = [];
  const failed: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(`${baseURL}/`) && !url.startsWith("data:") && !url.startsWith("blob:")) {
      offline.push(url);
    }
  });
  page.on("requestfailed", (request) => failed.push(`failed ${request.url()}`));
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });

  const entry = page.waitForResponse((response) => response.url().endsWith("/src/main.tsx"));
  // "load" fires only after the module graph has been fetched and the entry module has run.
  await page.goto("/", { waitUntil: "load" });
  expect((await entry).status()).toBe(200);
  await expect(page).toHaveTitle("Earl");
  await expect(page.locator("#root")).toBeAttached();
  // v1 only renders inside the Tauri runtime (it asks for the current window on mount), so
  // this smoke test stops at "served and booted". The M1.S sandbox adds rendering checks.

  expect(offline, "requests that left the local server").toEqual([]);
  expect(failed, "requests that failed").toEqual([]);
});

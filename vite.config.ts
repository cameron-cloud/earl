import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

// M0.4 spike: two plain-TS pages, the overlay (index.html) and the focus test (keylog.html).
export default defineConfig({
  clearScreen: false,
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        keylog: "keylog.html",
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});

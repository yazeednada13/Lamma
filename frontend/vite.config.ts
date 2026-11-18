/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: the SPA and API share the origin http://localhost:5173 via this proxy, so the
// Identity cookie and antiforgery cookie are first-party (approved cookie auth, D-077).
const apiTarget = process.env.LAMMA_API_URL ?? "https://localhost:7101";

export default defineConfig({
  plugins: [react()],
  // "@/x" resolves to "src/x" (mirrors tsconfig.app.json "paths").
  resolve: { alias: [{ find: /^@\//, replacement: "/src/" }] },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: apiTarget, secure: false, changeOrigin: false },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    restoreMocks: true,
    // Many tests mount the whole app (routes + guards + providers) in jsdom, and test files run in parallel;
    // 15s gives headroom under CPU contention (e.g. the 21-route coming-soon loop) without hiding real hangs.
    testTimeout: 15_000,
    // One worker per physical core: more workers only time-slice the same CPUs and make every full-app test slower.
    maxWorkers: 4,
  },
});

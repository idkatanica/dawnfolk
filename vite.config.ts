import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";
import { createChromiumLaunchOptions } from "./tests/chromium.ts";

export default defineConfig({
  base: "./",
  build: {
    chunkSizeWarningLimit: 1600,
    target: "es2023",
  },
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          exclude: [...configDefaults.exclude, "src/**/*.browser.test.ts"],
          include: ["src/**/*.test.ts", "worker/**/*.test.ts"],
          name: "unit",
        },
      },
      {
        extends: true,
        test: {
          browser: {
            enabled: true,
            headless: true,
            instances: [{ browser: "chromium" }],
            provider: playwright({ launchOptions: createChromiumLaunchOptions() }),
          },
          include: ["src/**/*.browser.test.ts", "src/**/*.test.tsx"],
          name: "browser",
          setupFiles: ["src/features/testing/browser-setup.ts"],
        },
      },
    ],
    restoreMocks: true,
    testTimeout: 30_000,
  },
  worker: {
    format: "es",
  },
});

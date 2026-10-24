import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig, type ViteUserConfig } from "vitest/config";
import { createChromiumLaunchOptions } from "./tests/chromium.ts";

const configuration: ViteUserConfig = defineConfig({
  base: "./",
  build: {
    chunkSizeWarningLimit: 1600,
    target: "es2023",
  },
  optimizeDeps: {
    include: [
      "comlink",
      "pure-rand/distribution/uniformFloat64",
      "pure-rand/generator/xoroshiro128plus",
      "simplex-noise",
      "zod",
    ],
  },
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          exclude: [...configDefaults.exclude, "src/**/*.browser.test.ts"],
          include: ["src/**/*.test.ts"],
          name: "unit",
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        optimizeDeps: {
          include: [
            "@base-ui/react/button",
            "@base-ui/react/dialog",
            "@base-ui/react/drawer",
            "@base-ui/react/menu",
            "@base-ui/react/meter",
            "@base-ui/react/scroll-area",
            "@base-ui/react/select",
            "@base-ui/react/slider",
            "@base-ui/react/switch",
            "@base-ui/react/tabs",
            "@base-ui/react/toggle",
            "@base-ui/react/toggle-group",
            "@base-ui/react/tooltip",
            "@svidskiy/glass-surface-react",
            "clsx",
            "lucide-react",
            "react",
            "react-dom/client",
            "tailwind-merge",
            "vitest-browser-react",
            "zustand",
            "zustand/middleware",
          ],
        },
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
          testTimeout: 30_000,
        },
      },
    ],
    restoreMocks: true,
  },
  worker: {
    format: "es",
  },
});

export default configuration;

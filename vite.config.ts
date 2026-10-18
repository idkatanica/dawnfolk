import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig, type ViteUserConfig } from "vitest/config";

const chromiumLaunchOptions = createChromiumLaunchOptions();

function readEnvironmentVariable(name: string): string | undefined {
  return process.env[name];
}

function createChromiumLaunchOptions(): { args: string[]; executablePath?: string } {
  const launchArguments = ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
  const executablePath = readEnvironmentVariable("CHROMIUM_EXECUTABLE_PATH");

  if (executablePath === undefined) {
    return { args: launchArguments };
  }

  return { args: launchArguments, executablePath };
}

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
            provider: playwright({ launchOptions: chromiumLaunchOptions }),
          },
          include: ["src/**/*.browser.test.ts", "src/**/*.test.tsx"],
          name: "browser",
          setupFiles: ["src/features/testing/browser-setup.ts"],
        },
      },
    ],
  },
  worker: {
    format: "es",
  },
});

export default configuration;

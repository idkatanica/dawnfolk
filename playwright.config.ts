import { defineConfig, devices, type LaunchOptions } from "@playwright/test";

const PREVIEW_PORT = 4173;

function readEnvironmentVariable(name: string): string | undefined {
  return process.env[name];
}

function createLaunchOptions(): LaunchOptions {
  const launchArguments = ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
  const executablePath = readEnvironmentVariable("CHROMIUM_EXECUTABLE_PATH");

  if (executablePath === undefined) {
    return { args: launchArguments };
  }

  return { args: launchArguments, executablePath };
}

const isContinuousIntegration = readEnvironmentVariable("CI") !== undefined;
const launchOptions = createLaunchOptions();

export default defineConfig({
  expect: { timeout: 20_000 },
  forbidOnly: isContinuousIntegration,
  projects: [
    { name: "desktop", testIgnore: "phone.spec.ts", use: { ...devices["Desktop Chrome"], launchOptions } },
    { name: "phone", testIgnore: "desktop.spec.ts", use: { ...devices["Pixel 7"], launchOptions } },
  ],
  reporter: isContinuousIntegration ? "github" : "list",
  retries: isContinuousIntegration ? 1 : 0,
  testDir: "tests",
  timeout: 180_000,
  use: {
    baseURL: `http://localhost:${PREVIEW_PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `bun run build && bun run preview --port ${PREVIEW_PORT} --strictPort`,
    port: PREVIEW_PORT,
    reuseExistingServer: !isContinuousIntegration,
    timeout: 300_000,
  },
  workers: 1,
});

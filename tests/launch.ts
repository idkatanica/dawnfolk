import { expect, type Page } from "@playwright/test";

const WORLD_RISING_TIMEOUT = 150_000;

export async function openIsland(page: Page): Promise<void> {
  await page.goto("/?seed=7&quality=low&paused=1");

  await expect(page.getByRole("status")).toBeHidden({ timeout: WORLD_RISING_TIMEOUT });
}

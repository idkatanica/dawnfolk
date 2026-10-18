import { expect, test } from "@playwright/test";
import { openIsland, WORLD_RISING_TIMEOUT } from "./launch.ts";

const NEW_SEED_ADDRESS = /seed=42/;

test.describe("the wide layout", () => {
  test.beforeEach(async ({ page }) => {
    await openIsland(page);
  });

  test("opens the journal with the tribes of the island", async ({ page }) => {
    await page.getByRole("button", { exact: true, name: "Journal" }).click();

    const journal = page.getByRole("region", { name: "Journal" });

    await expect(journal).toBeVisible();
    await expect(journal.getByRole("tab", { name: "Tribes" })).toHaveAttribute("aria-selected", "true");
    await expect(journal.getByRole("listitem").first()).toBeVisible();
  });

  test("opens the settings and switches between sections", async ({ page }) => {
    await page.getByRole("button", { exact: true, name: "Settings" }).click();

    const settings = page.getByRole("dialog", { name: "Settings" });

    await expect(settings).toBeVisible();

    await settings.getByRole("tab", { name: "Weather" }).click();

    await expect(settings.getByRole("tab", { name: "Weather" })).toHaveAttribute("aria-selected", "true");

    await settings.getByRole("button", { name: "Close settings" }).click();

    await expect(settings).toBeHidden();
  });

  test("grows a new world from a seed without reloading the page", async ({ page }) => {
    await page.getByRole("button", { exact: true, name: "Settings" }).click();

    const settings = page.getByRole("dialog", { name: "Settings" });

    await settings.getByRole("tab", { name: "Island" }).click();
    await settings.getByRole("textbox", { name: "Seed" }).fill("42");
    await settings.getByRole("button", { exact: true, name: "Create" }).click();

    await expect(page).toHaveURL(NEW_SEED_ADDRESS);
    await expect(page.getByRole("button", { exact: true, name: "Pause" })).toBeVisible({
      timeout: WORLD_RISING_TIMEOUT,
    });
  });
});

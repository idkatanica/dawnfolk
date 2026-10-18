import { expect, test } from "@playwright/test";
import { openIsland } from "./launch.ts";

const PEAK_HEIGHT = /^\d+ m$/;

test.describe("the island", () => {
  test.beforeEach(async ({ page }) => {
    await openIsland(page);
  });

  test("shows the time controls and the power dock once the world has risen", async ({ page }) => {
    await expect(page.getByRole("button", { exact: true, name: "Resume" })).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Kinds of powers" })).toBeVisible();
    await expect(page.getByRole("button", { exact: true, name: "Select" })).toHaveAttribute("aria-pressed", "true");
  });

  test("resumes and pauses time", async ({ page }) => {
    await page.getByRole("button", { exact: true, name: "Resume" }).click();

    await expect(page.getByRole("button", { exact: true, name: "Pause" })).toBeVisible();

    await page.getByRole("button", { exact: true, name: "Pause" }).click();

    await expect(page.getByRole("button", { exact: true, name: "Resume" })).toBeVisible();
  });

  test("names the tribes and the landmarks over the island", async ({ page }) => {
    const tribes = page.getByRole("list", { name: "Tribes" });
    const places = page.getByRole("list", { name: "Places" });

    await expect(tribes.getByRole("listitem", { includeHidden: true })).toHaveCount(2);
    await expect(places.getByText(PEAK_HEIGHT)).toBeAttached();
  });

  test("shows the settings of the chosen power", async ({ page }) => {
    await page.getByRole("button", { exact: true, name: "Fire" }).click();

    await expect(page.getByRole("region", { name: "Fire settings" })).toBeVisible();
    await expect(page.getByRole("slider", { name: "Strength" })).toBeVisible();

    await page.getByRole("button", { exact: true, name: "Select" }).click();

    await expect(page.getByRole("region", { name: "Fire settings" })).toBeHidden();
  });
});

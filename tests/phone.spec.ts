import { expect, test } from "@playwright/test";
import { openIsland } from "./launch.ts";

test.describe("the phone layout", () => {
  test.beforeEach(async ({ page }) => {
    await openIsland(page);
  });

  test("opens the journal as a sheet from the menu", async ({ page }) => {
    await page.getByRole("button", { exact: true, name: "Menu" }).click();
    await page.getByRole("menuitem", { name: "Tribes and chronicle" }).click();

    const sheet = page.getByRole("dialog", { name: "Journal" });

    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("tab", { name: "Chronicle" })).toBeVisible();
  });

  test("opens the settings from the menu", async ({ page }) => {
    await page.getByRole("button", { exact: true, name: "Menu" }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();

    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  });
});

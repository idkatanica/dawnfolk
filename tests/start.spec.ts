import { expect, test } from "@playwright/test";
import { WORLD_RISING_TIMEOUT } from "./launch.ts";

const SQUARE_WORLD_ADDRESS = /name=Old\+Ford.*shape=square/;

test.describe("the start screen", () => {
  test("names a square world and grows it", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("textbox", { name: "Name" }).fill("Old Ford");
    await page.getByRole("button", { exact: true, name: "Square" }).click();
    await page.getByRole("button", { name: "Grow the island" }).click();

    await expect(page).toHaveURL(SQUARE_WORLD_ADDRESS);
    await expect(page).toHaveTitle("Old Ford · Dawnfolk");
    await expect(page.getByRole("status")).toBeHidden({ timeout: WORLD_RISING_TIMEOUT });
    await expect(page.getByRole("tablist", { name: "Kinds of powers" })).toBeVisible();
  });
});

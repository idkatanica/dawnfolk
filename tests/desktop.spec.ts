import { expect, test } from "@playwright/test";
import { openIsland, WORLD_RISING_TIMEOUT } from "./launch.ts";

const NEW_SEED_ADDRESS = /seed=42/;

test("the wide layout opens the journal and grows a new world from the settings without reloading", async ({
  page,
}) => {
  await openIsland(page);

  await page.getByRole("button", { exact: true, name: "Journal" }).click();

  const journal = page.getByRole("region", { name: "Journal" });

  await expect(journal.getByRole("tab", { name: "Tribes" })).toHaveAttribute("aria-selected", "true");
  await expect(journal.getByRole("listitem").first()).toBeVisible();

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

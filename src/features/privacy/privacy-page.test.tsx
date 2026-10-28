import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { PrivacyPage } from "./privacy-page.tsx";

describe("privacy page", () => {
  it("renders the policy with its table", async () => {
    const screen = await render(<PrivacyPage />);

    await expect.element(screen.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
    await expect.element(screen.getByRole("cell", { name: "Saved worlds and their journals" })).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "Back to the game" })).toHaveAttribute("href", "/");
  });
});

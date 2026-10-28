import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { PrivacyPage } from "./privacy-page.tsx";

describe("privacy page", () => {
  it("renders the policy with its table and outside links in new tabs", async () => {
    const screen = await render(<PrivacyPage />);

    await expect.element(screen.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
    await expect.element(screen.getByRole("cell", { name: "Saved worlds and their journals" })).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "privacy policy" })).toHaveAttribute("target", "_blank");
    await expect.element(screen.getByRole("link", { name: "Back to Dawnfolk" })).toHaveAttribute("href", "/");
  });
});

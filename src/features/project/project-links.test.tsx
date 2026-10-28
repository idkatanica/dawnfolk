import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { formatStars } from "./github-stars.ts";
import { ProjectLinks } from "./project-links.tsx";

describe("project links", () => {
  it("links to the repository with its stars and to sponsorship", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({ stargazers_count: 1234 })))
    );

    const screen = await render(<ProjectLinks />);

    await expect
      .element(screen.getByRole("link", { name: "Dawnfolk on GitHub" }))
      .toHaveAttribute("href", "https://github.com/imsvidskiy/dawnfolk");
    await expect.element(screen.getByText("1.2K")).toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "Sponsor Dawnfolk" }))
      .toHaveAttribute("href", "https://github.com/sponsors/imsvidskiy");
  });

  it("leaves the stars out when GitHub does not answer", async () => {
    const screen = await render(<ProjectLinks />);

    await expect.element(screen.getByRole("link", { name: "Dawnfolk on GitHub" })).not.toHaveTextContent("K");
  });

  it("shortens large star counts", () => {
    expect(formatStars(8)).toBe("8");
    expect(formatStars(2000)).toBe("2K");
    expect(formatStars(15_340)).toBe("15.3K");
  });
});

import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { SEASONS } from "../../content/seasons.ts";
import { createCalendar, showWorld } from "../testing/world-fixtures.ts";
import { TimeSection } from "./time-section.tsx";

describe("time section", () => {
  it("stays empty until the first frame arrives", async () => {
    const screen = await render(<TimeSection />);

    expect(screen.container).toBeEmptyDOMElement();
  });

  it("shows the time of day as a clock", async () => {
    showWorld({ calendar: createCalendar({ hours: 14.5 }) });

    const screen = await render(<TimeSection />);

    await expect.element(screen.getByRole("slider", { name: "Time of day" })).toHaveValue("14.5");
    await expect.element(screen.getByText("14:30")).toBeVisible();
  });

  it("shows the season the year is in", async () => {
    showWorld({ calendar: createCalendar({ season: 2.4, seasonName: "Autumn" }) });

    const screen = await render(<TimeSection />);

    await expect.element(screen.getByRole("combobox", { name: "Season" })).toHaveTextContent("Autumn");
  });

  it("offers every season", async () => {
    showWorld();

    const screen = await render(<TimeSection />);

    await screen.getByRole("combobox", { name: "Season" }).click();

    await Promise.all(
      SEASONS.map((season) => {
        return expect.element(screen.getByRole("option", { name: season })).toBeInTheDocument();
      })
    );
  });

  it("shows how long days and seasons last", async () => {
    showWorld({ calendar: createCalendar({ daySeconds: 300, daysPerSeason: 1 }) });

    const screen = await render(<TimeSection />);

    await expect.element(screen.getByRole("slider", { name: "Day length" })).toHaveValue("300");
    await expect.element(screen.getByText("300 s")).toBeVisible();
    await expect.element(screen.getByRole("slider", { name: "Season length" })).toHaveValue("1");
    await expect.element(screen.getByText("1 day")).toBeVisible();
  });

  it("shows whether the clock is stopped", async () => {
    showWorld({ calendar: createCalendar({ isTimeFrozen: true }) });

    const screen = await render(<TimeSection />);

    await expect.element(screen.getByRole("switch", { name: "Stop the clock" })).toBeChecked();
  });
});

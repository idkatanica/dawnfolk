import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { createCalendar, createTribe, createWeather, resetWorld, showWorld } from "../testing/world-fixtures.ts";
import { CompactClock, WorldStatus } from "./world-status.tsx";

describe("world status", () => {
  afterEach(() => {
    resetWorld();
  });

  it("stays empty until the first frame arrives", async () => {
    const screen = await render(<WorldStatus />);

    expect(screen.container).toBeEmptyDOMElement();
  });

  it("shows the clock, the calendar, the weather and the population", async () => {
    showWorld({
      calendar: createCalendar({ dayOfSeason: 2, hours: 18.5, seasonName: "Autumn", year: 3 }),
      tribes: [createTribe({ population: 23 })],
      weather: createWeather({ name: "Rain", windSpeed: 21.6 }),
    });

    const screen = await render(<WorldStatus />);

    await expect.element(screen.getByText("18:30")).toBeVisible();
    await expect.element(screen.getByText("Autumn · Day 2 · Year 3")).toBeInTheDocument();
    await expect.element(screen.getByText("Rain")).toBeVisible();
    await expect.element(screen.getByText("22 km/h")).toBeInTheDocument();
    await expect.element(screen.getByText("23")).toBeVisible();
    await expect.element(screen.getByText("1 tribe")).toBeInTheDocument();
  });
});

describe("compact clock", () => {
  afterEach(() => {
    resetWorld();
  });

  it("shows the time with the season and the day", async () => {
    showWorld({ calendar: createCalendar({ dayOfSeason: 3, hours: 6.25, seasonName: "Winter" }) });

    const screen = await render(<CompactClock />);

    await expect.element(screen.getByText("06:15")).toBeVisible();
    await expect.element(screen.getByText("Winter ·")).toBeVisible();
    await expect.element(screen.getByText("Day 3", { exact: false })).toBeVisible();
  });
});

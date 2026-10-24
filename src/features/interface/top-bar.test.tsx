import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { createCalendar, createStatistics, createWeather, resetWorld, showWorld } from "../testing/world-fixtures.ts";
import { useInterfaceStore } from "./interface-store.ts";
import { CompactTopBar, TopBar } from "./top-bar.tsx";

const INITIAL_INTERFACE = useInterfaceStore.getState();

function showMorning(): void {
  showWorld({
    calendar: createCalendar({ hours: 9.5 }),
    isPaused: true,
    statistics: createStatistics({ population: 14, tribes: 2 }),
    weather: createWeather({ name: "Clear" }),
  });
}

describe("top bar", () => {
  afterEach(() => {
    resetWorld();
    useInterfaceStore.setState(INITIAL_INTERFACE, true);
  });

  it("holds the status, the time controls and the panel buttons in one bar", async () => {
    showMorning();

    const screen = await render(<TopBar />);

    const bar = screen.getByRole("banner");

    await expect.element(bar.getByText("09:30")).toBeVisible();
    await expect.element(bar.getByText("Clear")).toBeVisible();
    await expect.element(bar.getByText("14", { exact: true })).toBeVisible();
    await expect.element(bar.getByRole("button", { exact: true, name: "Resume" })).toBeVisible();
    await expect.element(bar.getByRole("group", { name: "Game speed" })).toBeVisible();
    await expect.element(bar.getByRole("navigation", { name: "Panels" })).toBeVisible();
  });

  it("keeps only the clock, the time controls and the menu on a phone", async () => {
    showMorning();

    const screen = await render(<CompactTopBar />);

    const bar = screen.getByRole("banner");

    await expect.element(bar.getByText("09:30")).toBeVisible();
    await expect.element(bar.getByRole("button", { exact: true, name: "Resume" })).toBeVisible();
    await expect.element(bar.getByRole("button", { exact: true, name: "Menu" })).toBeVisible();
    await expect.element(bar.getByText("Clear")).not.toBeInTheDocument();
  });
});

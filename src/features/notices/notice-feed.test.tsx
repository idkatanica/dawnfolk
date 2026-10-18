import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { resetWorld } from "../testing/world-fixtures.ts";
import { dismissNotice, useWorldStore, type WorldNotice } from "../world/world-store.ts";
import { NoticeFeed } from "./notice-feed.tsx";

const NOTICE_MILLISECONDS = 7000;

const RAIN_NOTICE: WorldNotice = { category: "notice", id: 1, text: "Rain is coming." };
const HUNGER_WARNING: WorldNotice = { category: "warning", id: 2, text: "The Wolf Clan is starving." };

describe("notice feed", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetWorld();
  });

  it("lists the current notices", async () => {
    useWorldStore.setState({ notices: [RAIN_NOTICE, HUNGER_WARNING] });

    const screen = await render(<NoticeFeed />);

    expect(screen.getByRole("listitem").elements()).toHaveLength(2);
    await expect.element(screen.getByText("Rain is coming.")).toBeVisible();
    await expect.element(screen.getByText("The Wolf Clan is starving.")).toBeVisible();
  });

  it("announces new notices politely to assistive technology", async () => {
    const screen = await render(<NoticeFeed />);

    await expect.element(screen.getByRole("list")).toHaveAttribute("aria-live", "polite");
  });

  it("drops a dismissed notice and keeps the others", async () => {
    useWorldStore.setState({ notices: [RAIN_NOTICE, HUNGER_WARNING] });

    const screen = await render(<NoticeFeed />);

    dismissNotice(RAIN_NOTICE.id);

    await expect.element(screen.getByText("Rain is coming.")).not.toBeInTheDocument();
    await expect.element(screen.getByText("The Wolf Clan is starving.")).toBeVisible();
  });

  it("dismisses each notice by itself after seven seconds", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    useWorldStore.setState({ notices: [RAIN_NOTICE] });

    const screen = await render(<NoticeFeed />);

    vi.advanceTimersByTime(NOTICE_MILLISECONDS - 100);

    expect(useWorldStore.getState().notices).toEqual([RAIN_NOTICE]);

    vi.advanceTimersByTime(100);

    expect(useWorldStore.getState().notices).toEqual([]);
    await expect.element(screen.getByText("Rain is coming.")).not.toBeInTheDocument();
  });
});

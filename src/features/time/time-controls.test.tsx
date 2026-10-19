import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { startTestEngine, stopTestEngine } from "../testing/engine-fixtures.ts";
import { resetWorld, showWorld } from "../testing/world-fixtures.ts";
import { useWorldStore } from "../world/world-store.ts";
import { TimeControls } from "./time-controls.tsx";

const SPEEDS = [1, 2, 4, 8, 16] as const;

describe("time controls", () => {
  afterEach(() => {
    resetWorld();
  });

  it("offers to resume a paused world without marking any speed", async () => {
    showWorld({ isPaused: true, speed: 2 });

    const screen = await render(<TimeControls />);

    await expect.element(screen.getByRole("button", { exact: true, name: "Resume" })).toBeVisible();

    await Promise.all(
      SPEEDS.map((speed) =>
        expect
          .element(screen.getByRole("button", { exact: true, name: `Speed ${speed} times` }))
          .toHaveAttribute("aria-pressed", "false")
      )
    );
  });

  it("offers to pause a running world and marks its speed", async () => {
    showWorld({ isPaused: false, speed: 2 });

    const screen = await render(<TimeControls />);

    await expect.element(screen.getByRole("button", { exact: true, name: "Pause" })).toBeVisible();
    await expect
      .element(screen.getByRole("button", { exact: true, name: "Speed 2 times" }))
      .toHaveAttribute("aria-pressed", "true");
    await expect
      .element(screen.getByRole("button", { exact: true, name: "Speed 4 times" }))
      .toHaveAttribute("aria-pressed", "false");
  });

  it("treats pausing as an action rather than a toggle", async () => {
    showWorld({ isPaused: true });

    const screen = await render(<TimeControls />);

    await expect
      .element(screen.getByRole("button", { exact: true, name: "Resume" }))
      .not.toHaveAttribute("aria-pressed");
  });

  it("leaves the world as it is while no game is running", async () => {
    const snapshot = showWorld({ isPaused: true, speed: 1 });

    const screen = await render(<TimeControls />);

    await screen.getByRole("button", { exact: true, name: "Resume" }).click();
    await screen.getByRole("button", { exact: true, name: "Speed 4 times" }).click();

    expect(useWorldStore.getState().snapshot).toBe(snapshot);
    await expect.element(screen.getByRole("button", { exact: true, name: "Resume" })).toBeVisible();
    await expect
      .element(screen.getByRole("button", { exact: true, name: "Speed 4 times" }))
      .toHaveAttribute("aria-pressed", "false");
  });
});

describe("time controls in a running game", () => {
  afterEach(() => {
    stopTestEngine();
    resetWorld();
  });

  it("resumes a paused world", async () => {
    const { send } = await startTestEngine();

    showWorld({ isPaused: true });

    const screen = await render(<TimeControls />);

    await screen.getByRole("button", { exact: true, name: "Resume" }).click();

    expect(send).toHaveBeenCalledExactlyOnceWith({ isPaused: false, type: "setPaused" });
  });

  it("pauses a running world", async () => {
    const { send } = await startTestEngine();

    showWorld({ isPaused: false });

    const screen = await render(<TimeControls />);

    await screen.getByRole("button", { exact: true, name: "Pause" }).click();

    expect(send).toHaveBeenCalledExactlyOnceWith({ isPaused: true, type: "setPaused" });
  });

  it("changes the speed and resumes a paused world", async () => {
    const { send } = await startTestEngine();

    showWorld({ isPaused: true, speed: 1 });

    const screen = await render(<TimeControls />);

    await screen.getByRole("button", { exact: true, name: "Speed 4 times" }).click();

    expect(send.mock.calls).toEqual([[{ speed: 4, type: "setSpeed" }], [{ isPaused: false, type: "setPaused" }]]);
  });

  it("changes the speed of a running world without touching the pause", async () => {
    const { send } = await startTestEngine();

    showWorld({ isPaused: false, speed: 1 });

    const screen = await render(<TimeControls />);

    await screen.getByRole("button", { exact: true, name: "Speed 8 times" }).click();

    expect(send).toHaveBeenCalledExactlyOnceWith({ speed: 8, type: "setSpeed" });
  });
});

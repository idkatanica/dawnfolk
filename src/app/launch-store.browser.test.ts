import { afterEach, describe, expect, it } from "vitest";
import { useLaunchStore } from "./launch-store.ts";

const initialState = useLaunchStore.getState();
const initialAddress = window.location.href;

describe("launch store", () => {
  afterEach(() => {
    useLaunchStore.setState(initialState, true);
    window.history.replaceState(null, "", initialAddress);
  });

  it("starts from the options in the address", () => {
    const { launch } = useLaunchStore.getState();

    expect(launch.seed).toBeGreaterThanOrEqual(1);
    expect(launch.camera).toEqual({});
  });

  it("relaunches with the changes and a fresh camera, time and pace", () => {
    useLaunchStore.setState({
      launch: { camera: { distance: 90 }, hours: 21, isPaused: true, quality: "low", seed: 7 },
    });

    useLaunchStore.getState().relaunch({ seed: 42 });

    expect(useLaunchStore.getState().launch).toEqual({
      camera: {},
      hours: null,
      isPaused: false,
      quality: "low",
      seed: 42,
    });
  });

  it("writes the seed and quality into the address so a reload keeps the world", () => {
    useLaunchStore.getState().relaunch({ quality: "high", seed: 42 });

    const parameters = new URLSearchParams(window.location.search);

    expect(parameters.get("seed")).toBe("42");
    expect(parameters.get("quality")).toBe("high");
  });
});

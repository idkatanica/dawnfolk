import { afterEach, describe, expect, it, vi } from "vitest";
import { LARGEST_SEED, randomSeed, readLaunchOptions } from "./launch-options.ts";
import { storeQuality } from "./preferences.ts";

const QUALITY_KEY = "dawnfolk.quality";

function silenceWarnings() {
  return vi.spyOn(console, "warn").mockImplementation(() => undefined);
}

describe("launch options", () => {
  afterEach(() => {
    localStorage.removeItem(QUALITY_KEY);
    vi.restoreAllMocks();
  });

  it("reads the seed, quality, time, pause and camera from the address", () => {
    const options = readLaunchOptions("?seed=7&quality=high&hours=10.5&paused=1&camera=-187,398,240,0.6,1.2");

    expect(options).toEqual({
      camera: { distance: 240, pitch: 0.6, targetX: -187, targetZ: 398, yaw: 1.2 },
      hours: 10.5,
      isPaused: true,
      quality: "high",
      seed: 7,
    });
  });

  it("keeps the island running unless it is paused explicitly", () => {
    expect(readLaunchOptions("?paused=0").isPaused).toBe(false);
    expect(readLaunchOptions("").isPaused).toBe(false);
  });

  it("fills in what the address leaves out", () => {
    const options = readLaunchOptions("");

    expect(options.camera).toEqual({});
    expect(options.hours).toBeNull();
    expect(options.quality).toBe("medium");
    expect(Number.isInteger(options.seed)).toBe(true);
    expect(options.seed).toBeGreaterThanOrEqual(1);
    expect(options.seed).toBeLessThanOrEqual(LARGEST_SEED);
  });

  it("uses the saved quality when the address names none", () => {
    storeQuality("low");

    expect(readLaunchOptions("?seed=7").quality).toBe("low");
  });

  it("prefers the quality in the address over the saved one", () => {
    storeQuality("low");

    expect(readLaunchOptions("?quality=high").quality).toBe("high");
  });

  it("keeps the valid parameters and warns about the invalid ones", () => {
    const warn = silenceWarnings();

    const options = readLaunchOptions("?seed=island&quality=high&hours=10");

    expect(warn).toHaveBeenCalledExactlyOnceWith("Ignoring invalid launch parameters", expect.any(Array));
    expect(options.quality).toBe("high");
    expect(options.hours).toBe(10);
    expect(options.seed).toBeGreaterThanOrEqual(1);
  });

  it("rejects seeds and hours outside their ranges", () => {
    const warn = silenceWarnings();

    readLaunchOptions(`?seed=${LARGEST_SEED + 1}`);
    readLaunchOptions("?seed=0");
    readLaunchOptions("?hours=25");

    expect(warn).toHaveBeenCalledTimes(3);
  });

  it("rejects a camera without five numbers or with a distance that is not positive", () => {
    const warn = silenceWarnings();

    const shortCamera = readLaunchOptions("?camera=1,2,30");
    const flatCamera = readLaunchOptions("?camera=1,2,0,0.5,0.5");

    expect(warn).toHaveBeenCalledTimes(2);
    expect(shortCamera.camera).toEqual({});
    expect(flatCamera.camera).toEqual({});
  });
});

describe("random seeds", () => {
  it("stay whole numbers within the allowed range", () => {
    const seeds = Array.from({ length: 200 }, () => randomSeed());

    expect(seeds.every((seed) => Number.isInteger(seed))).toBe(true);
    expect(Math.min(...seeds)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...seeds)).toBeLessThanOrEqual(LARGEST_SEED);
  });
});

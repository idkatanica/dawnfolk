import { describe, expect, it } from "vitest";
import { fogShapeFor } from "./height-fog.ts";

const CLEAR_NOON = { mist: 0, precipitation: 0, snowfall: 0, sunHeight: 0.9 };

describe("fog shape", () => {
  it("keeps a clear noon almost transparent", () => {
    const shape = fogShapeFor(CLEAR_NOON);

    expect(shape.density).toBeCloseTo(0.000_05, 7);
    expect(shape.falloff).toBeCloseTo(1 / 700, 7);
  });

  it("adds haze while the sun stays low", () => {
    const noon = fogShapeFor(CLEAR_NOON);
    const morning = fogShapeFor({ ...CLEAR_NOON, sunHeight: 0.1 });

    expect(morning.density).toBeGreaterThan(noon.density);
  });

  it("leaves the night sky free of the low sun haze", () => {
    const night = fogShapeFor({ ...CLEAR_NOON, sunHeight: -0.5 });

    expect(night.density).toBeCloseTo(0.000_05, 7);
  });

  it("thickens and lowers the layer in mist", () => {
    const clear = fogShapeFor(CLEAR_NOON);
    const misty = fogShapeFor({ ...CLEAR_NOON, mist: 1 });

    expect(misty.density).toBeGreaterThan(clear.density * 20);
    expect(misty.falloff).toBeGreaterThan(clear.falloff);
  });

  it("thickens in rain", () => {
    const clear = fogShapeFor(CLEAR_NOON);
    const rainy = fogShapeFor({ ...CLEAR_NOON, precipitation: 1 });

    expect(rainy.density).toBeGreaterThan(clear.density);
    expect(rainy.veil).toBeGreaterThan(clear.veil);
  });

  it("hangs a thicker veil in snowfall than in rain", () => {
    const rainy = fogShapeFor({ ...CLEAR_NOON, precipitation: 1 });
    const snowy = fogShapeFor({ ...CLEAR_NOON, precipitation: 1, snowfall: 1 });

    expect(snowy.veil).toBeGreaterThan(rainy.veil);
  });
});

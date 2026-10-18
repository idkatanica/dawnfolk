import { describe, expect, it } from "vitest";
import {
  clamp,
  distanceToPolyline,
  fractionalPart,
  hashToUnit,
  inverseLerp,
  lerp,
  smoothstep,
  wrapAngle,
} from "./math.ts";

describe("math helpers", () => {
  it("clamps into the range", () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
    expect(clamp(3, 0, 1)).toBe(1);
  });

  it("interpolates and inverts interpolation", () => {
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(inverseLerp(10, 20, 12.5)).toBe(0.25);
    expect(inverseLerp(4, 4, 4)).toBe(0);
  });

  it("eases between edges", () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  it("wraps angles into minus pi to pi", () => {
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(-Math.PI);
    expect(wrapAngle(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
  });

  it("hashes coordinates into the unit range deterministically", () => {
    const value = hashToUnit(12, 34, 5);

    expect(value).toBe(hashToUnit(12, 34, 5));
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
    expect(fractionalPart(-0.25)).toBe(0.75);
  });

  it("measures the distance to a polyline", () => {
    const line: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
    ];

    expect(distanceToPolyline(5, 3, line)).toBe(3);
    expect(distanceToPolyline(14, 5, line)).toBe(4);
  });
});

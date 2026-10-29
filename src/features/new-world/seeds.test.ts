import { describe, expect, it } from "vitest";
import { LARGEST_SEED, randomSeed } from "./seeds.ts";

describe("seeds", () => {
  it("draws whole numbers within the allowed range", () => {
    const seeds = Array.from({ length: 200 }, () => {
      return randomSeed();
    });

    expect(
      seeds.every((seed) => {
        return Number.isInteger(seed);
      })
    ).toBe(true);
    expect(Math.min(...seeds)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...seeds)).toBeLessThanOrEqual(LARGEST_SEED);
  });
});

import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_RULES, readWorldRules } from "./world-rules.ts";

describe("world rules", () => {
  it("default every rule to neutral", () => {
    expect(DEFAULT_WORLD_RULES.fire.spreadSpeed).toBe(1);
    expect(DEFAULT_WORLD_RULES.storms.lightningIgnition).toBe(75);
  });

  it("fill missing groups with defaults", () => {
    expect(readWorldRules({ fire: { spreadSpeed: 2 } }).fire.spreadSpeed).toBe(2);
    expect(readWorldRules({ fire: { spreadSpeed: 2 } }).water.rainStrength).toBe(1);
  });

  it("reject broken rules", () => {
    expect(readWorldRules({ fire: { spreadSpeed: "fast" } })).toEqual(DEFAULT_WORLD_RULES);
  });
});

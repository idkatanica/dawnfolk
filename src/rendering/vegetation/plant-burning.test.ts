import { describe, expect, it } from "vitest";
import { remainingCrown } from "./plant-burning.ts";

describe("plant burning", () => {
  it("keeps the whole crown while the fire is fresh", () => {
    expect(remainingCrown(0.5, 0.3)).toBe(1);
  });

  it("thins the crown as the cell burns down", () => {
    const early = remainingCrown(0.4, 0.65);
    const late = remainingCrown(0.4, 0.9);

    expect(early).toBeGreaterThan(late);
    expect(late).toBeGreaterThan(0);
  });

  it("leaves no crown once the cell is scorched or the fire is out", () => {
    expect(remainingCrown(0.4, 1)).toBe(0);
    expect(remainingCrown(0, 0.7)).toBe(0);
  });
});

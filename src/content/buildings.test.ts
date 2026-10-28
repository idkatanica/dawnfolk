import { describe, expect, it } from "vitest";
import { BUILDINGS } from "./buildings.ts";

describe("buildings", () => {
  it("take some work to build", () => {
    for (const building of Object.values(BUILDINGS)) {
      expect(building.work).toBeGreaterThan(0);
    }
  });
});

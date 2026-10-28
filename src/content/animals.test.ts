import { describe, expect, it } from "vitest";
import { ANIMALS } from "./animals.ts";

describe("animals", () => {
  it("run faster than they walk", () => {
    for (const animal of Object.values(ANIMALS)) {
      expect(animal.runSpeed).toBeGreaterThan(animal.walkSpeed);
    }
  });
});

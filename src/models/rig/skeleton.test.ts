import { describe, expect, it } from "vitest";
import { createSkeleton, NO_PARENT } from "./skeleton.ts";

describe("skeleton definitions", () => {
  it("refuses bones listed before their parents", () => {
    expect(() => {
      return createSkeleton({
        bodyContacts: [],
        bones: [
          { joint: [0, 0, 0], name: "root", parent: NO_PARENT },
          { joint: [0, 1, 0], name: "loop", parent: 1 },
        ],
        footContacts: [],
      });
    }).toThrow(RangeError);
  });
});

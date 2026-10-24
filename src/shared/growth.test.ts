import { describe, expect, it } from "vitest";
import { grownIndexArray } from "./growth.ts";

describe("grown index arrays", () => {
  it("keeps an array that is already large enough", () => {
    const indices = new Int32Array([4, 5, 6]);

    expect(grownIndexArray(indices, 3, -1)).toBe(indices);
  });

  it("grows by half again and fills new slots with the sentinel", () => {
    const grown = grownIndexArray(new Int32Array([4, 5, 6, 7]), 5, -1);

    expect([...grown]).toEqual([4, 5, 6, 7, -1, -1]);
  });

  it("grows straight to a size beyond the usual step", () => {
    expect(grownIndexArray(new Int32Array([1]), 4, -1)).toHaveLength(4);
  });
});

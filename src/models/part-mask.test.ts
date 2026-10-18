import { describe, expect, it } from "vitest";
import { EMPTY_PART_MASK, hasPart, MAXIMUM_PARTS, maskOf, withPart } from "./part-mask.ts";

describe("part masks", () => {
  it("records parts in both words", () => {
    const mask = maskOf([0, 5, 23, 24, 40]);

    for (const part of [0, 5, 23, 24, 40]) {
      expect(hasPart(mask, part)).toBe(true);
    }

    for (const part of [1, 22, 25, 47]) {
      expect(hasPart(mask, part)).toBe(false);
    }
  });

  it("adds a part only once", () => {
    const once = withPart(EMPTY_PART_MASK, 7);

    expect(withPart(once, 7)).toEqual(once);
    expect(once).toEqual([128, 0]);
  });

  it("keeps every word exact in a 32-bit float", () => {
    const full = maskOf(Array.from({ length: MAXIMUM_PARTS }, (_, part) => part));

    expect(Math.fround(full[0])).toBe(full[0]);
    expect(Math.fround(full[1])).toBe(full[1]);
  });

  it("refuses parts that do not fit", () => {
    expect(() => withPart(EMPTY_PART_MASK, MAXIMUM_PARTS)).toThrow(RangeError);
    expect(() => withPart(EMPTY_PART_MASK, -1)).toThrow(RangeError);
  });
});

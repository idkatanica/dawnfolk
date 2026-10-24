import { describe, expect, it } from "vitest";
import { MaterialSlot } from "../../models/materials.ts";
import { colorIndexBySlot, colorTexel, paletteWidth, rootTexel, TEXELS_PER_BONE } from "./palette-layout.ts";

const LAYOUT = { boneCount: 4, colorSlots: [MaterialSlot.Skin, MaterialSlot.Hair] };

describe("palette layout", () => {
  it("places the root right after the bone matrices", () => {
    expect(rootTexel(LAYOUT)).toBe(4 * TEXELS_PER_BONE);
  });

  it("places the colors after the root", () => {
    expect(colorTexel(LAYOUT, 0)).toBe(rootTexel(LAYOUT) + 1);
    expect(colorTexel(LAYOUT, 1)).toBe(rootTexel(LAYOUT) + 2);
  });

  it("is wide enough for every texel", () => {
    expect(paletteWidth(LAYOUT)).toBe(colorTexel(LAYOUT, 1) + 1);
  });

  it("maps each palette slot to its color and every other slot to none", () => {
    const indices = colorIndexBySlot(LAYOUT, 56);

    expect(indices[MaterialSlot.Skin]).toBe(0);
    expect(indices[MaterialSlot.Hair]).toBe(1);
    expect(indices.filter((index) => index >= 0)).toHaveLength(2);
    expect(indices).toHaveLength(56);
  });
});

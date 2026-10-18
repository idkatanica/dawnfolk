import { describe, expect, it } from "vitest";
import {
  colorChannels,
  colorFromPalette,
  mixColors,
  packColor,
  parseHexColor,
  scaleColor,
  toHexString,
} from "./color.ts";

describe("colors", () => {
  it("reads and writes #rrggbb text", () => {
    expect(parseHexColor("#c8553d")).toBe(0xc8_55_3d);
    expect(toHexString(0x0a_0b_0c)).toBe("#0a0b0c");
    expect(() => parseHexColor("red")).toThrow(RangeError);
  });

  it("splits and packs channels without losing precision", () => {
    expect(colorChannels(0xff_80_00)).toEqual([1, 128 / 255, 0]);
    expect(packColor(...colorChannels(0x12_34_56))).toBe(0x12_34_56);
  });

  it("mixes, scales and samples palettes", () => {
    expect(mixColors(0x00_00_00, 0xff_ff_ff, 0.5)).toBe(0x80_80_80);
    expect(scaleColor(0x40_40_40, 2)).toBe(0x80_80_80);
    expect(scaleColor(0xc0_c0_c0, 2)).toBe(0xff_ff_ff);
    expect(colorFromPalette([0x00_00_00, 0xff_ff_ff], 0)).toBe(0);
    expect(colorFromPalette([0x00_00_00, 0x00_00_ff, 0xff_00_00], 0.75)).toBe(mixColors(0x00_00_ff, 0xff_00_00, 0.5));
  });
});

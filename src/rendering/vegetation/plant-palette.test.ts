import { describe, expect, it } from "vitest";
import { PlantSpecies } from "../../content/plants.ts";
import { colorChannels } from "../../shared/color.ts";
import { foliageLook } from "./plant-palette.ts";

const SUMMER = 1.5;
const AUTUMN = 2.45;
const WINTER = 3.5;

describe("foliage looks", () => {
  it("leaves deciduous trees bare in winter and full in summer", () => {
    expect(foliageLook(PlantSpecies.Oak, WINTER).coverage).toBe(0);
    expect(foliageLook(PlantSpecies.Oak, SUMMER).coverage).toBe(1);
  });

  it("greets the first spring morning with leaves coming out", () => {
    expect(foliageLook(PlantSpecies.Birch, 0.1).coverage).toBeGreaterThan(0.5);
  });

  it("buds only at the very end of winter", () => {
    expect(foliageLook(PlantSpecies.Maple, 3.7).coverage).toBe(0);
    expect(foliageLook(PlantSpecies.Maple, 3.95).coverage).toBeGreaterThan(0);
  });

  it("keeps conifers covered all year", () => {
    for (let season = 0; season < 4; season += 0.1) {
      expect(foliageLook(PlantSpecies.Spruce, season).coverage).toBe(1);
    }
  });

  it("turns maples red in autumn", () => {
    const [red, green] = colorChannels(foliageLook(PlantSpecies.Maple, AUTUMN).color);

    expect(red).toBeGreaterThan(green);
  });

  it("wraps around the end of the year", () => {
    const endOfYear = foliageLook(PlantSpecies.Birch, 3.999);
    const startOfYear = foliageLook(PlantSpecies.Birch, 4.001);

    expect(endOfYear.coverage).toBeCloseTo(startOfYear.coverage, 2);
  });
});

import { describe, expect, it } from "vitest";
import { CultivatedSpecies } from "../../content/cultivated-plants.ts";
import { colorChannels } from "../../shared/color.ts";
import { foliageLook } from "./plant-palette.ts";

const BLOSSOM = 0.3;
const SUMMER = 1.5;
const AUTUMN = 2.5;
const WINTER = 3.5;

const FRUIT_TREES = [CultivatedSpecies.AppleTree, CultivatedSpecies.PearTree, CultivatedSpecies.PlumTree];
const BERRY_BUSHES = [CultivatedSpecies.Raspberry, CultivatedSpecies.Blueberry, CultivatedSpecies.Currant];

describe("orchard foliage", () => {
  it.each(FRUIT_TREES)("covers fruit tree %i in pale blossom in spring and green leaves in summer", (species) => {
    const blossom = foliageLook(species, BLOSSOM);
    const [red, green, blue] = colorChannels(blossom.color);
    const [summerRed, summerGreen, summerBlue] = colorChannels(foliageLook(species, SUMMER).color);

    expect(blossom.coverage).toBeGreaterThan(0.9);
    expect(Math.min(red, green, blue)).toBeGreaterThan(0.8);
    expect(summerGreen).toBeGreaterThan(Math.max(summerRed, summerBlue));
  });

  it.each([...FRUIT_TREES, ...BERRY_BUSHES])("leaves species %i bare in winter", (species) => {
    expect(foliageLook(species, WINTER).coverage).toBe(0);
  });

  it("turns blueberries red in autumn", () => {
    const [red, green] = colorChannels(foliageLook(CultivatedSpecies.Blueberry, AUTUMN).color);

    expect(red).toBeGreaterThan(green * 2);
  });
});

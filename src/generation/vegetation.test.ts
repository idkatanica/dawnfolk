import { describe, expect, it } from "vitest";
import { plantSpeciesDefinition } from "../content/plants.ts";
import { ISLAND_SHAPES } from "../world/island-shape.ts";
import { isWaterCell } from "../world/terrain-sampling.ts";
import { PlantState } from "../world/vegetation-store.ts";
import { generateWorld } from "./world-generator.ts";

const DIMENSIONS = { cellSize: 10, cellsPerSide: 256 };
const SEEDS = [3, 7, 11];
const STONE_FORMS: ReadonlySet<string> = new Set(["monument", "stone"]);

describe("first vegetation", () => {
  it.each(SEEDS)("keeps every rock and stone of seed %i off water on both shapes", (seed) => {
    for (const shape of ISLAND_SHAPES) {
      const { terrain, vegetation } = generateWorld(seed, { dimensions: DIMENSIONS, erosionStrength: 1, shape });

      const wetStones: string[] = [];
      let stones = 0;

      for (let plant = 0; plant < vegetation.count; plant += 1) {
        const { form, name } = plantSpeciesDefinition(vegetation.species[plant]);

        if (vegetation.state[plant] !== PlantState.Alive || !STONE_FORMS.has(form)) {
          continue;
        }

        stones += 1;

        if (isWaterCell(terrain, vegetation.cell[plant])) {
          wetStones.push(`${name} at ${vegetation.x[plant].toFixed(0)}, ${vegetation.z[plant].toFixed(0)}`);
        }
      }

      expect(stones).toBeGreaterThan(100);
      expect(wetStones).toEqual([]);
    }
  });
});

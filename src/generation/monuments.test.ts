import { beforeAll, describe, expect, it } from "vitest";
import { MONUMENT_SLOPE, MONUMENTS } from "../content/monuments.ts";
import { isMonumentSpecies, plantSpeciesDefinition } from "../content/plants.ts";
import { canStandOn } from "../world/footing.ts";
import type { IslandShapeKind } from "../world/island-shape.ts";
import { isWaterCell } from "../world/terrain-sampling.ts";
import { WorldGrid } from "../world/world-grid.ts";
import { cellMask, type GeneratedWorld, generateWorld } from "./world-generator.ts";

const TEST_DIMENSIONS = { cellSize: 40, cellsPerSide: 128 };
const DRY_REACH = 30;

const worlds = new Map<IslandShapeKind, GeneratedWorld>();

function generate(seed: number, shape: IslandShapeKind): GeneratedWorld {
  return generateWorld(seed, { dimensions: TEST_DIMENSIONS, erosionStrength: 1, shape });
}

function worldOf(shape: IslandShapeKind): GeneratedWorld {
  const generated = worlds.get(shape);

  if (generated === undefined) {
    throw new Error(`No ${shape} world was generated`);
  }

  return generated;
}

beforeAll(() => {
  worlds.set("round", generate(7, "round"));
  worlds.set("square", generate(3, "square"));
});

describe.each(["round", "square"] as const)("monuments on a %s island", (shape) => {
  it("raises a handful of them, of several kinds", () => {
    const { monuments } = worldOf(shape);

    expect(monuments.length).toBeGreaterThanOrEqual(4);
    expect(monuments.length).toBeLessThanOrEqual(8);
    expect(new Set(monuments.map((monument) => monument.kind)).size).toBeGreaterThanOrEqual(4);
  });

  it("sets them on dry, level ground away from water and the coast", () => {
    const { monuments, terrain } = worldOf(shape);

    const grid = new WorldGrid(TEST_DIMENSIONS);

    for (const monument of monuments) {
      const cells = [...monument.cells, ...grid.cellsInRadius(monument.x, monument.z, DRY_REACH)];

      expect(
        monument.cells.every((cell) => canStandOn(terrain, grid, cell, MONUMENT_SLOPE)),
        monument.name
      ).toBe(true);
      expect(
        cells.some((cell) => isWaterCell(terrain, cell)),
        monument.name
      ).toBe(false);
    }
  });

  it("gives each a name of its kind, and no name twice", () => {
    const { monuments } = worldOf(shape);

    const names = monuments.map((monument) => monument.name);

    expect(new Set(names).size).toBe(names.length);

    for (const monument of monuments) {
      expect(MONUMENTS[monument.kind].names).toContain(monument.name);
    }
  });

  it("grows nothing on monument ground but the monument itself", () => {
    const { monuments, vegetation } = worldOf(shape);

    const grid = new WorldGrid(TEST_DIMENSIONS);
    const ground = cellMask(grid.cellCount, monuments);

    let stones = 0;

    for (let plant = 0; plant < vegetation.count; plant += 1) {
      const cell = grid.cellAt(vegetation.x[plant], vegetation.z[plant]);
      const isMonument = isMonumentSpecies(vegetation.species[plant]);

      expect(ground[cell] === 1, plantSpeciesDefinition(vegetation.species[plant]).name).toBe(isMonument);

      stones += isMonument ? 1 : 0;
    }

    expect(stones).toBeGreaterThanOrEqual(monuments.length);
  });
});

import { describe, expect, it } from "vitest";
import { DEPOSIT_KINDS, DEPOSITS } from "../content/deposits.ts";
import { isTreeSpecies } from "../content/plants.ts";
import { slopeAt } from "../world/footing.ts";
import { isWaterCell } from "../world/terrain-sampling.ts";
import { WorldGrid } from "../world/world-grid.ts";
import { generateWorld } from "./world-generator.ts";

const DIMENSIONS = { cellSize: 10, cellsPerSide: 384 };

function generate(seed: number) {
  return generateWorld(seed, { dimensions: DIMENSIONS, erosionStrength: 1, shape: "round" });
}

describe("ore and clay deposits", () => {
  const world = generate(7);
  const grid = new WorldGrid(DIMENSIONS);

  it("are placed the same way for a seed", () => {
    const again = generate(7);

    expect(again.deposits).toEqual(world.deposits);
  });

  it("differ between seeds", () => {
    expect(generate(11).deposits).not.toEqual(world.deposits);
  });

  it("include every kind of ore and clay", () => {
    const kinds = new Set(world.deposits.map((deposit) => deposit.kind));

    expect([...kinds].sort()).toEqual([...DEPOSIT_KINDS].sort());
  });

  it("tint their veins on dry land with the ground of their ore", () => {
    for (const deposit of world.deposits) {
      expect(deposit.cells.length).toBeGreaterThan(3);

      for (const cell of deposit.cells) {
        expect(world.terrain.ground[cell]).toBe(DEPOSITS[deposit.kind].ground);
        expect(isWaterCell(world.terrain, cell)).toBe(false);
      }
    }
  });

  it("put ore veins on hillsides and clay on gentle ground", () => {
    for (const deposit of world.deposits) {
      const slopes = deposit.cells.map((cell) => slopeAt(world.terrain.height, grid, cell));

      if (deposit.kind === "clay") {
        expect(Math.max(...slopes)).toBeLessThanOrEqual(0.25);
      } else {
        expect(Math.max(...slopes)).toBeLessThanOrEqual(0.72);
      }
    }
  });

  it("leave no trees standing on the veins", () => {
    const veins = new Set(world.deposits.flatMap((deposit) => deposit.cells));
    const { vegetation } = world;

    for (let plant = 0; plant < vegetation.count; plant += 1) {
      const cell = grid.cellAt(vegetation.x[plant], vegetation.z[plant]);

      if (vegetation.isAlive(plant) && isTreeSpecies(vegetation.species[plant])) {
        expect(veins.has(cell)).toBe(false);
      }
    }
  });
});

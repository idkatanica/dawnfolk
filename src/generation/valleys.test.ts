import { describe, expect, it } from "vitest";
import { WorldGrid } from "../world/world-grid.ts";
import { analyzeDrainage } from "./hydrology.ts";
import { carveValleys } from "./valleys.ts";

function shapeTerrain(grid: WorldGrid, heightAt: (x: number, z: number) => number): Float32Array {
  return Float32Array.from({ length: grid.cellCount }, (_, cell) =>
    heightAt(grid.cellCenterX(cell), grid.cellCenterZ(cell))
  );
}

function trough(x: number, z: number): number {
  return 100 + 0.03 * z + 0.08 * Math.abs(x);
}

function troughWithBasin(x: number, z: number): number {
  return trough(x, z) - 14 * Math.exp(-(x * x + z * z) / (2 * 110 * 110));
}

function lakeLevels(heights: Float32Array, grid: WorldGrid): number[] {
  return analyzeDrainage(heights, grid, new Float32Array(grid.cellCount)).lakes.map((lake) => lake.level);
}

describe("river valleys", () => {
  const grid = new WorldGrid({ cellSize: 10, cellsPerSide: 96 });
  const original = shapeTerrain(grid, trough);
  const carved = Float32Array.from(original);

  carveValleys(carved, grid, new Float32Array(grid.cellCount));

  it("sinks big rivers well below their banks", () => {
    const river = grid.cellAt(-5, -440);
    const bank = grid.cellAt(-65, -440);

    expect(original[river] - carved[river]).toBeGreaterThan(5);
    expect(carved[bank] - carved[river]).toBeGreaterThan(original[bank] - original[river] + 5);
  });

  it("rises from the river to the untouched land", () => {
    const profile = [-5, -25, -45, -65, -85, -150].map((x) => carved[grid.cellAt(x, -400)]);

    for (let step = 1; step < profile.length; step += 1) {
      expect(profile[step]).toBeGreaterThanOrEqual(profile[step - 1]);
    }

    expect(carved[grid.cellAt(-300, -400)]).toBe(original[grid.cellAt(-300, -400)]);
  });

  it("keeps the level of lakes the rivers run through", () => {
    const lakeGrid = new WorldGrid({ cellSize: 10, cellsPerSide: 128 });
    const basin = shapeTerrain(lakeGrid, troughWithBasin);

    const levelsBefore = lakeLevels(basin, lakeGrid);

    carveValleys(basin, lakeGrid, new Float32Array(lakeGrid.cellCount));

    expect(levelsBefore.length).toBeGreaterThan(0);
    expect(lakeLevels(basin, lakeGrid)).toEqual(levelsBefore);
  });
});

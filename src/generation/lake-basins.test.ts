import { describe, expect, it } from "vitest";
import { createRandom } from "../shared/random.ts";
import { landEverywhere } from "../world/testing/terrain-fixtures.ts";
import { WorldGrid } from "../world/world-grid.ts";
import { analyzeDrainage } from "./hydrology.ts";
import { digRiverLakes, fillSinks, type LakeSiting } from "./lake-basins.ts";

const grid = new WorldGrid({ cellSize: 10, cellsPerSide: 192 });
const dryness = new Float32Array(grid.cellCount);
const coastDistance = landEverywhere(grid.cellCount);

function gentleValley(): Float32Array {
  return Float32Array.from(
    { length: grid.cellCount },
    (_, cell) => 200 - 0.03 * grid.cellCenterZ(cell) + 0.12 * Math.abs(grid.cellCenterX(cell))
  );
}

function shapeTerrain(heightAt: (x: number, z: number) => number): Float32Array {
  return Float32Array.from({ length: grid.cellCount }, (_, cell) =>
    heightAt(grid.cellCenterX(cell), grid.cellCenterZ(cell))
  );
}

function slopeWithBasin(x: number, z: number): number {
  return 100 + 0.03 * z + 0.08 * Math.abs(x) - 14 * Math.exp(-(x * x + z * z) / (2 * 110 * 110));
}

function boundaryDistance(cell: number): number {
  return 1 - Math.max(Math.abs(grid.cellCenterX(cell)), Math.abs(grid.cellCenterZ(cell))) / grid.halfSize;
}

function siting(seed: number): LakeSiting {
  return { boundaryDistance, coastDistance, dryness, grid, random: createRandom(seed) };
}

describe("river lakes", () => {
  it("dams a fed river into a lake away from the island rim", () => {
    const heights = gentleValley();

    expect(analyzeDrainage(heights, grid, dryness, coastDistance).lakes).toHaveLength(0);

    digRiverLakes(heights, siting(3));

    const { lakes } = analyzeDrainage(heights, grid, dryness, coastDistance);

    expect(lakes.length).toBeGreaterThan(0);

    for (const lake of lakes) {
      expect(boundaryDistance(grid.cellAt(lake.centerX, lake.centerZ))).toBeGreaterThan(0.15);
    }
  });

  it("digs the same lakes for the same seed", () => {
    const first = gentleValley();
    const second = gentleValley();

    digRiverLakes(first, siting(3));
    digRiverLakes(second, siting(3));

    expect(second).toEqual(first);
  });
});

describe("sink filling", () => {
  it("fills pits too small to hold a lake", () => {
    const heights = shapeTerrain((x, z) => 100 + 0.02 * z + 0.01 * x);

    heights[grid.cellAt(5, 5)] -= 3;
    fillSinks(heights, grid, dryness, coastDistance);

    const { network } = analyzeDrainage(heights, grid, dryness, coastDistance);

    expect(network.filled.every((level, cell) => level - heights[cell] < 0.01)).toBe(true);
  });

  it("leaves lake basins to fill with water", () => {
    const heights = shapeTerrain(slopeWithBasin);
    const center = grid.cellAt(5, 5);

    const bottom = heights[center];

    fillSinks(heights, grid, dryness, coastDistance);

    expect(heights[center]).toBe(bottom);
    expect(analyzeDrainage(heights, grid, dryness, coastDistance).lakes.length).toBeGreaterThan(0);
  });
});

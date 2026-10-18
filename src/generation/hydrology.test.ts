import { describe, expect, it } from "vitest";
import { landEverywhere } from "../world/coast.ts";
import { hasWater } from "../world/water.ts";
import { WorldGrid } from "../world/world-grid.ts";
import { computeHydrology, DEFAULT_HYDROLOGY } from "./hydrology.ts";

const VALLEY_FLOOR_HALF_WIDTH = 10;

function createSteepValley(grid: WorldGrid): Float32Array {
  const heights = new Float32Array(grid.cellCount);

  for (let cell = 0; cell < grid.cellCount; cell += 1) {
    const x = grid.cellCenterX(cell);
    const z = grid.cellCenterZ(cell);

    heights[cell] = 100 + Math.abs(x) * 2 + (z + grid.halfSize) * 0.05;
  }

  return heights;
}

describe("river carving", () => {
  it("cuts a channel without notching the valley walls", () => {
    const grid = new WorldGrid({ cellSize: 10, cellsPerSide: 64 });

    const uncarved = createSteepValley(grid);

    const carved = Float32Array.from(uncarved);
    const options = { ...DEFAULT_HYDROLOGY, riverCatchmentArea: 30_000 };

    const result = computeHydrology(
      carved,
      grid,
      new Float32Array(grid.cellCount),
      landEverywhere(grid.cellCount),
      options
    );

    let deepestWallCut = 0;
    let wetFloorCells = 0;

    for (let cell = 0; cell < grid.cellCount; cell += 1) {
      const isWall = Math.abs(grid.cellCenterX(cell)) > VALLEY_FLOOR_HALF_WIDTH;

      if (isWall) {
        deepestWallCut = Math.max(deepestWallCut, uncarved[cell] - carved[cell]);
      }

      if (!isWall && hasWater(result.waterSurface[cell], carved[cell])) {
        wetFloorCells += 1;
      }
    }

    expect(result.features.rivers.length).toBeGreaterThan(0);
    expect(wetFloorCells).toBeGreaterThan(10);
    expect(deepestWallCut).toBeLessThan(4);
  });
});

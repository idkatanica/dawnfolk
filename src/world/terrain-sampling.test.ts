import { describe, expect, it } from "vitest";
import { isWaterAtPoint, isWaterCell, type SampledTerrain, sampleHeight, sampleSurface } from "./terrain-sampling.ts";
import { NO_WATER } from "./water.ts";
import { WorldGrid } from "./world-grid.ts";

const grid = new WorldGrid({ cellSize: 10, cellsPerSide: 4 });

function createSlopedTerrain(): SampledTerrain {
  const height = new Float32Array(grid.cellCount);

  for (let cell = 0; cell < grid.cellCount; cell += 1) {
    height[cell] = grid.columnOf(cell) * 10 + grid.rowOf(cell);
  }

  return { height, waterSurface: new Float32Array(grid.cellCount).fill(NO_WATER) };
}

describe("height sampling", () => {
  it("returns the cell height at a cell center", () => {
    const terrain = createSlopedTerrain();

    expect(sampleHeight(terrain.height, grid, grid.centerX(2), grid.centerZ(1))).toBeCloseTo(21);
  });

  it("blends neighboring cells between their centers", () => {
    const terrain = createSlopedTerrain();

    const between = sampleHeight(terrain.height, grid, grid.centerX(1) + 5, grid.centerZ(1) + 5);

    expect(between).toBeCloseTo(16.5);
  });

  it("holds the edge height beyond the world", () => {
    const terrain = createSlopedTerrain();

    expect(sampleHeight(terrain.height, grid, -1000, grid.centerZ(0))).toBeCloseTo(0);
    expect(sampleHeight(terrain.height, grid, 1000, grid.centerZ(0))).toBeCloseTo(30, 0);
  });
});

describe("water sampling", () => {
  it("reports the water surface above flooded ground", () => {
    const terrain = createSlopedTerrain();
    const cell = grid.index(1, 1);

    terrain.waterSurface[cell] = 20;

    expect(isWaterCell(terrain, cell)).toBe(true);
    expect(isWaterAtPoint(terrain, grid, grid.centerX(1), grid.centerZ(1))).toBe(true);
    expect(sampleSurface(terrain, grid, grid.centerX(1), grid.centerZ(1))).toBe(20);
  });

  it("reports the ground where the water lies below it or is missing", () => {
    const terrain = createSlopedTerrain();
    const cell = grid.index(2, 2);

    terrain.waterSurface[cell] = 5;

    expect(isWaterCell(terrain, cell)).toBe(false);
    expect(sampleSurface(terrain, grid, grid.centerX(2), grid.centerZ(2))).toBeCloseTo(22);
    expect(sampleSurface(terrain, grid, grid.centerX(1), grid.centerZ(2))).toBeCloseTo(12);
  });

  it("finds no water outside the world", () => {
    const terrain = createSlopedTerrain();

    terrain.waterSurface.fill(100);

    expect(isWaterAtPoint(terrain, grid, grid.halfSize + 1, 0)).toBe(false);
    expect(sampleSurface(terrain, grid, grid.halfSize + 1, 0)).toBeLessThan(100);
  });
});

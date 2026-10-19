import { describe, expect, it } from "vitest";
import { landEverywhere } from "../world/coast.ts";
import { hasWater } from "../world/water.ts";
import { NEIGHBOR_OFFSETS, WorldGrid } from "../world/world-grid.ts";
import { computeHydrology, DEFAULT_HYDROLOGY } from "./hydrology.ts";

const VALLEY_FLOOR_HALF_WIDTH = 10;
const GENTLE_WALLS = 0.6;
const STEEP_WALLS = 2;
const BANK_FREEBOARD = 0.2;
const DEEPEST_BANK_LOWERING = 10;
const UNTOUCHED_DISTANCE = 120;
const RIDGE_HEIGHT = 10;
const RIDGE_SPREAD = 2 * 30 * 30;

function carveValley(wallSlope: number, ridgeHeight = 0) {
  const grid = new WorldGrid({ cellSize: 10, cellsPerSide: 64 });

  const uncarved = Float32Array.from({ length: grid.cellCount }, (_, cell) => {
    const x = grid.cellCenterX(cell);
    const z = grid.cellCenterZ(cell);

    return 100 + Math.abs(x) * wallSlope + (z + grid.halfSize) * 0.05 + ridgeHeight * Math.exp(-(z * z) / RIDGE_SPREAD);
  });

  const carved = Float32Array.from(uncarved);
  const options = { ...DEFAULT_HYDROLOGY, riverCatchmentArea: 30_000 };

  const result = computeHydrology(
    carved,
    grid,
    new Float32Array(grid.cellCount),
    landEverywhere(grid.cellCount),
    options
  );

  return { carved, grid, result, uncarved };
}

interface CarvedWater {
  readonly carved: Float32Array;
  readonly riverStrength: Uint8Array;
  readonly waterSurface: Float32Array;
}

function riverLevelBeside(grid: WorldGrid, cell: number, water: CarvedWater): number {
  const { carved, riverStrength, waterSurface } = water;

  let total = 0;
  let count = 0;

  for (const offset of NEIGHBOR_OFFSETS) {
    const column = grid.columnOf(cell) + offset.column;
    const row = grid.rowOf(cell) + offset.row;

    if (!grid.contains(column, row)) {
      continue;
    }

    const neighbor = grid.index(column, row);

    if (!hasWater(waterSurface[neighbor], carved[neighbor])) {
      continue;
    }

    if (riverStrength[neighbor] === 0) {
      return Number.NaN;
    }

    total += waterSurface[neighbor];
    count += 1;
  }

  return count > 0 ? total / count : Number.NaN;
}

describe("river carving", () => {
  it("cuts a channel and lowers the banks beside it to just above the water level there", () => {
    const { carved, grid, result } = carveValley(GENTLE_WALLS);

    const rises: number[] = [];
    let wetFloorCells = 0;

    for (let cell = 0; cell < grid.cellCount; cell += 1) {
      if (hasWater(result.waterSurface[cell], carved[cell])) {
        wetFloorCells += Math.abs(grid.cellCenterX(cell)) < VALLEY_FLOOR_HALF_WIDTH ? 1 : 0;

        continue;
      }

      const water = riverLevelBeside(grid, cell, {
        carved,
        riverStrength: result.riverStrength,
        waterSurface: result.waterSurface,
      });

      if (Number.isFinite(water)) {
        rises.push(carved[cell] - water);
      }
    }

    expect(result.features.rivers.length).toBeGreaterThan(0);
    expect(wetFloorCells).toBeGreaterThan(10);
    expect(rises.length).toBeGreaterThan(20);
    expect(Math.max(...rises)).toBeLessThan(BANK_FREEBOARD + 0.01);
  });

  it("rises steadily from the river to the untouched valley walls", () => {
    const { carved, grid, uncarved } = carveValley(GENTLE_WALLS);

    const row = grid.rowAt(-150);
    const profile = Array.from({ length: 12 }, (_, step) => carved[grid.index(grid.columnAt(5 + step * 10), row)]);

    for (let step = 1; step < profile.length; step += 1) {
      expect(profile[step]).toBeGreaterThanOrEqual(profile[step - 1]);
    }

    for (let cell = 0; cell < grid.cellCount; cell += 1) {
      if (Math.abs(grid.cellCenterX(cell)) > UNTOUCHED_DISTANCE) {
        expect(carved[cell]).toBe(uncarved[cell]);
      }
    }
  });

  it("lowers steep valley walls by at most ten metres and never notches them", () => {
    const { carved, grid, uncarved } = carveValley(STEEP_WALLS);

    let deepestWallCut = 0;

    for (let cell = 0; cell < grid.cellCount; cell += 1) {
      if (Math.abs(grid.cellCenterX(cell)) > VALLEY_FLOOR_HALF_WIDTH) {
        deepestWallCut = Math.max(deepestWallCut, uncarved[cell] - carved[cell]);
      }
    }

    const row = grid.rowAt(-150);
    const profile = Array.from({ length: 12 }, (_, step) => carved[grid.index(grid.columnAt(15 + step * 10), row)]);

    expect(deepestWallCut).toBeGreaterThan(5);
    expect(deepestWallCut).toBeLessThanOrEqual(DEEPEST_BANK_LOWERING + 0.01);

    for (let step = 1; step < profile.length; step += 1) {
      expect(profile[step] - profile[step - 1]).toBeGreaterThan(0);
      expect(profile[step] - profile[step - 1]).toBeLessThan(STEEP_WALLS * 10 + 5);
    }
  });

  it("cuts a gorge through a ridge across the valley instead of lifting the water over it", () => {
    const { carved, grid, result, uncarved } = carveValley(GENTLE_WALLS, RIDGE_HEIGHT);

    const crossing = result.features.rivers.flatMap((river) => river.points).find((point) => Math.abs(point.z) < 5);

    expect(crossing).toBeDefined();

    if (crossing === undefined) {
      return;
    }

    const crest = grid.cellAt(crossing.x, crossing.z);
    const wall = grid.cellAt(crossing.x + 25, crossing.z);

    expect(uncarved[crest] - result.waterSurface[crest]).toBeGreaterThan(RIDGE_HEIGHT * 0.5);
    expect(carved[crest]).toBeLessThan(result.waterSurface[crest]);
    expect(carved[wall] - result.waterSurface[crest]).toBeGreaterThan(5);

    for (const river of result.features.rivers) {
      const levels = river.points.map((point) => result.waterSurface[grid.cellAt(point.x, point.z)]);

      for (let index = 1; index < levels.length; index += 1) {
        expect(levels[index]).toBeLessThanOrEqual(levels[index - 1] + 1e-3);
      }
    }
  });
});

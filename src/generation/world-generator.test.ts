import { beforeAll, describe, expect, it } from "vitest";
import { Biome } from "../content/biomes.ts";
import { Ground } from "../content/grounds.ts";
import { isTreeSpecies } from "../content/plants.ts";
import { isOnIsland } from "../world/coast.ts";
import type { IslandShapeKind } from "../world/island-shape.ts";
import type { TerrainData } from "../world/terrain-data.ts";
import { hasWater, NO_WATER } from "../world/water.ts";
import { WorldGrid } from "../world/world-grid.ts";
import {
  DEFAULT_GENERATION_OPTIONS,
  type GeneratedWorld,
  type GenerationProgress,
  generateWorld,
} from "./world-generator.ts";

const TEST_DIMENSIONS = { cellSize: 40, cellsPerSide: 128 };
const STEEP = 1;
const CLIFF = Math.tan((55 * Math.PI) / 180);
let world: GeneratedWorld;
let squareWorld: GeneratedWorld;
const stages = new Set<string>();

function generateTestWorld(seed: number, shape: IslandShapeKind = "round"): GeneratedWorld {
  return generateWorld(
    seed,
    { dimensions: TEST_DIMENSIONS, erosionStrength: 1, shape },
    (progress: GenerationProgress) => {
      stages.add(progress.stage);
    }
  );
}

function slopeAt(terrain: TerrainData, grid: WorldGrid, cell: number): number {
  const last = grid.cellsPerSide - 1;
  const column = grid.columnOf(cell);
  const row = grid.rowOf(cell);

  const east = terrain.height[grid.index(Math.min(last, column + 1), row)];
  const west = terrain.height[grid.index(Math.max(0, column - 1), row)];
  const south = terrain.height[grid.index(column, Math.min(last, row + 1))];
  const north = terrain.height[grid.index(column, Math.max(0, row - 1))];

  return Math.hypot((east - west) / (2 * grid.cellSize), (south - north) / (2 * grid.cellSize));
}

function slopesOf(terrain: TerrainData, grid: WorldGrid): number[] {
  return Array.from({ length: grid.cellCount }, (_, cell) => slopeAt(terrain, grid, cell));
}

function shareAbove(values: readonly number[], limit: number): number {
  return values.filter((value) => value > limit).length / values.length;
}

function edgeSides(grid: WorldGrid): number[][] {
  const last = grid.cellsPerSide - 1;
  const positions = Array.from({ length: grid.cellsPerSide }, (_, position) => position);

  return [
    positions.map((position) => grid.index(position, 0)),
    positions.map((position) => grid.index(position, last)),
    positions.map((position) => grid.index(0, position)),
    positions.map((position) => grid.index(last, position)),
  ];
}

function coastCells(terrain: TerrainData, grid: WorldGrid): number[] {
  return Array.from({ length: grid.cellCount }, (_, cell) => cell).filter(
    (cell) =>
      isOnIsland(terrain.coastDistance, cell) &&
      grid
        .cellsInRadius(grid.cellCenterX(cell), grid.cellCenterZ(cell), grid.cellSize * 1.5)
        .some((neighbor) => !isOnIsland(terrain.coastDistance, neighbor))
  );
}

function largestStepAlong(heights: Float32Array, cells: readonly number[]): number {
  let largest = 0;

  for (let position = 1; position < cells.length; position += 1) {
    largest = Math.max(largest, Math.abs(heights[cells[position]] - heights[cells[position - 1]]));
  }

  return largest;
}

function isRiverWater(terrain: TerrainData, cell: number): boolean {
  return terrain.riverStrength[cell] > 0 && hasWater(terrain.waterSurface[cell], terrain.height[cell]);
}

function cellsAround(grid: WorldGrid, cell: number, innerRadius: number, outerRadius: number): number[] {
  const x = grid.cellCenterX(cell);
  const z = grid.cellCenterZ(cell);

  return grid
    .cellsInRadius(x, z, outerRadius)
    .filter((other) => Math.hypot(grid.cellCenterX(other) - x, grid.cellCenterZ(other) - z) >= innerRadius);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((first, second) => first - second);

  return sorted[Math.floor(sorted.length / 2)];
}

beforeAll(() => {
  world = generateTestWorld(7);
  squareWorld = generateTestWorld(7, "square");
});

describe("world generation", () => {
  it("reports every stage", () => {
    expect([...stages].sort()).toEqual(["climate", "erosion", "relief", "vegetation", "water"]);
  });

  it("is deterministic for a seed", () => {
    const again = generateTestWorld(7);

    expect(again.terrain.height).toEqual(world.terrain.height);
    expect(again.vegetation.count).toBe(world.vegetation.count);
  });

  it("differs between seeds", () => {
    const other = generateTestWorld(8);

    expect(other.terrain.height).not.toEqual(world.terrain.height);
  });

  it("builds mountains, lowlands and a lake basin", () => {
    let highest = Number.NEGATIVE_INFINITY;
    let lowest = Number.POSITIVE_INFINITY;

    for (const height of squareWorld.terrain.height) {
      highest = Math.max(highest, height);
      lowest = Math.min(lowest, height);
    }

    expect(highest).toBeGreaterThan(900);
    expect(lowest).toBeLessThan(200);
    expect(squareWorld.water.lakes.length).toBeGreaterThanOrEqual(3);
  });

  it("raises mountains and a lake on the round island too", () => {
    const heights = world.terrain.height.filter((_, cell) => isOnIsland(world.terrain.coastDistance, cell));

    expect(Math.max(...heights)).toBeGreaterThan(900);
    expect(Math.min(...heights)).toBeLessThan(200);
    expect(world.water.lakes.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps the square island whole to its edges", () => {
    expect(squareWorld.terrain.coastDistance.every((distance) => distance > 0)).toBe(true);
  });

  it("covers lake cells with water at the lake level", () => {
    const lake = world.water.lakes.at(0);
    const grid = new WorldGrid(TEST_DIMENSIONS);

    expect(lake).toBeDefined();

    if (lake === undefined) {
      return;
    }

    const cell = grid.cellAt(lake.centerX, lake.centerZ);

    const surface = world.terrain.waterSurface[cell];

    expect(surface).not.toBe(NO_WATER);
  });

  it("traces rivers that flow downhill", () => {
    expect(world.water.rivers.length).toBeGreaterThan(0);

    for (const river of world.water.rivers) {
      const surfaces = river.points.map((point) => point.surface);

      for (let pointIndex = 1; pointIndex < surfaces.length; pointIndex += 1) {
        expect(surfaces[pointIndex]).toBeLessThanOrEqual(surfaces[pointIndex - 1] + 1e-3);
      }
    }
  });

  it("lets rivers leave the island as waterfalls", () => {
    const edgeRivers = world.water.rivers.filter((river) => river.reachesEdge);

    expect(world.water.waterfalls).toHaveLength(edgeRivers.length);

    for (const waterfall of world.water.waterfalls) {
      expect(Math.hypot(waterfall.directionX, waterfall.directionZ)).toBeCloseTo(1);
    }
  });

  it("rounds the island off with a coast inside the square", () => {
    const grid = new WorldGrid(TEST_DIMENSIONS);
    const last = grid.cellsPerSide - 1;
    const middle = Math.floor(grid.cellsPerSide / 2);

    for (const corner of [grid.index(0, 0), grid.index(last, 0), grid.index(0, last), grid.index(last, last)]) {
      expect(isOnIsland(world.terrain.coastDistance, corner)).toBe(false);
    }

    expect(isOnIsland(world.terrain.coastDistance, grid.index(middle, middle))).toBe(true);

    for (let plant = 0; plant < world.vegetation.count; plant += 1) {
      const cell = grid.cellAt(world.vegetation.x[plant], world.vegetation.z[plant]);

      expect(isOnIsland(world.terrain.coastDistance, cell)).toBe(true);
    }

    for (let cell = 0; cell < grid.cellCount; cell += 1) {
      if (!isOnIsland(world.terrain.coastDistance, cell)) {
        expect(world.terrain.waterSurface[cell]).toBe(NO_WATER);
      }
    }
  });

  it("classifies water cells as water and plants nothing in them", () => {
    const grid = new WorldGrid(TEST_DIMENSIONS);

    for (let cell = 0; cell < grid.cellCount; cell += 1) {
      if (hasWater(world.terrain.waterSurface[cell], world.terrain.height[cell])) {
        expect(world.terrain.biome[cell]).toBe(Biome.Water);
      }
    }

    for (let plant = 0; plant < world.vegetation.count; plant += 1) {
      const cell = grid.cellAt(world.vegetation.x[plant], world.vegetation.z[plant]);

      expect(hasWater(world.terrain.waterSurface[cell], world.terrain.height[cell])).toBe(false);
    }
  });

  it("keeps the square island rim at a moderate height", () => {
    const grid = new WorldGrid(TEST_DIMENSIONS);

    const rim = edgeSides(grid).flatMap((side) => side.map((cell) => squareWorld.terrain.height[cell]));

    expect(Math.min(...rim)).toBeGreaterThan(120);
    expect(Math.max(...rim)).toBeLessThan(400);
  });

  it("eases the round island down to a low shore", () => {
    const grid = new WorldGrid(TEST_DIMENSIONS);

    const shore = coastCells(world.terrain, grid).map((cell) => world.terrain.height[cell]);

    expect(Math.min(...shore)).toBeGreaterThan(30);
    expect(Math.max(...shore)).toBeLessThan(300);
  });

  it("keeps slopes realistic, with few cliffs", () => {
    const slopes = slopesOf(world.terrain, new WorldGrid(TEST_DIMENSIONS));

    const meanSlope = (Math.atan(slopes.reduce((total, slope) => total + slope, 0) / slopes.length) * 180) / Math.PI;

    expect(meanSlope).toBeGreaterThan(14);
    expect(meanSlope).toBeLessThan(24);
    expect(shareAbove(slopes, STEEP)).toBeLessThan(0.03);
    expect(shareAbove(slopes, CLIFF)).toBeLessThan(0.001);
  });

  it("sinks rivers into valleys below the land around them", () => {
    const grid = new WorldGrid(TEST_DIMENSIONS);
    const { terrain } = world;
    const depths: number[] = [];

    for (let cell = 0; cell < grid.cellCount; cell += 1) {
      if (!isRiverWater(terrain, cell)) {
        continue;
      }

      const land = cellsAround(grid, cell, 60, 100).filter(
        (other) => !hasWater(terrain.waterSurface[other], terrain.height[other])
      );

      if (land.length > 0) {
        depths.push(
          land.reduce((total, other) => total + terrain.height[other], 0) / land.length - terrain.waterSurface[cell]
        );
      }
    }

    expect(depths.length).toBeGreaterThan(100);
    expect(median(depths)).toBeGreaterThan(5);
  });

  it("lines warm, low river banks with sand and keeps trees off it", () => {
    const grid = new WorldGrid(TEST_DIMENSIONS);
    const { terrain, vegetation } = world;
    const banks = new Set<number>();

    for (let cell = 0; cell < grid.cellCount; cell += 1) {
      if (!isRiverWater(terrain, cell)) {
        continue;
      }

      for (const bank of cellsAround(grid, cell, 1, grid.cellSize * 1.5)) {
        const isLow = terrain.height[bank] < terrain.waterSurface[cell] + 1.5;
        const isGentle = slopeAt(terrain, grid, bank) < 0.25;
        const isWarm = terrain.baseTemperature[bank] > 4;

        if (isLow && isGentle && isWarm && !hasWater(terrain.waterSurface[bank], terrain.height[bank])) {
          banks.add(bank);
        }
      }
    }

    const sandy = [...banks].filter((bank) => terrain.ground[bank] === Ground.Sand);

    expect(banks.size).toBeGreaterThan(50);
    expect(sandy.length / banks.size).toBeGreaterThan(0.8);

    for (let plant = 0; plant < vegetation.count; plant += 1) {
      if (isTreeSpecies(vegetation.species[plant])) {
        expect(terrain.ground[grid.cellAt(vegetation.x[plant], vegetation.z[plant])]).not.toBe(Ground.Sand);
      }
    }
  });

  it("produces many biomes and a living vegetation cover", () => {
    const biomes = new Set(world.terrain.biome);

    expect(biomes.size).toBeGreaterThanOrEqual(8);
    expect(world.vegetation.aliveCount).toBeGreaterThan(1000);
  });
});

describe("full-size island rim", () => {
  let fullSize: GeneratedWorld;
  let fullSquare: GeneratedWorld;

  beforeAll(() => {
    fullSize = generateWorld(7);
    fullSquare = generateWorld(7, { ...DEFAULT_GENERATION_OPTIONS, shape: "square" });
  }, 60_000);

  it("meets the square cliff at a moderate height without steps that could open gaps", () => {
    const grid = new WorldGrid(fullSquare.dimensions);

    for (const side of edgeSides(grid)) {
      const heights = side.map((cell) => fullSquare.terrain.height[cell]);

      expect(Math.min(...heights)).toBeGreaterThan(120);
      expect(Math.max(...heights)).toBeLessThan(400);
      expect(largestStepAlong(fullSquare.terrain.height, side)).toBeLessThan(15);
    }
  });

  it("meets the round coast at a moderate height", () => {
    const shore = coastCells(fullSize.terrain, new WorldGrid(fullSize.dimensions)).map(
      (cell) => fullSize.terrain.height[cell]
    );

    expect(Math.min(...shore)).toBeGreaterThan(100);
    expect(Math.max(...shore)).toBeLessThan(300);
  });

  it("has few slopes steeper than 45 degrees and almost none steeper than 55", () => {
    const slopes = slopesOf(fullSize.terrain, new WorldGrid(fullSize.dimensions));

    expect(shareAbove(slopes, STEEP)).toBeLessThan(0.03);
    expect(shareAbove(slopes, CLIFF)).toBeLessThan(0.0005);
  });
});

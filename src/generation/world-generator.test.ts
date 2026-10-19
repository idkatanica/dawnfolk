import { beforeAll, describe, expect, it } from "vitest";
import { Biome } from "../content/biomes.ts";
import { Ground } from "../content/grounds.ts";
import { isTreeSpecies, plantSpeciesDefinition } from "../content/plants.ts";
import { isOnIsland } from "../world/coast.ts";
import { admitsWildPlant, slopeAt } from "../world/footing.ts";
import { ISLAND_SHAPES, type IslandShapeKind } from "../world/island-shape.ts";
import type { TerrainData } from "../world/terrain-data.ts";
import { sampleHeight } from "../world/terrain-sampling.ts";
import { hasWater, NO_WATER, type River, type RiverPoint, SPRING_KINDS } from "../world/water.ts";
import { NEIGHBOR_OFFSETS, WorldGrid } from "../world/world-grid.ts";
import {
  DEFAULT_GENERATION_OPTIONS,
  type GeneratedWorld,
  type GenerationProgress,
  generateWorld,
} from "./world-generator.ts";

const TEST_DIMENSIONS = { cellSize: 40, cellsPerSide: 128 };
const STEEP = 1;
const CLIFF = Math.tan((55 * Math.PI) / 180);
const SMALLEST_RIVER_GAP = 35;
const CONFLUENCE_REACH = 100;
const JUNCTION_CELLS = 1.5;

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

function slopesOf(terrain: TerrainData, grid: WorldGrid): number[] {
  return Array.from({ length: grid.cellCount }, (_, cell) => slopeAt(terrain.height, grid, cell));
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

function plantsAboveTheirSlope(generated: GeneratedWorld): string[] {
  const { terrain, vegetation } = generated;

  const grid = new WorldGrid(generated.dimensions);
  const misplaced: string[] = [];

  for (let plant = 0; plant < vegetation.count; plant += 1) {
    const { name, steepestSlope } = plantSpeciesDefinition(vegetation.species[plant]);

    const cell = grid.cellAt(vegetation.x[plant], vegetation.z[plant]);
    const slope = slopeAt(terrain.height, grid, cell);

    if (slope > steepestSlope) {
      misplaced.push(`${name} on slope ${slope.toFixed(2)}`);
    }
  }

  return misplaced;
}

function isWooded(terrain: TerrainData, cell: number): boolean {
  return terrain.biome[cell] === Biome.Forest || terrain.biome[cell] === Biome.Taiga;
}

function nearWater(terrain: TerrainData, grid: WorldGrid, cell: number, radius: number): boolean {
  return grid
    .cellsInRadius(grid.cellCenterX(cell), grid.cellCenterZ(cell), radius)
    .some((other) => hasWater(terrain.waterSurface[other], terrain.height[other]));
}

function median(values: readonly number[]): number {
  return quantile(values, 0.5);
}

function quantile(values: readonly number[], share: number): number {
  const sorted = [...values].sort((first, second) => first - second);

  return sorted[Math.floor(sorted.length * share)];
}

function waterLevelBesideRiver(terrain: TerrainData, grid: WorldGrid, cell: number): number {
  let total = 0;
  let count = 0;
  let isBesideRiver = false;

  for (const offset of NEIGHBOR_OFFSETS) {
    const column = grid.columnOf(cell) + offset.column;
    const row = grid.rowOf(cell) + offset.row;

    if (!grid.contains(column, row)) {
      continue;
    }

    const neighbor = grid.index(column, row);

    if (!hasWater(terrain.waterSurface[neighbor], terrain.height[neighbor])) {
      continue;
    }

    total += terrain.waterSurface[neighbor];
    count += 1;

    if (isRiverWater(terrain, neighbor)) {
      isBesideRiver = true;
    }
  }

  return isBesideRiver ? total / count : Number.NaN;
}

function bankRises(terrain: TerrainData, grid: WorldGrid): number[] {
  const rises: number[] = [];

  for (let cell = 0; cell < grid.cellCount; cell += 1) {
    const isDryLand =
      isOnIsland(terrain.coastDistance, cell) && !hasWater(terrain.waterSurface[cell], terrain.height[cell]);

    const water = isDryLand ? waterLevelBesideRiver(terrain, grid, cell) : Number.NaN;

    if (Number.isFinite(water)) {
      rises.push(terrain.height[cell] - water);
    }
  }

  return rises;
}

function riverPathCells(grid: WorldGrid, river: River): number[] {
  const cells: number[] = [];

  for (const point of river.points) {
    const cell = grid.cellAt(point.x, point.z);

    if (cell !== cells.at(-1)) {
      cells.push(cell);
    }
  }

  return cells;
}

function isLakeWater(terrain: TerrainData, cell: number): boolean {
  return terrain.riverStrength[cell] === 0 && hasWater(terrain.waterSurface[cell], terrain.height[cell]);
}

function riverFaults(generated: GeneratedWorld): string[] {
  const { terrain } = generated;

  const grid = new WorldGrid(generated.dimensions);
  const faults: string[] = [];

  for (const river of generated.water.rivers) {
    let level = Number.POSITIVE_INFINITY;

    for (const cell of riverPathCells(grid, river)) {
      const where = `river ${river.id} at ${grid.cellCenterX(cell)}, ${grid.cellCenterZ(cell)}`;

      if (isLakeWater(terrain, cell)) {
        continue;
      }

      if (!isRiverWater(terrain, cell)) {
        faults.push(`${where} runs dry`);

        continue;
      }

      if (terrain.waterSurface[cell] > level + 1e-3) {
        faults.push(`${where} rises by ${(terrain.waterSurface[cell] - level).toFixed(2)}`);
      }

      level = Math.min(level, terrain.waterSurface[cell]);
    }
  }

  return faults;
}

function isCoastTaken(terrain: TerrainData, grid: WorldGrid, cell: number): boolean {
  return grid
    .cellsInRadius(grid.cellCenterX(cell), grid.cellCenterZ(cell), grid.cellSize * 1.5)
    .filter((neighbor) => !isOnIsland(terrain.coastDistance, neighbor))
    .every((neighbor) => terrain.waterSurface[neighbor] !== NO_WATER);
}

function reachesPastCoast(generated: GeneratedWorld, grid: WorldGrid, mouth: number): boolean {
  const { terrain } = generated;

  if (generated.shape === "square") {
    return grid.isOnEdge(mouth);
  }

  return !isOnIsland(terrain.coastDistance, mouth) || isCoastTaken(terrain, grid, mouth);
}

function mouthFaults(generated: GeneratedWorld): string[] {
  const { terrain } = generated;

  const grid = new WorldGrid(generated.dimensions);
  const faults: string[] = [];

  for (const river of generated.water.rivers.filter((candidate) => candidate.reachesEdge)) {
    const mouth = riverPathCells(grid, river).at(-1);
    const end = river.points.at(-1);

    if (mouth === undefined || end === undefined) {
      continue;
    }

    const isPastCoast = reachesPastCoast(generated, grid, mouth);
    const waterfall = generated.water.waterfalls.find((candidate) => candidate.x === end.x && candidate.z === end.z);

    if (!isPastCoast) {
      faults.push(`river ${river.id} ends inland at ${grid.cellCenterX(mouth)}, ${grid.cellCenterZ(mouth)}`);
    }

    if (waterfall === undefined || Math.abs(waterfall.top - terrain.waterSurface[mouth]) > 0.1) {
      faults.push(`river ${river.id} does not meet its waterfall`);
    }
  }

  return faults;
}

function isFedByLake(generated: GeneratedWorld, grid: WorldGrid, river: River): boolean {
  const [head] = river.points;

  return grid.cellsInRadius(head.x, head.z, grid.cellSize * 2.5).some((cell) => isLakeWater(generated.terrain, cell));
}

function headFaults(generated: GeneratedWorld): string[] {
  const grid = new WorldGrid(generated.dimensions);
  const faults: string[] = [];

  for (const river of generated.water.rivers) {
    const spring = generated.water.springs.find((candidate) => candidate.river === river.id);
    const [head] = river.points;
    const ahead = river.points.find((point) => Math.hypot(point.x - head.x, point.z - head.z) >= 25);

    if (spring === undefined) {
      if (!isFedByLake(generated, grid, river)) {
        faults.push(`river ${river.id} starts from nothing at ${head.x.toFixed(0)}, ${head.z.toFixed(0)}`);
      }

      continue;
    }

    if (ahead === undefined) {
      continue;
    }

    const facing =
      (spring.directionX * (ahead.x - head.x) + spring.directionZ * (ahead.z - head.z)) /
      Math.hypot(ahead.x - head.x, ahead.z - head.z);
    const behind = spring.directionX * (head.x - spring.x) + spring.directionZ * (head.z - spring.z);

    if (facing < 0.95 || behind < 0) {
      faults.push(`the ${spring.kind} of river ${river.id} does not face down the river`);
    }
  }

  return faults;
}

function riverEnd(river: River): RiverPoint {
  const end = river.points.at(-1);

  if (end === undefined) {
    throw new Error(`River ${river.id} has no points`);
  }

  return end;
}

function isNear(point: RiverPoint, other: RiverPoint, reach: number): boolean {
  return Math.hypot(point.x - other.x, point.z - other.z) < reach;
}

function joinsRiver(tributary: River, main: River, reach: number): boolean {
  const end = riverEnd(tributary);

  return main.points.some((point) => isNear(point, end, reach));
}

function confluencesOf(rivers: readonly River[], first: River, second: River, reach: number): RiverPoint[] {
  const confluences: RiverPoint[] = [];

  for (const [tributary, main] of [
    [first, second],
    [second, first],
  ] as const) {
    if (joinsRiver(tributary, main, reach)) {
      confluences.push(riverEnd(tributary));
    }
  }

  for (const third of rivers) {
    if (third !== first && third !== second && joinsRiver(first, third, reach) && joinsRiver(second, third, reach)) {
      confluences.push(riverEnd(first), riverEnd(second));
    }
  }

  return confluences;
}

function closestDistinctRivers(generated: GeneratedWorld): number {
  const { cellSize } = generated.dimensions;
  const { rivers } = generated.water;

  let closest = Number.POSITIVE_INFINITY;

  for (const [index, first] of rivers.entries()) {
    for (const second of rivers.slice(index + 1)) {
      const confluences = confluencesOf(rivers, first, second, cellSize * JUNCTION_CELLS);

      const isApart = (point: RiverPoint) =>
        confluences.every((confluence) => !isNear(point, confluence, CONFLUENCE_REACH));

      for (const point of first.points.filter(isApart)) {
        for (const other of second.points.filter(isApart)) {
          closest = Math.min(closest, Math.hypot(point.x - other.x, point.z - other.z));
        }
      }
    }
  }

  return closest;
}

function distanceToWaterfall(generated: GeneratedWorld, grid: WorldGrid, cell: number): number {
  const x = grid.cellCenterX(cell);
  const z = grid.cellCenterZ(cell);

  return Math.min(...generated.water.waterfalls.map((waterfall) => Math.hypot(waterfall.x - x, waterfall.z - z)));
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

  it("keeps the water of every river falling from its source to its mouth on several seeds and both shapes", () => {
    for (const seed of [3, 7, 11, 19]) {
      for (const shape of ISLAND_SHAPES) {
        const generated = seed === 7 && shape === "round" ? world : generateTestWorld(seed, shape);

        expect(generated.water.rivers.length).toBeGreaterThan(0);
        expect(riverFaults(generated)).toEqual([]);
      }
    }
  });

  it("runs the rivers that leave the island past the coast to the top of their waterfalls", () => {
    for (const generated of [world, squareWorld, generateTestWorld(11), generateTestWorld(11, "square")]) {
      expect(generated.water.waterfalls.length).toBeGreaterThan(0);
      expect(mouthFaults(generated)).toEqual([]);
    }
  });

  it("keeps distinct rivers apart instead of running them side by side on several seeds and both shapes", () => {
    for (const seed of [3, 7, 11]) {
      for (const shape of ISLAND_SHAPES) {
        const generated = seed === 7 && shape === "round" ? world : generateTestWorld(seed, shape);

        expect(closestDistinctRivers(generated)).toBeGreaterThan(SMALLEST_RIVER_GAP);
      }
    }
  });

  it("starts every river at a pond or a cave facing down the river", () => {
    for (const generated of [world, squareWorld, generateTestWorld(11), generateTestWorld(19, "square")]) {
      expect(generated.water.springs.length).toBeGreaterThan(0);
      expect(headFaults(generated)).toEqual([]);
    }
  });

  it("digs ponds as still water at the level of the river head and keeps plants off every spring", () => {
    const grid = new WorldGrid(TEST_DIMENSIONS);
    const ponds = world.water.springs.filter((spring) => spring.kind === "pond");

    expect(ponds.length).toBeGreaterThan(0);

    for (const pond of ponds) {
      const cell = grid.cellAt(pond.x, pond.z);

      expect(hasWater(world.terrain.waterSurface[cell], world.terrain.height[cell])).toBe(true);
      expect(world.terrain.waterSurface[cell]).toBeCloseTo(pond.level, 1);
      expect(world.terrain.riverStrength[cell]).toBe(0);
    }

    const springGround = new Set(world.water.springs.flatMap((spring) => spring.cells));

    for (let plant = 0; plant < world.vegetation.count; plant += 1) {
      expect(springGround.has(grid.cellAt(world.vegetation.x[plant], world.vegetation.z[plant]))).toBe(false);
    }
  });

  it("lets rivers leave the island as waterfalls", () => {
    const edgeRivers = world.water.rivers.filter((river) => river.reachesEdge);

    expect(world.water.waterfalls).toHaveLength(edgeRivers.length);

    for (const waterfall of world.water.waterfalls) {
      expect(Math.hypot(waterfall.directionX, waterfall.directionZ)).toBeCloseTo(1);
    }
  });

  it("points every waterfall out of the island, the way its river leaves", () => {
    for (const generated of [world, squareWorld]) {
      const grid = new WorldGrid(generated.dimensions);

      for (const { directionX, directionZ, x, z } of generated.water.waterfalls) {
        const upstream = sampleHeight(generated.terrain.coastDistance, grid, x - directionX * 30, z - directionZ * 30);

        expect(upstream).toBeGreaterThan(sampleHeight(generated.terrain.coastDistance, grid, x, z));
      }
    }
  });

  it("keeps every plant clear of the coast so none hangs over the edge", () => {
    const grid = new WorldGrid(TEST_DIMENSIONS);

    for (let plant = 0; plant < world.vegetation.count; plant += 1) {
      const x = world.vegetation.x[plant];
      const z = world.vegetation.z[plant];

      expect(sampleHeight(world.terrain.coastDistance, grid, x, z)).toBeGreaterThan(6);
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
      if (!isOnIsland(world.terrain.coastDistance, cell) && world.terrain.waterSurface[cell] !== NO_WATER) {
        expect(distanceToWaterfall(world, grid, cell)).toBeLessThan(grid.cellSize * 2);
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
    const { terrain } = world;

    const grid = new WorldGrid(TEST_DIMENSIONS);
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
    const { terrain, vegetation } = world;

    const grid = new WorldGrid(TEST_DIMENSIONS);
    const banks = new Set<number>();

    for (let cell = 0; cell < grid.cellCount; cell += 1) {
      if (!isRiverWater(terrain, cell)) {
        continue;
      }

      for (const bank of cellsAround(grid, cell, 1, grid.cellSize * 1.5)) {
        const isLow = terrain.height[bank] < terrain.waterSurface[cell] + 1.5;
        const isGentle = slopeAt(terrain.height, grid, bank) < 0.25;
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

  it("plants nothing on ground steeper than its species can hold", () => {
    expect(plantsAboveTheirSlope(world)).toEqual([]);
  });

  it("opens glades, sparse stands and riverside meadows in the forests", () => {
    const { terrain } = world;

    const grid = new WorldGrid(TEST_DIMENSIONS);
    const wooded = Array.from({ length: grid.cellCount }, (_, cell) => cell).filter((cell) => isWooded(terrain, cell));

    const densities = wooded.map((cell) => terrain.woodland[cell]);
    const mean = densities.reduce((total, density) => total + density, 0) / densities.length;

    const banks = wooded.filter((cell) => nearWater(terrain, grid, cell, 50));
    const bankMean = banks.reduce((total, cell) => total + terrain.woodland[cell], 0) / banks.length;

    expect(wooded.length).toBeGreaterThan(1000);
    expect(mean).toBeGreaterThan(0.5);
    expect(mean).toBeLessThan(0.85);
    expect(densities.filter((density) => density < 0.05).length / densities.length).toBeGreaterThan(0.04);
    expect(densities.filter((density) => density > 0.95).length / densities.length).toBeGreaterThan(0.2);
    expect(bankMean).toBeLessThan(mean * 0.7);

    for (const cell of wooded) {
      if (terrain.woodland[cell] < 0.3) {
        expect(terrain.ground[cell]).not.toBe(Ground.Forest);
      }
    }
  });

  it("grows no wild plant where the woodland turns it away", () => {
    const { terrain, vegetation } = world;

    const grid = new WorldGrid(TEST_DIMENSIONS);

    for (let plant = 0; plant < vegetation.count; plant += 1) {
      const cell = grid.cellAt(vegetation.x[plant], vegetation.z[plant]);

      expect(admitsWildPlant(terrain, grid, cell, vegetation.species[plant])).toBe(true);
    }
  });

  it("keeps the woodland the same for a seed", () => {
    expect(generateTestWorld(7).terrain.woodland).toEqual(world.terrain.woodland);
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

  it("lowers the banks of rivers to just above the water beside them on both shapes", () => {
    for (const generated of [fullSize, fullSquare]) {
      const rises = bankRises(generated.terrain, new WorldGrid(generated.dimensions));

      expect(rises.length).toBeGreaterThan(2000);
      expect(median(rises)).toBeLessThan(0.3);
      expect(quantile(rises, 0.9)).toBeLessThan(0.5);
    }
  });

  it("keeps full-size rivers falling all the way to the coast and their waterfalls on both shapes", () => {
    for (const generated of [fullSize, fullSquare]) {
      expect(riverFaults(generated)).toEqual([]);
      expect(mouthFaults(generated)).toEqual([]);
    }
  });

  it("keeps the full-size rivers apart on both shapes", () => {
    expect(closestDistinctRivers(fullSize)).toBeGreaterThan(SMALLEST_RIVER_GAP);
    expect(closestDistinctRivers(fullSquare)).toBeGreaterThan(SMALLEST_RIVER_GAP);
  });

  it("starts every full-size river at a pond or a cave on both shapes", () => {
    for (const generated of [fullSize, fullSquare]) {
      const kinds = new Set(generated.water.springs.map((spring) => spring.kind));

      expect(headFaults(generated)).toEqual([]);
      expect([...kinds].sort()).toEqual([...SPRING_KINDS].sort());
    }
  });

  it("keeps every plant of the full island off ground too steep for it", () => {
    expect(plantsAboveTheirSlope(fullSize)).toEqual([]);
    expect(plantsAboveTheirSlope(fullSquare)).toEqual([]);
  });

  it("has few slopes steeper than 45 degrees and almost none steeper than 55", () => {
    const slopes = slopesOf(fullSize.terrain, new WorldGrid(fullSize.dimensions));

    expect(shareAbove(slopes, STEEP)).toBeLessThan(0.03);
    expect(shareAbove(slopes, CLIFF)).toBeLessThan(0.0005);
  });
});

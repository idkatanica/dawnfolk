import { beforeAll, describe, expect, it } from "vitest";
import { Biome } from "../content/biomes.ts";
import { isOnIsland } from "../world/coast.ts";
import { hasWater, NO_WATER } from "../world/water.ts";
import { WorldGrid } from "../world/world-grid.ts";
import { type GeneratedWorld, type GenerationProgress, generateWorld } from "./world-generator.ts";

const TEST_DIMENSIONS = { cellSize: 40, cellsPerSide: 128 };
let world: GeneratedWorld;
const stages = new Set<string>();

function generateTestWorld(seed: number): GeneratedWorld {
  return generateWorld(seed, { dimensions: TEST_DIMENSIONS, erosionStrength: 1 }, (progress: GenerationProgress) => {
    stages.add(progress.stage);
  });
}

beforeAll(() => {
  world = generateTestWorld(7);
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

    for (const height of world.terrain.height) {
      highest = Math.max(highest, height);
      lowest = Math.min(lowest, height);
    }

    expect(highest).toBeGreaterThan(900);
    expect(lowest).toBeLessThan(200);
    expect(world.water.lakes.length).toBeGreaterThan(0);
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

  it("produces many biomes and a living vegetation cover", () => {
    const biomes = new Set(world.terrain.biome);

    expect(biomes.size).toBeGreaterThanOrEqual(8);
    expect(world.vegetation.aliveCount).toBeGreaterThan(1000);
  });
});

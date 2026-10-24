import { Biome, type BiomeIndex } from "../../content/biomes.ts";
import type { DepositKind } from "../../content/deposits.ts";
import { Ground, type GroundIndex } from "../../content/grounds.ts";
import { type PlantSpeciesIndex, plantSpeciesDefinition } from "../../content/plants.ts";
import { plantInitialVegetation } from "../../generation/vegetation.ts";
import type { GeneratedWorld } from "../../generation/world-generator.ts";
import type { Crossing, Ford } from "../../world/crossings.ts";
import type { Deposit } from "../../world/deposits.ts";
import type { Monument } from "../../world/monuments.ts";
import { createTerrainData } from "../../world/testing/terrain-fixtures.ts";
import { VegetationStore } from "../../world/vegetation-store.ts";
import { NO_WATER } from "../../world/water.ts";
import { type GridDimensions, WorldGrid } from "../../world/world-grid.ts";
import { WorldState } from "../world/world-state.ts";

export interface TestWorldOptions {
  baseTemperature: number;
  biome: BiomeIndex;
  crossings: readonly Crossing[];
  deposits: readonly Deposit[];
  dimensions: GridDimensions;
  ground: GroundIndex;
  heightAt: (x: number, z: number) => number;
  monuments: readonly Monument[];
}

const DEFAULT_TEST_WORLD: TestWorldOptions = {
  baseTemperature: 15,
  biome: Biome.Meadow,
  crossings: [],
  deposits: [],
  dimensions: { cellSize: 10, cellsPerSide: 64 },
  ground: Ground.Meadow,
  heightAt: () => 100,
  monuments: [],
};

function createTestGeneratedWorld(overrides: Partial<TestWorldOptions>): GeneratedWorld {
  const options: TestWorldOptions = { ...DEFAULT_TEST_WORLD, ...overrides };

  const grid = new WorldGrid(options.dimensions);
  const terrain = createTerrainData(options.dimensions);

  for (let cell = 0; cell < grid.cellCount; cell += 1) {
    terrain.height[cell] = options.heightAt(grid.cellCenterX(cell), grid.cellCenterZ(cell));
    terrain.baseTemperature[cell] = options.baseTemperature;
    terrain.biome[cell] = options.biome;
    terrain.ground[cell] = options.ground;
    terrain.moisture[cell] = 0.5;
  }

  terrain.waterSurface.fill(NO_WATER);

  return {
    crossings: options.crossings,
    deposits: options.deposits,
    dimensions: options.dimensions,
    monuments: options.monuments,
    seed: 1,
    shape: "square",
    terrain,
    vegetation: new VegetationStore(grid, grid.cellCount * 2),
    water: { lakes: [], rivers: [], springs: [], waterfalls: [] },
  };
}

export function createTestWorld(overrides: Partial<TestWorldOptions> = {}): WorldState {
  return new WorldState(createTestGeneratedWorld(overrides));
}

export function createVegetatedWorld(overrides: Partial<TestWorldOptions> = {}, seed = 3): GeneratedWorld {
  const generated = createTestGeneratedWorld(overrides);

  plantInitialVegetation(generated.vegetation, new WorldGrid(generated.dimensions), generated.terrain, seed);
  generated.vegetation.discardChanges();

  return generated;
}

export function plantInCell(world: WorldState, cell: number, species: PlantSpeciesIndex): number {
  return world.plant({
    bornDay: 0,
    height: 20,
    rotation: 0,
    seed: 0.5,
    species,
    x: world.grid.cellCenterX(cell),
    z: world.grid.cellCenterZ(cell),
  });
}

export function floodCells(world: WorldState, cells: readonly number[], depth: number): void {
  for (const cell of cells) {
    world.terrain.waterSurface[cell] = world.terrain.height[cell] + depth;
  }
}

export function fordAcross(fromX: number, toX: number, z: number): Ford {
  return { endX: toX, endZ: z, id: 0, kind: "ford", seed: 0.3, startX: fromX, startZ: z };
}

export function floodStrip(world: WorldState, halfWidth: number, depth: number): void {
  const { grid } = world;

  const cells = grid.cellsInRadius(0, 0, grid.worldSize).filter((cell) => Math.abs(grid.cellCenterX(cell)) < halfWidth);

  floodCells(world, cells, depth);
}

export function riverStrip(world: WorldState, fromX: number, toX: number, strength: number): void {
  const { grid } = world;

  const cells = grid.cellsInRadius(0, 0, grid.worldSize).filter((cell) => {
    const x = grid.cellCenterX(cell);

    return x > fromX && x < toX;
  });

  floodCells(world, cells, 0.8);

  for (const cell of cells) {
    world.terrain.riverStrength[cell] = strength;
  }
}

export function monumentAround(grid: WorldGrid, x: number, z: number, radius: number): Monument {
  return { cells: grid.cellsInRadius(x, z, radius), id: 0, kind: "stoneCircle", name: "Test Ring", x, z };
}

export function centerCell(world: WorldState): number {
  return world.grid.cellAt(0, 0);
}

export function steepeningRamp(steepestSlope: number, halfSize: number): (x: number) => number {
  return (x) => {
    const fromWest = x + halfSize;

    return 100 + (steepestSlope * fromWest * fromWest) / (4 * halfSize);
  };
}

export function plantsTooSteep(world: WorldState): string[] {
  const { vegetation } = world;

  const misplaced: string[] = [];

  for (let plant = 0; plant < vegetation.count; plant += 1) {
    const { name, steepestSlope } = plantSpeciesDefinition(vegetation.species[plant]);

    const slope = world.slope(vegetation.cell[plant]);

    if (vegetation.isAlive(plant) && slope > steepestSlope) {
      misplaced.push(`${name} on slope ${slope.toFixed(2)}`);
    }
  }

  return misplaced;
}

export function depositAround(grid: WorldGrid, kind: DepositKind, x: number, z: number): Deposit {
  return { cells: grid.cellsInRadius(x, z, 25), id: 0, kind, x, z };
}

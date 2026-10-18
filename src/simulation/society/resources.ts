import { Ground } from "../../content/grounds.ts";
import { FULL_TURN } from "../../shared/math.ts";
import type { RandomSource } from "../../shared/random.ts";
import { NO_PLANT } from "../../world/vegetation-store.ts";
import type { Waypoint } from "../agents/navigation.ts";
import type { WorldState } from "../world/world-state.ts";

const HOT_GROUND = 0.03;
const QUARRY_SLOPE = 0.9;
const CLIFF_SLOPE = 1.1;
const FISHING_DEPTH = 0.6;
const SHORE_ATTEMPTS = 40;
const SHORE_REACH = 0.3;
const ORTHOGONAL_STEPS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export interface PlantSearch {
  accepts: (plant: number) => boolean;
  radius: number;
  x: number;
  z: number;
}

export interface ShoreSpot {
  waterX: number;
  waterZ: number;
  x: number;
  z: number;
}

interface NearestPlant {
  distanceSquared: number;
  plant: number;
}

export function nearestPlant(world: WorldState, search: PlantSearch): number | null {
  const { grid } = world;

  const centerColumn = grid.columnAt(search.x);
  const centerRow = grid.rowAt(search.z);

  const ringCount = Math.ceil(search.radius / grid.cellSize);

  let nearest: NearestPlant = { distanceSquared: search.radius * search.radius, plant: NO_PLANT };

  for (let ring = 0; ring <= ringCount; ring += 1) {
    if (nearest.plant !== NO_PLANT && (ring - 1) * grid.cellSize > Math.sqrt(nearest.distanceSquared)) {
      break;
    }

    for (const cell of ringCells(world, centerColumn, centerRow, ring)) {
      nearest = nearerPlantInCell(world, cell, search, nearest);
    }
  }

  if (nearest.plant === NO_PLANT) {
    return null;
  }

  return nearest.plant;
}

function ringCells(world: WorldState, centerColumn: number, centerRow: number, ring: number): number[] {
  const { grid } = world;
  const cells: number[] = [];

  for (let rowOffset = -ring; rowOffset <= ring; rowOffset += 1) {
    for (let columnOffset = -ring; columnOffset <= ring; columnOffset += 1) {
      const isOnRing = Math.max(Math.abs(rowOffset), Math.abs(columnOffset)) === ring;
      const column = centerColumn + columnOffset;
      const row = centerRow + rowOffset;

      if (isOnRing && grid.contains(column, row)) {
        cells.push(grid.index(column, row));
      }
    }
  }

  return cells;
}

function nearerPlantInCell(world: WorldState, cell: number, search: PlantSearch, nearest: NearestPlant): NearestPlant {
  const { fields, vegetation } = world;

  if (fields.fire[cell] > 0 || fields.heat[cell] > HOT_GROUND) {
    return nearest;
  }

  let result = nearest;

  for (let plant = vegetation.firstPlantInCell(cell); plant !== NO_PLANT; plant = vegetation.nextPlantInCell(plant)) {
    const distanceSquared = (vegetation.x[plant] - search.x) ** 2 + (vegetation.z[plant] - search.z) ** 2;

    if (distanceSquared < result.distanceSquared && search.accepts(plant)) {
      result = { distanceSquared, plant };
    }
  }

  return result;
}

export function nearestQuarry(world: WorldState, x: number, z: number, radius: number): Waypoint | null {
  const { grid } = world;

  const centerColumn = grid.columnAt(x);
  const centerRow = grid.rowAt(z);

  const ringCount = Math.ceil(radius / grid.cellSize);

  for (let ring = 2; ring <= ringCount; ring += 2) {
    for (let step = 0; step < ring * 4; step += 1) {
      const angle = (step / (ring * 4)) * FULL_TURN;

      const column = centerColumn + Math.round(Math.cos(angle) * ring);
      const row = centerRow + Math.round(Math.sin(angle) * ring);

      if (isQuarry(world, column, row)) {
        return { x: grid.centerX(column), z: grid.centerZ(row) };
      }
    }
  }

  return null;
}

function isQuarry(world: WorldState, column: number, row: number): boolean {
  const { grid } = world;

  if (column < 1 || row < 1 || column >= grid.cellsPerSide - 1 || row >= grid.cellsPerSide - 1) {
    return false;
  }

  const cell = grid.index(column, row);

  if (world.isWater(cell) || world.slope(cell) > QUARRY_SLOPE) {
    return false;
  }

  const ground = world.terrain.ground[cell];

  if (ground === Ground.Rock || ground === Ground.RedRock) {
    return true;
  }

  return ORTHOGONAL_STEPS.some(
    ([columnStep, rowStep]) => world.slope(grid.index(column + columnStep, row + rowStep)) > CLIFF_SLOPE
  );
}

export function nearestShore(
  world: WorldState,
  origin: Waypoint,
  radius: number,
  random: RandomSource
): ShoreSpot | null {
  for (let attempt = 0; attempt < SHORE_ATTEMPTS; attempt += 1) {
    const angle = random.next() * FULL_TURN;
    const distance = 20 + random.next() * radius;

    const spot = shoreSpotAt(world, origin.x + Math.cos(angle) * distance, origin.z + Math.sin(angle) * distance);

    if (spot !== null) {
      return spot;
    }
  }

  return null;
}

function shoreSpotAt(world: WorldState, x: number, z: number): ShoreSpot | null {
  const { grid } = world;

  const cell = grid.cellAt(x, z);

  if (cell < 0 || world.isWater(cell)) {
    return null;
  }

  for (const [columnStep, rowStep] of ORTHOGONAL_STEPS) {
    const column = grid.columnOf(cell) + columnStep;
    const row = grid.rowOf(cell) + rowStep;

    if (isFishingWater(world, column, row)) {
      const reachTowardsWater = grid.cellSize * SHORE_REACH;

      return {
        waterX: grid.centerX(column),
        waterZ: grid.centerZ(row),
        x: grid.cellCenterX(cell) + columnStep * reachTowardsWater,
        z: grid.cellCenterZ(cell) + rowStep * reachTowardsWater,
      };
    }
  }

  return null;
}

function isFishingWater(world: WorldState, column: number, row: number): boolean {
  if (!world.grid.contains(column, row)) {
    return false;
  }

  const cell = world.grid.index(column, row);

  return world.isWater(cell) && world.waterDepth(cell) > FISHING_DEPTH;
}

import { plantSpeciesDefinition, woodlandShare } from "../content/plants.ts";
import { hashToUnit } from "../shared/math.ts";
import { hasRoomFromCoast, isOnIsland } from "./coast.ts";
import { type SampledTerrain, touchesWaterCell } from "./terrain-sampling.ts";
import type { WorldGrid } from "./world-grid.ts";

export interface FootingTerrain extends SampledTerrain {
  readonly coastDistance: Float32Array;
}

export interface WildTerrain extends FootingTerrain {
  readonly woodland: Float32Array;
}

const STAND_SALT = 19.19;

export function slopeAt(heights: Float32Array, grid: WorldGrid, cell: number): number {
  const { cellSize } = grid;

  const column = grid.columnOf(cell);
  const row = grid.rowOf(cell);
  const last = grid.cellsPerSide - 1;

  const east = heights[grid.index(Math.min(last, column + 1), row)];
  const west = heights[grid.index(Math.max(0, column - 1), row)];
  const south = heights[grid.index(column, Math.min(last, row + 1))];
  const north = heights[grid.index(column, Math.max(0, row - 1))];

  return Math.hypot((east - west) / (2 * cellSize), (south - north) / (2 * cellSize));
}

export function isOpenGround(terrain: FootingTerrain, grid: WorldGrid, cell: number): boolean {
  if (!isOnIsland(terrain.coastDistance, cell) || grid.isOnEdge(cell)) {
    return false;
  }

  return !touchesWaterCell(terrain, grid, cell);
}

export function canStandOn(terrain: FootingTerrain, grid: WorldGrid, cell: number, steepestSlope: number): boolean {
  return isOpenGround(terrain, grid, cell) && slopeAt(terrain.height, grid, cell) <= steepestSlope;
}

export function admitsWildPlant(terrain: WildTerrain, grid: WorldGrid, cell: number, species: number): boolean {
  const share = woodlandShare(species, terrain.woodland[cell]);

  return hashToUnit(grid.columnOf(cell), grid.rowOf(cell), STAND_SALT) < share;
}

export function canGrowWild(terrain: WildTerrain, grid: WorldGrid, cell: number, species: number): boolean {
  const { steepestSlope } = plantSpeciesDefinition(species);

  return canStandOn(terrain, grid, cell, steepestSlope) && admitsWildPlant(terrain, grid, cell, species);
}

export function hasRoomToGrow(terrain: WildTerrain, grid: WorldGrid, x: number, z: number, species: number): boolean {
  const cell = grid.cellAt(x, z);

  return canGrowWild(terrain, grid, cell, species) && hasRoomFromCoast(terrain.coastDistance, grid, x, z);
}

import { isOnIsland } from "./coast.ts";
import { type SampledTerrain, touchesWaterCell } from "./terrain-sampling.ts";
import type { WorldGrid } from "./world-grid.ts";

export interface FootingTerrain extends SampledTerrain {
  readonly coastDistance: Float32Array;
}

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

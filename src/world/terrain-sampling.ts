import { clamp } from "../shared/math.ts";
import { hasWater, NO_WATER } from "./water.ts";
import { NEIGHBOR_OFFSETS, type WorldGrid } from "./world-grid.ts";

export interface SampledTerrain {
  readonly height: Float32Array;
  readonly waterSurface: Float32Array;
}

export function sampleHeight(heights: Float32Array, grid: WorldGrid, x: number, z: number): number {
  const { cellsPerSide, cellSize, halfSize } = grid;

  const gridX = clamp((x + halfSize) / cellSize - 0.5, 0, cellsPerSide - 1.001);
  const gridZ = clamp((z + halfSize) / cellSize - 0.5, 0, cellsPerSide - 1.001);

  const column = Math.floor(gridX);
  const row = Math.floor(gridZ);

  const amountX = gridX - column;
  const amountZ = gridZ - row;
  const cell = grid.index(column, row);

  const near = heights[cell] * (1 - amountX) + heights[cell + 1] * amountX;
  const far = heights[cell + cellsPerSide] * (1 - amountX) + heights[cell + cellsPerSide + 1] * amountX;

  return near * (1 - amountZ) + far * amountZ;
}

export function sampleSurface(terrain: SampledTerrain, grid: WorldGrid, x: number, z: number): number {
  const ground = sampleHeight(terrain.height, grid, x, z);
  const cell = grid.cellAt(x, z);

  if (cell < 0) {
    return ground;
  }

  const waterSurface = terrain.waterSurface[cell];

  if (waterSurface === NO_WATER || waterSurface <= ground) {
    return ground;
  }

  return waterSurface;
}

export function sampleWaterLevel(terrain: SampledTerrain, grid: WorldGrid, x: number, z: number): number {
  const { cellsPerSide, cellSize, halfSize } = grid;

  if (!isWaterAtPoint(terrain, grid, x, z)) {
    return NO_WATER;
  }

  const gridX = clamp((x + halfSize) / cellSize - 0.5, 0, cellsPerSide - 1.001);
  const gridZ = clamp((z + halfSize) / cellSize - 0.5, 0, cellsPerSide - 1.001);

  const column = Math.floor(gridX);
  const row = Math.floor(gridZ);

  const amountX = gridX - column;
  const amountZ = gridZ - row;
  const cell = grid.index(column, row);

  const corners = [
    { cell, weight: (1 - amountX) * (1 - amountZ) },
    { cell: cell + 1, weight: amountX * (1 - amountZ) },
    { cell: cell + cellsPerSide, weight: (1 - amountX) * amountZ },
    { cell: cell + cellsPerSide + 1, weight: amountX * amountZ },
  ];

  let level = 0;
  let weight = 0;

  for (const corner of corners) {
    if (isWaterCell(terrain, corner.cell)) {
      level += terrain.waterSurface[corner.cell] * corner.weight;
      weight += corner.weight;
    }
  }

  return weight > 0 ? level / weight : NO_WATER;
}

export function isWaterCell(terrain: SampledTerrain, cell: number): boolean {
  return hasWater(terrain.waterSurface[cell], terrain.height[cell]);
}

export function isWaterAtPoint(terrain: SampledTerrain, grid: WorldGrid, x: number, z: number): boolean {
  const cell = grid.cellAt(x, z);

  if (cell < 0) {
    return false;
  }

  return isWaterCell(terrain, cell);
}

export function touchesWaterCell(terrain: SampledTerrain, grid: WorldGrid, cell: number): boolean {
  if (isWaterCell(terrain, cell)) {
    return true;
  }

  const column = grid.columnOf(cell);
  const row = grid.rowOf(cell);

  for (const offset of NEIGHBOR_OFFSETS) {
    const neighborColumn = column + offset.column;
    const neighborRow = row + offset.row;

    if (grid.contains(neighborColumn, neighborRow) && isWaterCell(terrain, grid.index(neighborColumn, neighborRow))) {
      return true;
    }
  }

  return false;
}

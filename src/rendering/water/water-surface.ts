import { clamp } from "../../shared/math.ts";
import type { SampledTerrain } from "../../world/terrain-sampling.ts";
import { NO_WATER } from "../../world/water.ts";
import type { WorldGrid } from "../../world/world-grid.ts";
import { BANK_SINK, PRESENT_LEVEL } from "./shore-field.ts";

const BESIDE = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

const DIAGONAL = [
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
] as const;

function levelAt(terrain: SampledTerrain, grid: WorldGrid, column: number, row: number): number {
  const last = grid.cellsPerSide - 1;

  return terrain.waterSurface[grid.index(clamp(column, 0, last), clamp(row, 0, last))];
}

function highestLevel(
  terrain: SampledTerrain,
  grid: WorldGrid,
  column: number,
  row: number,
  offsets: readonly (readonly [number, number])[]
): number {
  let highest = Number.NEGATIVE_INFINITY;

  for (const [columnOffset, rowOffset] of offsets) {
    highest = Math.max(highest, levelAt(terrain, grid, column + columnOffset, row + rowOffset));
  }

  return highest;
}

export function waterVertexLevel(terrain: SampledTerrain, grid: WorldGrid, column: number, row: number): number {
  const own = levelAt(terrain, grid, column, row);

  if (own > PRESENT_LEVEL) {
    return own;
  }

  const beside = highestLevel(terrain, grid, column, row, BESIDE);
  const nearest = Math.max(beside, highestLevel(terrain, grid, column, row, DIAGONAL));

  if (nearest <= PRESENT_LEVEL) {
    return NO_WATER;
  }

  const ground = terrain.height[grid.index(column, row)];

  return Math.min(beside > PRESENT_LEVEL ? beside : nearest, ground - BANK_SINK);
}

export function sampleWaterSurface(terrain: SampledTerrain, grid: WorldGrid, x: number, z: number): number {
  const { cellsPerSide, cellSize, halfSize } = grid;

  const gridX = clamp((x + halfSize) / cellSize - 0.5, 0, cellsPerSide - 1.001);
  const gridZ = clamp((z + halfSize) / cellSize - 0.5, 0, cellsPerSide - 1.001);

  const column = Math.floor(gridX);
  const row = Math.floor(gridZ);

  const amountX = gridX - column;
  const amountZ = gridZ - row;

  const corners = [
    waterVertexLevel(terrain, grid, column, row),
    waterVertexLevel(terrain, grid, column + 1, row),
    waterVertexLevel(terrain, grid, column, row + 1),
    waterVertexLevel(terrain, grid, column + 1, row + 1),
  ];

  if (corners.some((level) => level === NO_WATER)) {
    return NO_WATER;
  }

  const [first, right, below, diagonal] = corners;

  const near = first * (1 - amountX) + right * amountX;
  const far = below * (1 - amountX) + diagonal * amountX;

  return near * (1 - amountZ) + far * amountZ;
}

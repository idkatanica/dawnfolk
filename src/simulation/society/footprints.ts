import type { WorldGrid } from "../../world/world-grid.ts";
import type { Waypoint } from "../agents/navigation.ts";
import type { WorldState } from "../world/world-state.ts";

function distanceToCell(grid: WorldGrid, column: number, row: number, x: number, z: number): number {
  const halfCell = grid.cellSize / 2;

  const nearestX = Math.max(Math.abs(x - grid.centerX(column)) - halfCell, 0);
  const nearestZ = Math.max(Math.abs(z - grid.centerZ(row)) - halfCell, 0);

  return Math.hypot(nearestX, nearestZ);
}

export function footprintCells(grid: WorldGrid, x: number, z: number, radius: number): number[] {
  if (radius <= 0) {
    return [];
  }

  const cells: number[] = [];
  const firstColumn = Math.max(0, grid.columnAt(x - radius));
  const lastColumn = Math.min(grid.cellsPerSide - 1, grid.columnAt(x + radius));
  const firstRow = Math.max(0, grid.rowAt(z - radius));
  const lastRow = Math.min(grid.cellsPerSide - 1, grid.rowAt(z + radius));

  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      if (distanceToCell(grid, column, row, x, z) < radius) {
        cells.push(grid.index(column, row));
      }
    }
  }

  return cells;
}

export function isDryWay(world: WorldState, from: Waypoint, to: Waypoint): boolean {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const samples = Math.max(1, Math.ceil(distance / (world.grid.cellSize / 2)));

  for (let sample = 0; sample <= samples; sample += 1) {
    const share = sample / samples;
    const cell = world.grid.cellAt(from.x + (to.x - from.x) * share, from.z + (to.z - from.z) * share);

    if (cell >= 0 && world.isWater(cell)) {
      return false;
    }
  }

  return true;
}

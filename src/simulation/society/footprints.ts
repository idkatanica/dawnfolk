import type { WorldGrid } from "../../world/world-grid.ts";

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

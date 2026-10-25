import type { WorldGrid } from "../../world/world-grid.ts";
import type { Waypoint } from "../agents/navigation.ts";
import type { WorldState } from "../world/world-state.ts";

export function distanceToCell(grid: WorldGrid, cell: number, x: number, z: number, slack: number): number {
  const nearestX = Math.max(Math.abs(x - grid.cellCenterX(cell)) - slack, 0);
  const nearestZ = Math.max(Math.abs(z - grid.cellCenterZ(cell)) - slack, 0);

  return Math.hypot(nearestX, nearestZ);
}

export function cellsNear(grid: WorldGrid, x: number, z: number, radius: number, slack: number): number[] {
  const cells: number[] = [];
  const bounds = grid.circleBounds(x, z, radius + slack);

  for (let row = bounds.firstRow; row <= bounds.lastRow; row += 1) {
    for (let column = bounds.firstColumn; column <= bounds.lastColumn; column += 1) {
      const cell = grid.index(column, row);

      if (distanceToCell(grid, cell, x, z, slack) < radius) {
        cells.push(cell);
      }
    }
  }

  return cells;
}

export function footprintCells(grid: WorldGrid, x: number, z: number, radius: number): number[] {
  return cellsNear(grid, x, z, radius, grid.cellSize / 2);
}

export function isDryWay(world: WorldState, from: Waypoint, to: Waypoint): boolean {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const samples = Math.max(1, Math.ceil(distance / (world.grid.cellSize / 2)));

  for (let sample = 0; sample <= samples; sample += 1) {
    const share = sample / samples;
    const cell = world.grid.cellAt(from.x + (to.x - from.x) * share, from.z + (to.z - from.z) * share);

    if (cell >= 0 && (world.isWater(cell) || world.isObstructed(cell))) {
      return false;
    }
  }

  return true;
}

import { BUILDINGS, type BuildingKind, isEnclosure } from "../../content/buildings.ts";
import { pondShoreReach } from "../../generation/ponds.ts";
import { NEIGHBOR_OFFSETS, type WorldGrid } from "../../world/world-grid.ts";
import type { Waypoint } from "../agents/navigation.ts";
import { levelGround } from "../world/terrain-editing.ts";
import { CROSSING_GROUND, MONUMENT_GROUND, SPRING_GROUND, type WorldState } from "../world/world-state.ts";
import type { Building } from "./buildings.ts";

export const DEEPEST_LEVELLING = 1.5;
const KEPT_RELIEF = 0.04;

const COAST_CLEARANCE = 30;
const POOLING_DEPTH = 0.5;

export interface BuildingPad {
  readonly cells: readonly number[];
  readonly level: number;
  readonly unevenness: number;
}

export function isLevelled(kind: BuildingKind): boolean {
  return kind !== "mine" && !isEnclosure(kind);
}

function shapesFootprint(grid: WorldGrid, cell: number, spot: Waypoint, footprint: number): boolean {
  const nearestX = Math.max(Math.abs(spot.x - grid.cellCenterX(cell)) - grid.cellSize, 0);
  const nearestZ = Math.max(Math.abs(spot.z - grid.cellCenterZ(cell)) - grid.cellSize, 0);

  return Math.hypot(nearestX, nearestZ) < footprint;
}

export function groundUnderFootprint(grid: WorldGrid, spot: Waypoint, footprint: number): number[] {
  if (footprint <= 0) {
    return [];
  }

  const reach = footprint + grid.cellSize;
  const lastIndex = grid.cellsPerSide - 1;

  const firstColumn = Math.max(0, grid.columnAt(spot.x - reach));
  const lastColumn = Math.min(lastIndex, grid.columnAt(spot.x + reach));
  const firstRow = Math.max(0, grid.rowAt(spot.z - reach));
  const lastRow = Math.min(lastIndex, grid.rowAt(spot.z + reach));

  const cells: number[] = [];

  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const cell = grid.index(column, row);

      if (shapesFootprint(grid, cell, spot, footprint)) {
        cells.push(cell);
      }
    }
  }

  return cells;
}

function canReshape(world: WorldState, cell: number): boolean {
  const occupant = world.occupancy[cell];

  if (occupant === MONUMENT_GROUND || occupant === SPRING_GROUND || occupant === CROSSING_GROUND) {
    return false;
  }

  return world.terrain.coastDistance[cell] > COAST_CLEARANCE && !world.touchesWater(cell) && !isPondShore(world, cell);
}

function isPondShore(world: WorldState, cell: number): boolean {
  const { grid } = world;

  return world.water.springs.some(
    (spring) =>
      spring.kind === "pond" &&
      Math.hypot(grid.cellCenterX(cell) - spring.x, grid.cellCenterZ(cell) - spring.z) <
        pondShoreReach(spring) + grid.cellSize
  );
}

function isHeldByOther(grid: WorldGrid, cell: number, buildings: readonly Building[]): boolean {
  return buildings.some(
    (building) =>
      !isEnclosure(building.kind) && shapesFootprint(grid, cell, building, BUILDINGS[building.kind].footprint)
  );
}

function lowestAround(world: WorldState, cells: readonly number[]): number {
  const { grid } = world;

  const inside = new Set(cells);

  let lowest = Number.POSITIVE_INFINITY;

  for (const cell of cells) {
    for (const offset of NEIGHBOR_OFFSETS) {
      const column = grid.columnOf(cell) + offset.column;
      const row = grid.rowOf(cell) + offset.row;

      if (grid.contains(column, row) && !inside.has(grid.index(column, row))) {
        lowest = Math.min(lowest, world.terrain.height[grid.index(column, row)]);
      }
    }
  }

  return lowest;
}

export function planPad(
  world: WorldState,
  buildings: readonly Building[],
  spot: Waypoint,
  kind: BuildingKind
): BuildingPad | null {
  const cells = groundUnderFootprint(world.grid, spot, BUILDINGS[kind].footprint);

  if (cells.length === 0 || !cells.every((cell) => canReshape(world, cell))) {
    return null;
  }

  const heights = cells.map((cell) => world.terrain.height[cell]);
  const level = heights.reduce((total, height) => total + height, 0) / heights.length;

  if (lowestAround(world, cells) > level + POOLING_DEPTH) {
    return null;
  }

  return {
    cells: cells.filter((cell) => !isHeldByOther(world.grid, cell, buildings)),
    level,
    unevenness: Math.max(...heights.map((height) => Math.abs(height - level))),
  };
}

export function levelPad(world: WorldState, pad: BuildingPad): void {
  levelGround(world, pad.cells, { keptRelief: KEPT_RELIEF, largestChange: DEEPEST_LEVELLING, level: pad.level });
}

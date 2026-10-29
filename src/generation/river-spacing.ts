import type { WorldGrid } from "../world/world-grid.ts";
import {
  type DrainageBasins,
  isNearLake,
  NO_CELL,
  type RiverChain,
  riverWidthFor,
  touchesOffIsland,
} from "./hydrology.ts";

const SMALLEST_SPACING = 40;
const SPACING_WIDTHS = 2.5;
const LARGEST_SPACING = 65;
const SPACING_CELLS = 1.5;
const HEAD_CLEARANCE = 60;
const NATURAL_APPROACH = 2;
const SHORTEST_RIVER = 150;

export interface RiverLand {
  readonly basins: DrainageBasins;
  readonly coastDistance: Float32Array;
  readonly grid: WorldGrid;
  readonly heights: Float32Array;
}

interface Spacing extends RiverLand {
  readonly owners: Int32Array;
  readonly reach: number;
}

interface NearbyRiver {
  readonly cell: number;
  readonly distance: number;
}

function pathLength(grid: WorldGrid, cells: readonly number[]): number {
  let length = 0;

  for (let index = 1; index < cells.length; index += 1) {
    length += grid.distanceBetween(cells[index - 1], cells[index]);
  }

  return length;
}

function widthAt(spacing: Spacing, cell: number): number {
  const { basins } = spacing;

  return riverWidthFor(basins.network.accumulation[cell], basins.riverThreshold);
}

function spacingBetween(spacing: Spacing, cell: number, other: number): number {
  const wider = Math.max(widthAt(spacing, cell), widthAt(spacing, other));

  return Math.max(
    SMALLEST_SPACING,
    spacing.grid.cellSize * SPACING_CELLS,
    Math.min(LARGEST_SPACING, SPACING_WIDTHS * wider)
  );
}

function nearestRiver(spacing: Spacing, cell: number, isAllowed: (other: number) => boolean): NearbyRiver | null {
  const { grid, owners } = spacing;

  const reach = Math.ceil(spacing.reach / grid.cellSize);
  const column = grid.columnOf(cell);
  const row = grid.rowOf(cell);

  let nearest: NearbyRiver | null = null;

  for (let rowOffset = -reach; rowOffset <= reach; rowOffset += 1) {
    for (let columnOffset = -reach; columnOffset <= reach; columnOffset += 1) {
      if (!grid.contains(column + columnOffset, row + rowOffset)) {
        continue;
      }

      const other = grid.index(column + columnOffset, row + rowOffset);

      if (owners[other] === NO_CELL || !isAllowed(other)) {
        continue;
      }

      const distance = grid.distanceBetween(cell, other);

      if (nearest === null || distance < nearest.distance) {
        nearest = { cell: other, distance };
      }
    }
  }

  return nearest;
}

function anyRiver(): boolean {
  return true;
}

function followToRiver(spacing: Spacing, chain: RiverChain): RiverChain {
  const { lakeIds, network } = spacing.basins;

  if (chain.joinsCell === NO_CELL || spacing.owners[chain.joinsCell] !== NO_CELL) {
    return chain;
  }

  const cells = [...chain.cells];

  for (let cell = chain.joinsCell; cell !== NO_CELL; cell = network.receivers[cell]) {
    if (spacing.owners[cell] !== NO_CELL) {
      return { cells, joinsCell: cell, mouthReceiver: cell };
    }

    if (lakeIds[cell] !== NO_CELL) {
      return { cells, joinsCell: NO_CELL, mouthReceiver: cell };
    }

    cells.push(cell);
  }

  return { cells, joinsCell: NO_CELL, mouthReceiver: NO_CELL };
}

function endAtCoast(spacing: Spacing, chain: RiverChain): RiverChain {
  const { coastDistance, grid } = spacing;

  if (chain.joinsCell !== NO_CELL || chain.mouthReceiver !== NO_CELL) {
    return chain;
  }

  const mouth = chain.cells.findIndex((cell) => {
    return grid.isOnEdge(cell) || touchesOffIsland(grid, coastDistance, cell);
  });

  if (mouth < 0) {
    return chain;
  }

  return { ...chain, cells: chain.cells.slice(0, mouth + 1) };
}

function clearHead(spacing: Spacing, cells: readonly number[]): number {
  const clearance = Math.max(HEAD_CLEARANCE, spacing.grid.cellSize * SPACING_CELLS);

  return cells.findIndex((cell) => {
    const nearest = nearestRiver(spacing, cell, anyRiver);

    return nearest === null || nearest.distance >= clearance;
  });
}

function isNaturalConfluence(spacing: Spacing, chain: RiverChain, from: number): boolean {
  const { grid } = spacing;

  if (chain.joinsCell === NO_CELL) {
    return false;
  }

  const approach = [...chain.cells.slice(from), chain.joinsCell];
  const closest = spacingBetween(spacing, chain.cells[from], chain.joinsCell);

  return pathLength(grid, approach) <= NATURAL_APPROACH * closest;
}

function junctionFor(spacing: Spacing, cell: number): number {
  const { heights } = spacing;

  const nearest = nearestRiver(spacing, cell, anyRiver);

  if (nearest === null || nearest.distance >= spacingBetween(spacing, cell, nearest.cell)) {
    return NO_CELL;
  }

  const lower = nearestRiver(spacing, cell, (other) => {
    return heights[other] <= heights[cell];
  });

  if (lower === null || lower.distance >= spacingBetween(spacing, cell, lower.cell)) {
    return NO_CELL;
  }

  return lower.cell;
}

function spacedChain(spacing: Spacing, chain: RiverChain): RiverChain | null {
  const followed = endAtCoast(spacing, followToRiver(spacing, chain));

  const head = clearHead(spacing, followed.cells);

  if (head < 0) {
    return null;
  }

  for (let index = head; index < followed.cells.length; index += 1) {
    if (isNaturalConfluence(spacing, followed, index)) {
      break;
    }

    const junction = junctionFor(spacing, followed.cells[index]);

    if (junction !== NO_CELL) {
      return { cells: followed.cells.slice(head, index + 1), joinsCell: junction, mouthReceiver: junction };
    }
  }

  return { ...followed, cells: followed.cells.slice(head) };
}

function isFedByLake(spacing: Spacing, chain: RiverChain): boolean {
  const { basins, grid } = spacing;

  const [head] = chain.cells;

  return isNearLake(
    grid,
    basins.lakeIds,
    grid.cellCenterX(head),
    grid.cellCenterZ(head),
    grid.cellSize * SPACING_CELLS
  );
}

function isLongEnough(spacing: Spacing, chain: RiverChain): boolean {
  const cells = chain.joinsCell === NO_CELL ? chain.cells : [...chain.cells, chain.joinsCell];

  return pathLength(spacing.grid, cells) >= SHORTEST_RIVER || isFedByLake(spacing, chain);
}

function byMouthFlow(basins: DrainageBasins): (first: RiverChain, second: RiverChain) => number {
  const { accumulation } = basins.network;

  function mouthOf(chain: RiverChain): number {
    const mouth = chain.cells.at(-1);

    return mouth === undefined ? NO_CELL : mouth;
  }

  return (first, second) => {
    const difference = accumulation[mouthOf(second)] - accumulation[mouthOf(first)];

    return difference === 0 ? mouthOf(first) - mouthOf(second) : difference;
  };
}

export function spaceRiverChains(land: RiverLand, chains: readonly RiverChain[]): RiverChain[] {
  const { basins, grid } = land;

  const spacing: Spacing = {
    ...land,
    owners: new Int32Array(grid.cellCount).fill(NO_CELL),
    reach: Math.max(LARGEST_SPACING, HEAD_CLEARANCE, grid.cellSize * SPACING_CELLS),
  };

  const spaced: RiverChain[] = [];

  for (const chain of [...chains].sort(byMouthFlow(basins))) {
    const kept = spacedChain(spacing, chain);

    if (kept === null || !isLongEnough(spacing, kept)) {
      continue;
    }

    for (const cell of kept.cells) {
      spacing.owners[cell] = spaced.length;
    }

    spaced.push(kept);
  }

  return spaced;
}

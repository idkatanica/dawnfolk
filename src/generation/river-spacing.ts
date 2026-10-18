import type { WorldGrid } from "../world/world-grid.ts";
import { type DrainageBasins, NO_CELL, type RiverChain, riverWidthFor, touchesOffIsland } from "./hydrology.ts";

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

interface Spacing {
  readonly basins: DrainageBasins;
  readonly coastDistance: Float32Array;
  readonly grid: WorldGrid;
  readonly heights: Float32Array;
  readonly owners: Int32Array;
  readonly reach: number;
}

interface NearbyRiver {
  readonly cell: number;
  readonly distance: number;
}

function cellDistance(grid: WorldGrid, from: number, to: number): number {
  return Math.hypot(grid.cellCenterX(to) - grid.cellCenterX(from), grid.cellCenterZ(to) - grid.cellCenterZ(from));
}

function pathLength(grid: WorldGrid, cells: readonly number[]): number {
  let length = 0;

  for (let index = 1; index < cells.length; index += 1) {
    length += cellDistance(grid, cells[index - 1], cells[index]);
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

      const distance = cellDistance(grid, cell, other);

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

function followToRiver(chain: RiverChain, spacing: Spacing): RiverChain {
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

function endAtCoast(chain: RiverChain, spacing: Spacing): RiverChain {
  const { coastDistance, grid } = spacing;

  if (chain.joinsCell !== NO_CELL || chain.mouthReceiver !== NO_CELL) {
    return chain;
  }

  const mouth = chain.cells.findIndex((cell) => grid.isOnEdge(cell) || touchesOffIsland(cell, grid, coastDistance));

  if (mouth < 0) {
    return chain;
  }

  return { ...chain, cells: chain.cells.slice(0, mouth + 1) };
}

function clearHead(cells: readonly number[], spacing: Spacing): number {
  const clearance = Math.max(HEAD_CLEARANCE, spacing.grid.cellSize * SPACING_CELLS);

  return cells.findIndex((cell) => {
    const nearest = nearestRiver(spacing, cell, anyRiver);

    return nearest === null || nearest.distance >= clearance;
  });
}

function isNaturalConfluence(chain: RiverChain, from: number, spacing: Spacing): boolean {
  const { grid } = spacing;

  if (chain.joinsCell === NO_CELL) {
    return false;
  }

  const approach = [...chain.cells.slice(from), chain.joinsCell];
  const closest = spacingBetween(spacing, chain.cells[from], chain.joinsCell);

  return pathLength(grid, approach) <= NATURAL_APPROACH * closest;
}

function junctionFor(cell: number, spacing: Spacing): number {
  const { heights } = spacing;

  const nearest = nearestRiver(spacing, cell, anyRiver);

  if (nearest === null || nearest.distance >= spacingBetween(spacing, cell, nearest.cell)) {
    return NO_CELL;
  }

  const lower = nearestRiver(spacing, cell, (other) => heights[other] <= heights[cell]);

  if (lower === null || lower.distance >= spacingBetween(spacing, cell, lower.cell)) {
    return NO_CELL;
  }

  return lower.cell;
}

function spacedChain(chain: RiverChain, spacing: Spacing): RiverChain | null {
  const followed = endAtCoast(followToRiver(chain, spacing), spacing);

  const head = clearHead(followed.cells, spacing);

  if (head < 0) {
    return null;
  }

  for (let index = head; index < followed.cells.length; index += 1) {
    if (isNaturalConfluence(followed, index, spacing)) {
      break;
    }

    const junction = junctionFor(followed.cells[index], spacing);

    if (junction !== NO_CELL) {
      return { cells: followed.cells.slice(head, index + 1), joinsCell: junction, mouthReceiver: junction };
    }
  }

  return { ...followed, cells: followed.cells.slice(head) };
}

function isFedByLake(chain: RiverChain, spacing: Spacing): boolean {
  const { basins, grid } = spacing;

  const [head] = chain.cells;

  if (head === undefined) {
    return false;
  }

  return grid
    .cellsInRadius(grid.cellCenterX(head), grid.cellCenterZ(head), grid.cellSize * SPACING_CELLS)
    .some((cell) => basins.lakeIds[cell] !== NO_CELL);
}

function isLongEnough(chain: RiverChain, spacing: Spacing): boolean {
  const cells = chain.joinsCell === NO_CELL ? chain.cells : [...chain.cells, chain.joinsCell];

  return pathLength(spacing.grid, cells) >= SHORTEST_RIVER || isFedByLake(chain, spacing);
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

export function spaceRiverChains(
  chains: readonly RiverChain[],
  { basins, coastDistance, grid, heights }: RiverLand
): RiverChain[] {
  const spacing: Spacing = {
    basins,
    coastDistance,
    grid,
    heights,
    owners: new Int32Array(grid.cellCount).fill(NO_CELL),
    reach: Math.max(LARGEST_SPACING, HEAD_CLEARANCE, grid.cellSize * SPACING_CELLS),
  };

  const spaced: RiverChain[] = [];

  for (const chain of [...chains].sort(byMouthFlow(basins))) {
    const kept = spacedChain(chain, spacing);

    if (kept === null || kept.cells.length === 0 || !isLongEnough(kept, spacing)) {
      continue;
    }

    for (const cell of kept.cells) {
      spacing.owners[cell] = spaced.length;
    }

    spaced.push(kept);
  }

  return spaced;
}

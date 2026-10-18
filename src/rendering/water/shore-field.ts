import type { CellRegion } from "../../world/change-tracking.ts";
import { NO_WATER } from "../../world/water.ts";

export const PRESENT_LEVEL = NO_WATER / 2;
export const BANK_SINK = 0.3;
export const DRY_DEPTH = -1;
export const MAXIMUM_REACH = 12;
export const SHORE_CHANNELS = 4;

const CORNER_BRIDGE = 0.25;

export const ShoreChannel = {
  Depth: 0,
  FlowX: 1,
  FlowZ: 2,
  Reach: 3,
} as const;

export interface ShoreSource {
  readonly cellSize: number;
  readonly heights: Float32Array;
  readonly levels: Float32Array;
  readonly size: number;
}

function isWet(level: number): boolean {
  return level > PRESENT_LEVEL;
}

function bankLevel(source: ShoreSource, column: number, row: number): number {
  const { levels, size } = source;

  let total = 0;
  let count = 0;
  let highest = NO_WATER;

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      const neighborColumn = Math.min(size - 1, Math.max(0, column + columnOffset));
      const neighborRow = Math.min(size - 1, Math.max(0, row + rowOffset));
      const level = levels[neighborRow * size + neighborColumn];

      if (!isWet(level)) {
        continue;
      }

      highest = Math.max(highest, level);

      if (Math.abs(rowOffset) + Math.abs(columnOffset) === 1) {
        total += level;
        count += 1;
      }
    }
  }

  if (count > 0) {
    return total / count;
  }

  return highest;
}

function wetDepth(source: ShoreSource, column: number, row: number): number {
  const { heights, levels, size } = source;

  if (column < 0 || row < 0 || column >= size || row >= size) {
    return 0;
  }

  const cell = row * size + column;

  if (!isWet(levels[cell])) {
    return 0;
  }

  return Math.max(0, levels[cell] - heights[cell]);
}

function cornerDepth(source: ShoreSource, column: number, row: number): number {
  const west = wetDepth(source, column - 1, row);
  const east = wetDepth(source, column + 1, row);
  const north = wetDepth(source, column, row - 1);
  const south = wetDepth(source, column, row + 1);

  return Math.max(Math.min(west, north), Math.min(north, east), Math.min(east, south), Math.min(south, west));
}

function flowAcross(before: number, after: number, cellSize: number): number {
  if (!(isWet(before) && isWet(after))) {
    return 0;
  }

  return (before - after) / (cellSize * 2);
}

function writeShore(source: ShoreSource, column: number, row: number, target: Float32Array): void {
  const { cellSize, heights, levels, size } = source;
  const cell = row * size + column;
  const offset = cell * SHORE_CHANNELS;
  const level = levels[cell];
  const ground = heights[cell];

  if (isWet(level)) {
    const west = levels[row * size + Math.max(0, column - 1)];
    const east = levels[row * size + Math.min(size - 1, column + 1)];
    const north = levels[Math.max(0, row - 1) * size + column];
    const south = levels[Math.min(size - 1, row + 1) * size + column];

    target[offset + ShoreChannel.Depth] = level - ground;
    target[offset + ShoreChannel.FlowX] = flowAcross(west, east, cellSize);
    target[offset + ShoreChannel.FlowZ] = flowAcross(north, south, cellSize);

    return;
  }

  target[offset + ShoreChannel.FlowX] = 0;
  target[offset + ShoreChannel.FlowZ] = 0;

  if (target[offset + ShoreChannel.Reach] > 1) {
    target[offset + ShoreChannel.Depth] = DRY_DEPTH;

    return;
  }

  const bank = bankLevel(source, column, row);
  const bankDepth = isWet(bank) ? Math.min(bank, ground - BANK_SINK) - ground : DRY_DEPTH;
  const corner = cornerDepth(source, column, row);

  target[offset + ShoreChannel.Depth] = corner > 0 ? Math.max(bankDepth, -CORNER_BRIDGE * corner) : bankDepth;
}

function reachThrough(target: Float32Array, size: number, column: number, row: number): number {
  if (column < 0 || row < 0 || column >= size || row >= size) {
    return MAXIMUM_REACH;
  }

  return target[(row * size + column) * SHORE_CHANNELS + ShoreChannel.Reach] + 1;
}

function sweepReach(target: Float32Array, size: number, direction: 1 | -1): void {
  const first = direction === 1 ? 0 : size - 1;

  for (let row = first; row >= 0 && row < size; row += direction) {
    const previousRow = row - direction;

    for (let column = first; column >= 0 && column < size; column += direction) {
      const offset = (row * size + column) * SHORE_CHANNELS + ShoreChannel.Reach;
      const previousColumn = column - direction;
      const nextColumn = column + direction;

      target[offset] = Math.min(
        target[offset],
        reachThrough(target, size, previousColumn, row),
        reachThrough(target, size, previousColumn, previousRow),
        reachThrough(target, size, column, previousRow),
        reachThrough(target, size, nextColumn, previousRow)
      );
    }
  }
}

function writeShores(source: ShoreSource, region: CellRegion, target: Float32Array): void {
  for (let row = region.firstRow; row <= region.lastRow; row += 1) {
    for (let column = region.firstColumn; column <= region.lastColumn; column += 1) {
      writeShore(source, column, row, target);
    }
  }
}

export function buildShoreField(source: ShoreSource, target: Float32Array): void {
  const { levels, size } = source;

  for (let cell = 0; cell < size * size; cell += 1) {
    target[cell * SHORE_CHANNELS + ShoreChannel.Reach] = isWet(levels[cell]) ? 0 : MAXIMUM_REACH;
  }

  sweepReach(target, size, 1);
  sweepReach(target, size, -1);
  writeShores(source, { firstColumn: 0, firstRow: 0, lastColumn: size - 1, lastRow: size - 1 }, target);
}

export function updateShoreDepths(source: ShoreSource, region: CellRegion, target: Float32Array): void {
  const last = source.size - 1;

  writeShores(
    source,
    {
      firstColumn: Math.max(0, region.firstColumn - 1),
      firstRow: Math.max(0, region.firstRow - 1),
      lastColumn: Math.min(last, region.lastColumn + 1),
      lastRow: Math.min(last, region.lastRow + 1),
    },
    target
  );
}

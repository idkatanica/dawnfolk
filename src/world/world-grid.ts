import type { CellRegion } from "./change-tracking.ts";

export interface GridDimensions {
  cellSize: number;
  cellsPerSide: number;
}

export const DEFAULT_GRID_DIMENSIONS: GridDimensions = { cellSize: 10, cellsPerSide: 512 };

const SQUARE_METERS_PER_SQUARE_KILOMETER = 1_000_000;

interface NeighborOffset {
  column: number;
  distance: number;
  row: number;
}

export const NEIGHBOR_OFFSETS: readonly NeighborOffset[] = [
  { column: 1, distance: 1, row: 0 },
  { column: -1, distance: 1, row: 0 },
  { column: 0, distance: 1, row: 1 },
  { column: 0, distance: 1, row: -1 },
  { column: 1, distance: Math.SQRT2, row: 1 },
  { column: 1, distance: Math.SQRT2, row: -1 },
  { column: -1, distance: Math.SQRT2, row: 1 },
  { column: -1, distance: Math.SQRT2, row: -1 },
];

export class WorldGrid {
  readonly cellCount: number;
  readonly cellSize: number;
  readonly cellsPerSide: number;
  readonly halfSize: number;
  readonly squareKilometers: number;
  readonly worldSize: number;

  constructor(dimensions: GridDimensions) {
    this.cellsPerSide = dimensions.cellsPerSide;
    this.cellSize = dimensions.cellSize;
    this.cellCount = dimensions.cellsPerSide * dimensions.cellsPerSide;
    this.worldSize = dimensions.cellsPerSide * dimensions.cellSize;
    this.halfSize = this.worldSize / 2;
    this.squareKilometers = (this.worldSize * this.worldSize) / SQUARE_METERS_PER_SQUARE_KILOMETER;
  }

  index(column: number, row: number): number {
    return row * this.cellsPerSide + column;
  }

  columnOf(cellIndex: number): number {
    return cellIndex % this.cellsPerSide;
  }

  rowOf(cellIndex: number): number {
    return Math.floor(cellIndex / this.cellsPerSide);
  }

  isOnEdge(cellIndex: number): boolean {
    const column = this.columnOf(cellIndex);
    const row = this.rowOf(cellIndex);
    const last = this.cellsPerSide - 1;

    return column === 0 || row === 0 || column === last || row === last;
  }

  contains(column: number, row: number): boolean {
    return column >= 0 && row >= 0 && column < this.cellsPerSide && row < this.cellsPerSide;
  }

  columnAt(x: number): number {
    return Math.floor((x + this.halfSize) / this.cellSize);
  }

  rowAt(z: number): number {
    return Math.floor((z + this.halfSize) / this.cellSize);
  }

  cellAt(x: number, z: number): number {
    const column = this.columnAt(x);
    const row = this.rowAt(z);

    if (!this.contains(column, row)) {
      return -1;
    }

    return this.index(column, row);
  }

  centerX(column: number): number {
    return -this.halfSize + (column + 0.5) * this.cellSize;
  }

  centerZ(row: number): number {
    return -this.halfSize + (row + 0.5) * this.cellSize;
  }

  cellCenterX(cellIndex: number): number {
    return this.centerX(this.columnOf(cellIndex));
  }

  cellCenterZ(cellIndex: number): number {
    return this.centerZ(this.rowOf(cellIndex));
  }

  isInside(x: number, z: number, margin: number): boolean {
    const limit = this.halfSize - margin;

    return Math.abs(x) < limit && Math.abs(z) < limit;
  }

  cellsAlong(fromX: number, fromZ: number, toX: number, toZ: number): number[] {
    const cells: number[] = [];

    this.#walk(fromX, fromZ, toX, toZ, false, (cell) => {
      cells.push(cell);

      return true;
    });

    return cells;
  }

  someCellAlong(fromX: number, fromZ: number, toX: number, toZ: number, predicate: (cell: number) => boolean): boolean {
    let isFound = false;

    this.#walk(fromX, fromZ, toX, toZ, false, (cell) => {
      isFound = predicate(cell);

      return !isFound;
    });

    return isFound;
  }

  traceAlong(
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
    visit: (cell: number, enter: number, leave: number) => boolean
  ): boolean {
    return this.#walk(fromX, fromZ, toX, toZ, true, visit);
  }

  #walk(
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
    stopsAtSegmentEnd: boolean,
    visit: (cell: number, enter: number, leave: number) => boolean
  ): boolean {
    const deltaX = toX - fromX;
    const deltaZ = toZ - fromZ;
    const stepColumn = Math.sign(deltaX);
    const stepRow = Math.sign(deltaZ);
    const strideX = deltaX === 0 ? Number.POSITIVE_INFINITY : this.cellSize / Math.abs(deltaX);
    const strideZ = deltaZ === 0 ? Number.POSITIVE_INFINITY : this.cellSize / Math.abs(deltaZ);
    const lastColumn = this.columnAt(toX);
    const lastRow = this.rowAt(toZ);

    let column = this.columnAt(fromX);
    let row = this.rowAt(fromZ);
    let crossingX = this.#firstCrossing(fromX, deltaX, column, stepColumn);
    let crossingZ = this.#firstCrossing(fromZ, deltaZ, row, stepRow);
    let entered = 0;

    while (this.contains(column, row)) {
      const isLast = column === lastColumn && row === lastRow;
      const left = isLast ? 1 : Math.min(crossingX, crossingZ, 1);

      if (!visit(this.index(column, row), entered, left)) {
        return false;
      }

      if (isLast) {
        return true;
      }

      if (stopsAtSegmentEnd && left >= 1) {
        return true;
      }

      entered = left;

      if (crossingX < crossingZ) {
        column += stepColumn;
        crossingX += strideX;
      } else {
        row += stepRow;
        crossingZ += strideZ;
      }

      if (Math.min(crossingX, crossingZ) > 1 + strideX + strideZ) {
        return true;
      }
    }

    return false;
  }

  #firstCrossing(from: number, delta: number, line: number, step: number): number {
    if (delta === 0) {
      return Number.POSITIVE_INFINITY;
    }

    const edge = -this.halfSize + (line + (step > 0 ? 1 : 0)) * this.cellSize;

    return (edge - from) / delta;
  }

  circleBounds(x: number, z: number, radius: number): CellRegion {
    const lastIndex = this.cellsPerSide - 1;

    return {
      firstColumn: Math.max(0, this.columnAt(x - radius)),
      firstRow: Math.max(0, this.rowAt(z - radius)),
      lastColumn: Math.min(lastIndex, this.columnAt(x + radius)),
      lastRow: Math.min(lastIndex, this.rowAt(z + radius)),
    };
  }

  cellsInRadius(x: number, z: number, radius: number): number[] {
    const cells: number[] = [];
    const bounds = this.circleBounds(x, z, radius);
    const radiusSquared = radius * radius;

    for (let row = bounds.firstRow; row <= bounds.lastRow; row += 1) {
      const deltaZ = this.centerZ(row) - z;

      for (let column = bounds.firstColumn; column <= bounds.lastColumn; column += 1) {
        const deltaX = this.centerX(column) - x;

        if (deltaX * deltaX + deltaZ * deltaZ <= radiusSquared) {
          cells.push(this.index(column, row));
        }
      }
    }

    return cells;
  }
}

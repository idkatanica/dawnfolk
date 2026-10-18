export interface GridDimensions {
  cellSize: number;
  cellsPerSide: number;
}

export const DEFAULT_GRID_DIMENSIONS: GridDimensions = { cellSize: 10, cellsPerSide: 512 };

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
  readonly worldSize: number;

  constructor(dimensions: GridDimensions = DEFAULT_GRID_DIMENSIONS) {
    this.cellsPerSide = dimensions.cellsPerSide;
    this.cellSize = dimensions.cellSize;
    this.cellCount = dimensions.cellsPerSide * dimensions.cellsPerSide;
    this.worldSize = dimensions.cellsPerSide * dimensions.cellSize;
    this.halfSize = this.worldSize / 2;
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

  cellsInRadius(x: number, z: number, radius: number): number[] {
    const cells: number[] = [];
    const firstColumn = Math.max(0, this.columnAt(x - radius));
    const lastColumn = Math.min(this.cellsPerSide - 1, this.columnAt(x + radius));
    const firstRow = Math.max(0, this.rowAt(z - radius));
    const lastRow = Math.min(this.cellsPerSide - 1, this.rowAt(z + radius));
    const radiusSquared = radius * radius;

    for (let row = firstRow; row <= lastRow; row += 1) {
      const deltaZ = this.centerZ(row) - z;

      for (let column = firstColumn; column <= lastColumn; column += 1) {
        const deltaX = this.centerX(column) - x;

        if (deltaX * deltaX + deltaZ * deltaZ <= radiusSquared) {
          cells.push(this.index(column, row));
        }
      }
    }

    return cells;
  }
}

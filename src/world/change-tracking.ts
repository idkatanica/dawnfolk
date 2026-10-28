export interface RowRun {
  firstRow: number;
  rowCount: number;
}

export interface CellRegion {
  firstColumn: number;
  firstRow: number;
  lastColumn: number;
  lastRow: number;
}

export function regionsOverlap(first: CellRegion, second: CellRegion): boolean {
  return (
    first.firstColumn <= second.lastColumn &&
    second.firstColumn <= first.lastColumn &&
    first.firstRow <= second.lastRow &&
    second.firstRow <= first.lastRow
  );
}

export class RowChangeTracker {
  readonly #isRowChanged: Uint8Array;

  constructor(rowCount: number) {
    this.#isRowChanged = new Uint8Array(rowCount);
  }

  markRow(row: number): void {
    this.#isRowChanged[row] = 1;
  }

  markRows(firstRow: number, lastRow: number): void {
    this.#isRowChanged.fill(1, firstRow, lastRow + 1);
  }

  markAll(): void {
    this.#isRowChanged.fill(1);
  }

  takeRow(row: number): boolean {
    const isChanged = this.#isRowChanged[row] === 1;

    this.#isRowChanged[row] = 0;

    return isChanged;
  }

  takeRuns(): RowRun[] {
    const runs: RowRun[] = [];
    let runStart = -1;

    for (let row = 0; row < this.#isRowChanged.length; row += 1) {
      const isChanged = this.#isRowChanged[row] === 1;

      if (isChanged && runStart < 0) {
        runStart = row;
      }

      if (!isChanged && runStart >= 0) {
        runs.push({ firstRow: runStart, rowCount: row - runStart });
        runStart = -1;
      }
    }

    if (runStart >= 0) {
      runs.push({ firstRow: runStart, rowCount: this.#isRowChanged.length - runStart });
    }

    this.#isRowChanged.fill(0);

    return runs;
  }
}

export class RegionChangeTracker {
  #region: CellRegion | null = null;

  markRegion(region: CellRegion): void {
    if (this.#region === null) {
      this.#region = { ...region };

      return;
    }

    this.#region = {
      firstColumn: Math.min(this.#region.firstColumn, region.firstColumn),
      firstRow: Math.min(this.#region.firstRow, region.firstRow),
      lastColumn: Math.max(this.#region.lastColumn, region.lastColumn),
      lastRow: Math.max(this.#region.lastRow, region.lastRow),
    };
  }

  takeRegion(): CellRegion | null {
    const region = this.#region;

    this.#region = null;

    return region;
  }
}

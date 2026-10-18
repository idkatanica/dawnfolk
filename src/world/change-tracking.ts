export interface RowRun {
  firstRow: number;
  rowCount: number;
}

export class RowChangeTracker {
  readonly #isRowChanged: Uint8Array;
  #changedRowCount = 0;

  constructor(rowCount: number) {
    this.#isRowChanged = new Uint8Array(rowCount);
  }

  get hasChanges(): boolean {
    return this.#changedRowCount > 0;
  }

  markRow(row: number): void {
    if (this.#isRowChanged[row] === 1) {
      return;
    }

    this.#isRowChanged[row] = 1;
    this.#changedRowCount += 1;
  }

  markRows(firstRow: number, lastRow: number): void {
    const first = Math.max(0, firstRow);
    const last = Math.min(this.#isRowChanged.length - 1, lastRow);

    for (let row = first; row <= last; row += 1) {
      this.markRow(row);
    }
  }

  markAll(): void {
    this.markRows(0, this.#isRowChanged.length - 1);
  }

  takeRuns(): RowRun[] {
    if (this.#changedRowCount === 0) {
      return [];
    }

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
    this.#changedRowCount = 0;

    return runs;
  }
}

export interface CellRegion {
  firstColumn: number;
  firstRow: number;
  lastColumn: number;
  lastRow: number;
}

export class RegionChangeTracker {
  #region: CellRegion | null = null;

  get hasChanges(): boolean {
    return this.#region !== null;
  }

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

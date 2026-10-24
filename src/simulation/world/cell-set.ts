export class CellSet {
  readonly #cells: Int32Array;
  readonly #isMember: Uint8Array;
  #size = 0;

  constructor(cellCount: number) {
    this.#cells = new Int32Array(cellCount);
    this.#isMember = new Uint8Array(cellCount);
  }

  get size(): number {
    return this.#size;
  }

  has(cell: number): boolean {
    return this.#isMember[cell] === 1;
  }

  add(cell: number): void {
    if (this.#isMember[cell] === 1) {
      return;
    }

    this.#isMember[cell] = 1;
    this.#cells[this.#size] = cell;
    this.#size += 1;
  }

  retain(keeps: (cell: number) => boolean): void {
    const initialSize = this.#size;
    let kept = 0;

    for (let position = 0; position < initialSize; position += 1) {
      const cell = this.#cells[position];

      if (keeps(cell)) {
        this.#cells[kept] = cell;
        kept += 1;
      } else {
        this.#isMember[cell] = 0;
      }
    }

    for (let position = initialSize; position < this.#size; position += 1) {
      this.#cells[kept] = this.#cells[position];
      kept += 1;
    }

    this.#size = kept;
  }

  values(): Int32Array {
    return this.#cells.subarray(0, this.#size);
  }
}

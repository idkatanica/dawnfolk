export class IdentifierSource {
  #next: number;

  constructor(first = 1) {
    this.#next = first;
  }

  next(): number {
    const identifier = this.#next;

    this.#next += 1;

    return identifier;
  }

  saveState(): number {
    return this.#next;
  }
}

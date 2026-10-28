export class IdentifierSource {
  #next = 1;

  get upcoming(): number {
    return this.#next;
  }

  restore(upcoming: number): void {
    this.#next = upcoming;
  }

  next(): number {
    const identifier = this.#next;

    this.#next += 1;

    return identifier;
  }
}

export class IdentifierSource {
  #next = 1;

  next(): number {
    const identifier = this.#next;

    this.#next += 1;

    return identifier;
  }
}

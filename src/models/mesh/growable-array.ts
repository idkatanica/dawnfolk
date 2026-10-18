const INITIAL_CAPACITY = 256;

export class GrowableFloatArray {
  #values = new Float32Array(INITIAL_CAPACITY);
  #length = 0;

  push(value: number): void {
    this.#reserve(this.#length + 1);
    this.#values[this.#length] = value;
    this.#length += 1;
  }

  pushThree(first: number, second: number, third: number): void {
    this.#reserve(this.#length + 3);
    this.#values[this.#length] = first;
    this.#values[this.#length + 1] = second;
    this.#values[this.#length + 2] = third;
    this.#length += 3;
  }

  toArray(): Float32Array {
    return this.#values.slice(0, this.#length);
  }

  #reserve(size: number): void {
    if (size <= this.#values.length) {
      return;
    }

    const grown = new Float32Array(Math.max(size, this.#values.length * 2));

    grown.set(this.#values);
    this.#values = grown;
  }
}

export class GrowableIndexArray {
  #values = new Uint32Array(INITIAL_CAPACITY);
  #length = 0;

  pushTriangle(first: number, second: number, third: number): void {
    this.#reserve(this.#length + 3);
    this.#values[this.#length] = first;
    this.#values[this.#length + 1] = second;
    this.#values[this.#length + 2] = third;
    this.#length += 3;
  }

  toArray(): Uint32Array {
    return this.#values.slice(0, this.#length);
  }

  #reserve(size: number): void {
    if (size <= this.#values.length) {
      return;
    }

    const grown = new Uint32Array(Math.max(size, this.#values.length * 2));

    grown.set(this.#values);
    this.#values = grown;
  }
}

const ROOT_POSITION = 0;

export class MinHeap {
  #items: Int32Array;
  #priorities: Float32Array;
  #size = 0;

  constructor(initialCapacity = 1024) {
    this.#items = new Int32Array(initialCapacity);
    this.#priorities = new Float32Array(initialCapacity);
  }

  get size(): number {
    return this.#size;
  }

  clear(): void {
    this.#size = 0;
  }

  push(item: number, priority: number): void {
    if (this.#size === this.#items.length) {
      this.#grow();
    }

    let position = this.#size;

    this.#size += 1;

    while (position > 0) {
      const parent = Math.floor((position - 1) / 2);

      if (this.#priorities[parent] <= priority) {
        break;
      }

      this.#items[position] = this.#items[parent];
      this.#priorities[position] = this.#priorities[parent];
      position = parent;
    }

    this.#items[position] = item;
    this.#priorities[position] = priority;
  }

  pop(): number {
    if (this.#size === 0) {
      throw new RangeError("Cannot pop from an empty heap");
    }

    const top = this.#items[ROOT_POSITION];

    this.#size -= 1;

    const lastItem = this.#items[this.#size];
    const lastPriority = this.#priorities[this.#size];

    this.#siftDown(lastItem, lastPriority);

    return top;
  }

  #siftDown(item: number, priority: number): void {
    let position = ROOT_POSITION;
    const half = Math.floor(this.#size / 2);

    while (position < half) {
      let child = position * 2 + 1;

      const right = child + 1;

      if (right < this.#size && this.#priorities[right] < this.#priorities[child]) {
        child = right;
      }

      if (this.#priorities[child] >= priority) {
        break;
      }

      this.#items[position] = this.#items[child];
      this.#priorities[position] = this.#priorities[child];
      position = child;
    }

    this.#items[position] = item;
    this.#priorities[position] = priority;
  }

  #grow(): void {
    const items = new Int32Array(this.#items.length * 2);
    const priorities = new Float32Array(this.#priorities.length * 2);

    items.set(this.#items);
    priorities.set(this.#priorities);
    this.#items = items;
    this.#priorities = priorities;
  }
}

export const GROWTH_FACTOR = 1.5;

export function grownIndexArray(
  previous: Int32Array<ArrayBuffer>,
  size: number,
  sentinel: number
): Int32Array<ArrayBuffer> {
  if (size <= previous.length) {
    return previous;
  }

  const grown = new Int32Array(Math.max(size, Math.ceil(previous.length * GROWTH_FACTOR))).fill(sentinel);

  grown.set(previous);

  return grown;
}

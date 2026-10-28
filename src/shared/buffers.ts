function collectBuffers(value: unknown, found: Set<ArrayBuffer>): void {
  if (typeof value !== "object" || value === null) {
    return;
  }

  if (ArrayBuffer.isView(value)) {
    if (value.buffer instanceof ArrayBuffer) {
      found.add(value.buffer);
    }

    return;
  }

  const children = value instanceof Map || value instanceof Set ? [...value.values()] : Object.values(value);

  for (const child of children) {
    collectBuffers(child, found);
  }
}

export function buffersWithin(value: unknown): ArrayBuffer[] {
  const found = new Set<ArrayBuffer>();

  collectBuffers(value, found);

  return [...found];
}

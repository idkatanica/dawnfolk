export function landEverywhere(cellCount: number): Float32Array {
  return new Float32Array(cellCount).fill(Number.POSITIVE_INFINITY);
}

export function isOnIsland(coastDistance: Float32Array, cell: number): boolean {
  return cell >= 0 && coastDistance[cell] > 0;
}

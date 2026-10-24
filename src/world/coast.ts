import { sampleHeight } from "./terrain-sampling.ts";
import type { WorldGrid } from "./world-grid.ts";

const PLANT_COAST_CLEARANCE = 6;

export function isOnIsland(coastDistance: Float32Array, cell: number): boolean {
  return cell >= 0 && coastDistance[cell] > 0;
}

export function hasRoomFromCoast(
  coastDistance: Float32Array,
  grid: WorldGrid,
  x: number,
  z: number,
  clearance = PLANT_COAST_CLEARANCE
): boolean {
  return sampleHeight(coastDistance, grid, x, z) > clearance;
}

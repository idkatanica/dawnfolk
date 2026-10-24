import type { TerrainData } from "../terrain-data.ts";
import type { GridDimensions } from "../world-grid.ts";

const FAR_FROM_ANY_COAST = 1e9;

export function landEverywhere(cellCount: number): Float32Array {
  return new Float32Array(cellCount).fill(FAR_FROM_ANY_COAST);
}

export function createTerrainData({ cellsPerSide }: GridDimensions): TerrainData {
  const cellCount = cellsPerSide * cellsPerSide;

  return {
    baseTemperature: new Float32Array(cellCount),
    biome: new Uint8Array(cellCount),
    carving: new Float32Array(cellCount),
    coastDistance: landEverywhere(cellCount),
    dryness: new Float32Array(cellCount),
    ground: new Uint8Array(cellCount),
    height: new Float32Array(cellCount),
    moisture: new Float32Array(cellCount),
    riverStrength: new Uint8Array(cellCount),
    variation: new Float32Array(cellCount),
    waterSurface: new Float32Array(cellCount),
    woodland: new Float32Array(cellCount).fill(1),
  };
}

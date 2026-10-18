import type { GridDimensions } from "./world-grid.ts";

export interface TerrainData {
  baseTemperature: Float32Array;
  biome: Uint8Array;
  carving: Float32Array;
  dryness: Float32Array;
  ground: Uint8Array;
  height: Float32Array;
  moisture: Float32Array;
  riverStrength: Uint8Array;
  variation: Float32Array;
  waterSurface: Float32Array;
}

export function createTerrainData({ cellsPerSide }: GridDimensions): TerrainData {
  const cellCount = cellsPerSide * cellsPerSide;

  return {
    baseTemperature: new Float32Array(cellCount),
    biome: new Uint8Array(cellCount),
    carving: new Float32Array(cellCount),
    dryness: new Float32Array(cellCount),
    ground: new Uint8Array(cellCount),
    height: new Float32Array(cellCount),
    moisture: new Float32Array(cellCount),
    riverStrength: new Uint8Array(cellCount),
    variation: new Float32Array(cellCount),
    waterSurface: new Float32Array(cellCount),
  };
}

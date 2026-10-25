import type { TerrainData } from "../terrain-data.ts";
import type { GridDimensions, WorldGrid } from "../world-grid.ts";

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

export function shapeTerrain(grid: WorldGrid, heightAt: (x: number, z: number) => number): Float32Array {
  return Float32Array.from({ length: grid.cellCount }, (_, cell) =>
    heightAt(grid.cellCenterX(cell), grid.cellCenterZ(cell))
  );
}

export function trough(x: number, z: number): number {
  return 100 + 0.03 * z + 0.08 * Math.abs(x);
}

export function troughWithBasin(x: number, z: number): number {
  return trough(x, z) - 14 * Math.exp(-(x * x + z * z) / (2 * 110 * 110));
}

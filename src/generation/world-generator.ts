import { createRandom } from "../shared/random.ts";
import { createTerrainData, type TerrainData } from "../world/terrain-data.ts";
import { VegetationStore } from "../world/vegetation-store.ts";
import type { WaterFeatures } from "../world/water.ts";
import { DEFAULT_GRID_DIMENSIONS, type GridDimensions, WorldGrid } from "../world/world-grid.ts";
import { buildClimate } from "./climate.ts";
import { DEFAULT_HYDRAULIC_EROSION, erodeHydraulically, erodeThermally, smoothHeights } from "./erosion.ts";
import { computeHydrology } from "./hydrology.ts";
import { createRelief } from "./relief.ts";
import { plantInitialVegetation } from "./vegetation.ts";

export type GenerationStage = "climate" | "erosion" | "relief" | "vegetation" | "water";

export interface GenerationProgress {
  progress: number;
  stage: GenerationStage;
}

export interface GenerationOptions {
  dimensions: GridDimensions;
  erosionStrength: number;
}

export const DEFAULT_GENERATION_OPTIONS: GenerationOptions = {
  dimensions: DEFAULT_GRID_DIMENSIONS,
  erosionStrength: 1,
};

export interface GeneratedWorld {
  dimensions: GridDimensions;
  seed: number;
  terrain: TerrainData;
  vegetation: VegetationStore;
  water: WaterFeatures;
}

const VEGETATION_CAPACITY_PER_CELL = 1.25;

function buildRelief(grid: WorldGrid, seed: number, onProgress: (progress: GenerationProgress) => void) {
  const relief = createRelief(seed);
  const heights = new Float32Array(grid.cellCount);
  const dryness = new Float32Array(grid.cellCount);

  for (let row = 0; row < grid.cellsPerSide; row += 1) {
    for (let column = 0; column < grid.cellsPerSide; column += 1) {
      const point = { x: grid.centerX(column) / grid.halfSize, z: grid.centerZ(row) / grid.halfSize };
      const cell = grid.index(column, row);

      heights[cell] = relief.heightAt(point);
      dryness[cell] = relief.desertAt(point);
    }

    if (row % 32 === 0) {
      onProgress({ progress: row / grid.cellsPerSide, stage: "relief" });
    }
  }

  return { dryness, heights, relief };
}

export function generateWorld(
  seed: number,
  options: GenerationOptions = DEFAULT_GENERATION_OPTIONS,
  onProgress: (progress: GenerationProgress) => void = () => undefined
): GeneratedWorld {
  const grid = new WorldGrid(options.dimensions);

  const size = grid.cellsPerSide;
  const { dryness, heights, relief } = buildRelief(grid, seed, onProgress);

  erodeThermally(heights, size, grid.cellSize, 3, 1.25);
  erodeHydraulically(
    heights,
    size,
    createRandom(seed * 7 + 3),
    { ...DEFAULT_HYDRAULIC_EROSION, dropletCount: Math.round(grid.cellCount * 1.6 * options.erosionStrength) },
    (progress) => onProgress({ progress, stage: "erosion" })
  );
  erodeThermally(heights, size, grid.cellSize, 4, 1.05);
  smoothHeights(heights, size, 1, 0.2);
  onProgress({ progress: 0, stage: "water" });

  const uncarvedHeights = Float32Array.from(heights);
  const hydrology = computeHydrology(heights, grid, dryness);

  const carving = uncarvedHeights.map((uncarvedHeight, cell) => uncarvedHeight - heights[cell]);

  onProgress({ progress: 0, stage: "climate" });

  const climate = buildClimate({
    desertAt: relief.desertAt,
    grid,
    heights,
    lakeIds: hydrology.lakeIds,
    riverStrength: hydrology.riverStrength,
    seed,
    waterSurface: hydrology.waterSurface,
  });

  const terrain: TerrainData = {
    ...createTerrainData(options.dimensions),
    ...climate,
    carving,
    dryness,
    height: heights,
    riverStrength: hydrology.riverStrength,
    waterSurface: hydrology.waterSurface,
  };

  onProgress({ progress: 0, stage: "vegetation" });

  const vegetation = new VegetationStore(grid, Math.round(grid.cellCount * VEGETATION_CAPACITY_PER_CELL));

  plantInitialVegetation(vegetation, grid, terrain, seed);
  vegetation.discardChanges();

  return { dimensions: options.dimensions, seed, terrain, vegetation, water: hydrology.features };
}

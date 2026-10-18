import { lerp, smoothstep } from "../shared/math.ts";
import { createRandom } from "../shared/random.ts";
import type { TerrainData } from "../world/terrain-data.ts";
import { VegetationStore } from "../world/vegetation-store.ts";
import type { WaterFeatures } from "../world/water.ts";
import { DEFAULT_GRID_DIMENSIONS, type GridDimensions, WorldGrid } from "../world/world-grid.ts";
import { buildClimate } from "./climate.ts";
import {
  type ErosionPlan,
  type ErosionScale,
  erodeAcrossScales,
  limitSlopes,
  relaxSlopes,
  smoothHeights,
} from "./erosion.ts";
import { computeHydrology } from "./hydrology.ts";
import { digRiverLakes, fillSinks } from "./lake-basins.ts";
import { createRelief, islandPointAt, type Relief } from "./relief.ts";
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
const SOIL_TALUS = 0.78;
const BEDROCK_TALUS = 0.92;
const CAPROCK_TALUS = 1.15;
const BEDROCK_HEIGHT = 650;
const SUMMIT_HEIGHT = 950;
const STEEPEST_SLOPE = 1.25;
const ROUGH_RELAXATION_ITERATIONS = 24;
const FINAL_RELAXATION_ITERATIONS = 72;
const DESERT_RESISTANCE = 0.85;
const LOWLAND_HEIGHT = 420;
const UPLAND_HEIGHT = 650;
const VALLEY_CELL_SIZES = [40, 20] as const;
const VALLEY_DROPLETS_PER_CELL = 1.6;
const GULLY_DROPLETS_PER_CELL = 1.2;

function erosionScales(grid: WorldGrid, strength: number): ErosionScale[] {
  const coarse = VALLEY_CELL_SIZES.map((meters) => Math.round(meters / grid.cellSize))
    .filter((factor) => factor >= 2 && grid.cellsPerSide % factor === 0)
    .map((factor) => ({ dropletsPerCell: VALLEY_DROPLETS_PER_CELL * strength, factor }));

  return [...coarse, { dropletsPerCell: GULLY_DROPLETS_PER_CELL * strength, factor: 1 }];
}

function erosionPlan(grid: WorldGrid, heights: Float32Array, dryness: Float32Array, strength: number): ErosionPlan {
  return {
    coarseReach: heights.map((height, cell) => smoothstep(LOWLAND_HEIGHT, UPLAND_HEIGHT, height) * (1 - dryness[cell])),
    resistance: dryness.map((value) => DESERT_RESISTANCE * value),
    scales: erosionScales(grid, strength),
  };
}

function talusSlopes(heights: Float32Array, dryness: Float32Array): Float32Array {
  return heights.map((height, cell) => {
    const rock = lerp(SOIL_TALUS, BEDROCK_TALUS, smoothstep(BEDROCK_HEIGHT, SUMMIT_HEIGHT, height));

    return lerp(rock, CAPROCK_TALUS, dryness[cell]);
  });
}

function digLakeBasins(grid: WorldGrid, heights: Float32Array, relief: Relief): void {
  for (let row = 0; row < grid.cellsPerSide; row += 1) {
    for (let column = 0; column < grid.cellsPerSide; column += 1) {
      heights[grid.index(column, row)] -= relief.basinDepthAt(islandPointAt(grid, column, row));
    }
  }
}

function boundaryDistances(grid: WorldGrid, relief: Relief): (cell: number) => number {
  return (cell) => relief.boundaryDistanceAt(islandPointAt(grid, grid.columnOf(cell), grid.rowOf(cell)));
}

function buildRelief(grid: WorldGrid, seed: number, onProgress: (progress: GenerationProgress) => void) {
  const relief = createRelief(seed);
  const heights = new Float32Array(grid.cellCount);
  const dryness = new Float32Array(grid.cellCount);

  for (let row = 0; row < grid.cellsPerSide; row += 1) {
    for (let column = 0; column < grid.cellsPerSide; column += 1) {
      const point = islandPointAt(grid, column, row);
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
  const talus = talusSlopes(heights, dryness);

  relaxSlopes(heights, size, grid.cellSize, talus, ROUGH_RELAXATION_ITERATIONS);
  erodeAcrossScales(
    heights,
    size,
    createRandom(seed * 7 + 3),
    erosionPlan(grid, heights, dryness, options.erosionStrength),
    (progress) => onProgress({ progress, stage: "erosion" })
  );
  digLakeBasins(grid, heights, relief);
  digRiverLakes(heights, {
    boundaryDistance: boundaryDistances(grid, relief),
    dryness,
    grid,
    random: createRandom(seed * 11 + 5),
  });
  relaxSlopes(heights, size, grid.cellSize, talus, FINAL_RELAXATION_ITERATIONS);
  limitSlopes(heights, size, grid.cellSize, STEEPEST_SLOPE);
  smoothHeights(heights, size, 1, 0.2);
  fillSinks(heights, grid, dryness);
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

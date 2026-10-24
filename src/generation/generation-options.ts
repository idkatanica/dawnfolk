import type { IslandShapeKind } from "../world/island-shape.ts";
import { DEFAULT_GRID_DIMENSIONS, type GridDimensions } from "../world/world-grid.ts";

export type GenerationStage = "climate" | "erosion" | "relief" | "vegetation" | "water";

export interface GenerationProgress {
  progress: number;
  stage: GenerationStage;
}

export interface GenerationOptions {
  dimensions: GridDimensions;
  erosionStrength: number;
  shape: IslandShapeKind;
}

export const DEFAULT_GENERATION_OPTIONS: GenerationOptions = {
  dimensions: DEFAULT_GRID_DIMENSIONS,
  erosionStrength: 1,
  shape: "round",
};

export interface WorldRequest {
  options: GenerationOptions;
  seed: number;
}

export const DEFAULT_WORLD_REQUEST: WorldRequest = { options: DEFAULT_GENERATION_OPTIONS, seed: 1 };

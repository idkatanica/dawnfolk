import type { DetailSteps } from "../level-of-detail.ts";

export type AnimalDetailLevel = "far" | "high" | "low";

export interface AnimalDetail extends DetailSteps {
  readonly hasSmallParts: boolean;
  readonly segments: number;
}

export const ANIMAL_DETAILS: Readonly<Record<AnimalDetailLevel, AnimalDetail>> = {
  far: { hasSmallParts: false, pathStep: 2, segmentFloor: 4, segments: 4 },
  high: { hasSmallParts: true, pathStep: 1, segmentFloor: 8, segments: 8 },
  low: { hasSmallParts: true, pathStep: 1, segmentFloor: 8, segments: 6 },
};

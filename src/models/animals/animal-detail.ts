import type { DetailSteps } from "../level-of-detail.ts";

export type AnimalDetailLevel = "far" | "high" | "low";

export interface AnimalDetail extends DetailSteps {
  readonly segments: number;
}

export const ANIMAL_DETAILS: Readonly<Record<AnimalDetailLevel, AnimalDetail>> = {
  far: { curveSteps: 1, hasSmallParts: false, segments: 4 },
  high: { curveSteps: 2, hasSmallParts: true, segments: 10 },
  low: { curveSteps: 1, hasSmallParts: true, segments: 6 },
};

import type { DetailSteps } from "../level-of-detail.ts";

type HumanDetailLevel = "far" | "high" | "low";

export interface HumanDetail extends DetailSteps {
  readonly hasFineDetails: boolean;
  readonly hasSmallParts: boolean;
  readonly headSegments: number;
  readonly limbSegments: number;
  readonly propSubdivisions: number;
  readonly torsoSegments: number;
  readonly trimShare: number;
}

export const HUMAN_DETAILS: Readonly<Record<HumanDetailLevel, HumanDetail>> = {
  far: {
    hasFineDetails: false,
    hasSmallParts: false,
    headSegments: 6,
    limbSegments: 4,
    pathStep: 2,
    propSubdivisions: 0,
    segmentFloor: 4,
    torsoSegments: 6,
    trimShare: 0.4,
  },
  high: {
    hasFineDetails: true,
    hasSmallParts: true,
    headSegments: 14,
    limbSegments: 9,
    pathStep: 1,
    propSubdivisions: 1,
    segmentFloor: 8,
    torsoSegments: 16,
    trimShare: 1,
  },
  low: {
    hasFineDetails: false,
    hasSmallParts: true,
    headSegments: 8,
    limbSegments: 5,
    pathStep: 1,
    propSubdivisions: 1,
    segmentFloor: 8,
    torsoSegments: 8,
    trimShare: 1,
  },
};

const FEWEST_TRIM_SEGMENTS = 4;

export function trimSegments(detail: HumanDetail, segments: number): number {
  return Math.max(FEWEST_TRIM_SEGMENTS, Math.round(segments * detail.trimShare));
}

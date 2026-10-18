export type HumanDetailLevel = "high" | "low";

export interface HumanDetail {
  readonly hasFineDetails: boolean;
  readonly headSegments: number;
  readonly level: HumanDetailLevel;
  readonly limbSegments: number;
  readonly torsoSegments: number;
}

export const HUMAN_DETAILS: Readonly<Record<HumanDetailLevel, HumanDetail>> = {
  high: { hasFineDetails: true, headSegments: 14, level: "high", limbSegments: 9, torsoSegments: 16 },
  low: { hasFineDetails: false, headSegments: 8, level: "low", limbSegments: 5, torsoSegments: 8 },
};

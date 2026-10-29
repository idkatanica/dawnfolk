export const QUALITY_LEVELS = ["low", "medium", "high"] as const;

export type QualityLevel = (typeof QUALITY_LEVELS)[number];

export interface RenderQuality {
  readonly agentDetail: number;
  readonly grassClumpsPerSide: number;
  readonly hasAntialias: boolean;
  readonly hasBloom: boolean;
  readonly maximumPixelRatio: number;
  readonly shadowMapSize: number;
  readonly terrainDetail: number;
  readonly vegetationDetail: number;
}

export const RENDER_QUALITY: Readonly<Record<QualityLevel, RenderQuality>> = {
  high: {
    agentDetail: 1.3,
    grassClumpsPerSide: 288,
    hasAntialias: true,
    hasBloom: true,
    maximumPixelRatio: 2,
    shadowMapSize: 4096,
    terrainDetail: 1.3,
    vegetationDetail: 1.3,
  },
  low: {
    agentDetail: 0.6,
    grassClumpsPerSide: 0,
    hasAntialias: false,
    hasBloom: false,
    maximumPixelRatio: 1,
    shadowMapSize: 1024,
    terrainDetail: 0.6,
    vegetationDetail: 0.55,
  },
  medium: {
    agentDetail: 1,
    grassClumpsPerSide: 208,
    hasAntialias: true,
    hasBloom: true,
    maximumPixelRatio: 1.5,
    shadowMapSize: 2048,
    terrainDetail: 1,
    vegetationDetail: 1,
  },
};

export function isQualityLevel(value: string): value is QualityLevel {
  return QUALITY_LEVELS.some((level) => {
    return level === value;
  });
}

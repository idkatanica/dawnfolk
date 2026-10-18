export const NO_WATER = -10_000;

export interface Lake {
  cellCount: number;
  centerX: number;
  centerZ: number;
  id: number;
  level: number;
  maximumDepth: number;
}

export interface RiverPoint {
  depth: number;
  flow: number;
  surface: number;
  width: number;
  x: number;
  z: number;
}

export interface River {
  id: number;
  points: RiverPoint[];
  reachesEdge: boolean;
}

export interface Waterfall {
  directionX: number;
  directionZ: number;
  top: number;
  width: number;
  x: number;
  z: number;
}

export const SPRING_KINDS = ["pool", "rocky", "cave"] as const;

export type SpringKind = (typeof SPRING_KINDS)[number];

export interface Spring {
  readonly cells: readonly number[];
  readonly directionX: number;
  readonly directionZ: number;
  readonly kind: SpringKind;
  readonly level: number;
  readonly radius: number;
  readonly river: number;
  readonly seed: number;
  readonly x: number;
  readonly z: number;
}

export interface WaterFeatures {
  lakes: Lake[];
  rivers: River[];
  springs: Spring[];
  waterfalls: Waterfall[];
}

export function hasWater(waterSurface: number, ground: number): boolean {
  return waterSurface !== NO_WATER && waterSurface > ground + 0.05;
}

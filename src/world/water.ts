import { clamp, FULL_TURN } from "../shared/math.ts";

export const NO_WATER = -10_000;

export const POND_SHORE_SLOPE = 0.3;

const POND_STRETCH = 0.08;
const POND_RIPPLE = 0.05;
const NARROWEST_RIVER = 3.5;
const WIDEST_RIVER = 26;
const RIVER_WIDTH_PER_STRENGTH = 3.4;
const RIVER_CODE_AT_SOURCE = 40;
const RIVER_CODE_PER_STRENGTH = 30;

export interface Lake {
  cellCount: number;
  centerX: number;
  centerZ: number;
  id: number;
  level: number;
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

export const SPRING_KINDS = ["pond", "cave"] as const;

type SpringKind = (typeof SPRING_KINDS)[number];

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

export type MirroredWater = Omit<WaterFeatures, "rivers">;

export function mirroredWater({ lakes, springs, waterfalls }: WaterFeatures): MirroredWater {
  return { lakes, springs, waterfalls };
}

export function pondEdgeReach(spring: Spring, x: number, z: number): number {
  const angle = Math.atan2(z - spring.z, x - spring.x);
  const turn = spring.seed * FULL_TURN;

  const outline =
    spring.radius * (1 + POND_STRETCH * Math.sin(2 * angle + turn) + POND_RIPPLE * Math.sin(3 * angle - turn * 2));

  return outline - Math.hypot(x - spring.x, z - spring.z);
}

export function hasWater(waterSurface: number, ground: number): boolean {
  return waterSurface !== NO_WATER && waterSurface > ground + 0.05;
}

export function riverWidthOfStrength(strength: number): number {
  return clamp(NARROWEST_RIVER + RIVER_WIDTH_PER_STRENGTH * strength, NARROWEST_RIVER, WIDEST_RIVER);
}

export function riverCodeOfStrength(strength: number): number {
  return Math.round(clamp(RIVER_CODE_AT_SOURCE + strength * RIVER_CODE_PER_STRENGTH, 0, 255));
}

export function riverCodeOfWidth(width: number): number {
  return RIVER_CODE_AT_SOURCE + (RIVER_CODE_PER_STRENGTH * (width - NARROWEST_RIVER)) / RIVER_WIDTH_PER_STRENGTH;
}

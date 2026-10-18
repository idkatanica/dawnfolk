import { Vector3 } from "three";
import type { VolumeNoise } from "../../shared/noise.ts";
import type { RandomSource } from "../../shared/random.ts";
import type { TubePoint } from "../mesh/shapes.ts";
import type { Triple } from "../mesh/transforms.ts";

export interface Branch {
  readonly depth: number;
  readonly forks?: boolean;
  readonly points: readonly TubePoint[];
}

export interface FoliageBlob {
  readonly center: Triple;
  readonly drape?: number;
  readonly kind: "blob";
  readonly radius: number;
  readonly squash: number;
  readonly tint: number;
}

export interface FoliageSkirt {
  readonly bottom: number;
  readonly center: Triple;
  readonly droop: number;
  readonly kind: "skirt";
  readonly radius: number;
  readonly tint: number;
  readonly top: number;
}

export interface FoliageFrond {
  readonly kind: "frond";
  readonly points: readonly TubePoint[];
  readonly tint: number;
}

export type Foliage = FoliageBlob | FoliageFrond | FoliageSkirt;

export interface TreeStructure {
  readonly branches: readonly Branch[];
  readonly foliage: readonly Foliage[];
  readonly height: number;
}

interface BranchGrowth {
  readonly bend: number;
  readonly direction: Vector3;
  readonly gravity: number;
  readonly length: number;
  readonly noise: VolumeNoise;
  readonly radiusEnd: number;
  readonly radiusStart: number;
  readonly segments: number;
  readonly start: Vector3;
  readonly wobble: number;
}

const UP = new Vector3(0, 1, 0);

export function growBranch(growth: BranchGrowth): TubePoint[] {
  const { bend, gravity, length, noise, radiusEnd, radiusStart, segments, wobble } = growth;
  const points: TubePoint[] = [];
  const position = growth.start.clone();
  const direction = growth.direction.clone().normalize();

  const step = length / segments;

  for (let index = 0; index <= segments; index += 1) {
    const amount = index / segments;

    points.push({
      radius: radiusStart + (radiusEnd - radiusStart) * amount,
      x: position.x,
      y: position.y,
      z: position.z,
    });

    const sway = new Vector3(
      noise.sample(position.x * 0.31, position.y * 0.31, 3.1),
      noise.sample(position.x * 0.31, position.y * 0.31, 7.7) * 0.3,
      noise.sample(position.z * 0.31, position.y * 0.31, 11.3)
    );

    direction
      .addScaledVector(UP, bend * step)
      .addScaledVector(UP, -gravity * step * amount)
      .addScaledVector(sway, wobble);
    direction.normalize();
    position.addScaledVector(direction, step);
  }

  return points;
}

export function pointAlong(points: readonly TubePoint[], amount: number): TubePoint {
  const scaled = Math.min(points.length - 1.000_001, Math.max(0, amount * (points.length - 1)));

  const index = Math.floor(scaled);

  const fraction = scaled - index;

  const from = points[index];
  const to = points[index + 1];

  return {
    radius: from.radius + (to.radius - from.radius) * fraction,
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
    z: from.z + (to.z - from.z) * fraction,
  };
}

export function directionAlong(points: readonly TubePoint[], amount: number): Vector3 {
  const before = pointAlong(points, Math.max(0, amount - 0.05));
  const after = pointAlong(points, Math.min(1, amount + 0.05));

  return new Vector3(after.x - before.x, after.y - before.y, after.z - before.z).normalize();
}

export function tipOf(points: readonly TubePoint[]): TubePoint {
  return pointAlong(points, 1);
}

export function endedBelow(points: readonly TubePoint[], ceiling: number): TubePoint[] {
  const cut = points.findIndex((point) => point.y > ceiling);

  if (cut <= 0) {
    return [...points];
  }

  const below = points[cut - 1];
  const above = points[cut];

  const amount = (ceiling - below.y) / (above.y - below.y);

  const end: TubePoint = {
    radius: below.radius + (above.radius - below.radius) * amount,
    x: below.x + (above.x - below.x) * amount,
    y: ceiling,
    z: below.z + (above.z - below.z) * amount,
  };

  return [...points.slice(0, cut), end, { ...end, radius: 0, y: ceiling + end.radius }];
}

function crossReference(axis: Vector3): Vector3 {
  if (Math.abs(axis.y) < 0.9) {
    return UP;
  }

  return new Vector3(1, 0, 0);
}

export function sideDirection(axis: Vector3, azimuth: number, tilt: number): Vector3 {
  const reference = crossReference(axis);

  const across = new Vector3().crossVectors(axis, reference).normalize();

  const other = new Vector3().crossVectors(axis, across).normalize();

  const outward = across.multiplyScalar(Math.cos(azimuth)).addScaledVector(other, Math.sin(azimuth));

  return axis.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(outward, Math.sin(tilt)).normalize();
}

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function jitter(random: RandomSource, amount: number): number {
  return random.signed() * amount;
}

export function toVector(point: TubePoint): Vector3 {
  return new Vector3(point.x, point.y, point.z);
}

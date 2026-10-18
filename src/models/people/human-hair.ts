import { lerp, smoothstep } from "../../shared/math.ts";
import { createVolumeNoise } from "../../shared/noise.ts";
import { createRandom } from "../../shared/random.ts";
import { MaterialSlot } from "../materials.ts";
import type { MeshBuilder } from "../mesh/mesh-builder.ts";
import { deformShape, type Shape, type ShapeVertex } from "../mesh/shape.ts";
import { type LoftSection, loft, sphere, type TubePoint, torus, tube } from "../mesh/shapes.ts";
import { combine, transformOf } from "../mesh/transforms.ts";
import { rigidStyle } from "../rig/skin-weights.ts";
import { forEachSide } from "./human-anatomy.ts";
import type { HumanDetail } from "./human-detail.ts";
import { headToChestStyle } from "./human-rigging.ts";
import { HumanBone } from "./human-skeleton.ts";

const HEAD_CROWN = 1.753;

const HAIR = { ...rigidStyle(HumanBone.Head), slot: MaterialSlot.Hair };

const HAIR_NOISE = createVolumeNoise(createRandom(911));

const HEAD_PROFILE: readonly LoftSection[] = [
  { centerZ: 0.03, radiusX: 0.062, radiusZ: 0.07, y: 1.545 },
  { centerZ: 0.013, radiusX: 0.083, radiusZ: 0.094, y: 1.58 },
  { centerZ: 0.003, radiusX: 0.093, radiusZ: 0.104, y: 1.62 },
  { centerZ: -0.006, radiusX: 0.096, radiusZ: 0.107, y: 1.66 },
  { centerZ: -0.012, radiusX: 0.088, radiusZ: 0.099, y: 1.7 },
  { centerZ: -0.014, radiusX: 0.066, radiusZ: 0.076, y: 1.732 },
  { centerZ: -0.012, radiusX: 0.035, radiusZ: 0.04, y: 1.748 },
];

function headSectionAt(y: number): LoftSection {
  const upperIndex = HEAD_PROFILE.findIndex((section) => section.y >= y);

  if (upperIndex <= 0) {
    return HEAD_PROFILE[Math.max(0, upperIndex)];
  }

  const lower = HEAD_PROFILE[upperIndex - 1];
  const upper = HEAD_PROFILE[upperIndex];

  const { centerZ: lowerCenter = 0 } = lower;
  const { centerZ: upperCenter = 0 } = upper;

  const amount = (y - lower.y) / (upper.y - lower.y);

  return {
    centerZ: lerp(lowerCenter, upperCenter, amount),
    radiusX: lerp(lower.radiusX, upper.radiusX, amount),
    radiusZ: lerp(lower.radiusZ, upper.radiusZ, amount),
    y,
  };
}

interface ShellOptions {
  readonly bottom: number;
  readonly coverage: (vertex: ShapeVertex) => number;
  readonly offset: number;
  readonly roughness: number;
}

function grown(section: LoftSection, offset: number): LoftSection {
  return { ...section, radiusX: section.radiusX + offset, radiusZ: section.radiusZ + offset };
}

function headShell(detail: HumanDetail, options: ShellOptions): Shape {
  const { bottom, coverage, offset, roughness } = options;

  const bottomSection = headSectionAt(bottom + 0.006);

  const { centerZ = 0 } = bottomSection;

  const sections: LoftSection[] = [
    { centerZ, radiusX: 0, radiusZ: 0, y: bottom },
    grown(bottomSection, offset),
    ...HEAD_PROFILE.filter((section) => section.y > bottom + 0.012).map((section) => grown(section, offset)),
    { centerZ: -0.012, radiusX: 0, radiusZ: 0, y: HEAD_CROWN + offset },
  ];

  const shell = loft(sections, detail.headSegments + 2);

  return deformShape(shell, (vertex) => {
    const covered = coverage(vertex);
    const texture = roughness * HAIR_NOISE.fractal(vertex.x * 38, vertex.y * 38, vertex.z * 38, { octaves: 2 });

    const push = -(offset + 0.012) * (1 - covered) + texture * covered;

    return [vertex.normalX * push, vertex.normalY * push, vertex.normalZ * push];
  });
}

function frontness(vertex: ShapeVertex): number {
  const length = Math.hypot(vertex.x, vertex.z + 0.01);

  if (length === 0) {
    return 0;
  }

  return Math.max(0, (vertex.z + 0.01) / length);
}

function hairlineCoverage(front: number, side: number): (vertex: ShapeVertex) => number {
  return (vertex) => {
    const amount = frontness(vertex);

    const hairline = lerp(side, front, amount ** 1.6);

    return smoothstep(hairline - 0.006, hairline + 0.006, vertex.y);
  };
}

function capShell(detail: HumanDetail, offset: number, front = 1.688, side = 1.585): Shape {
  return headShell(detail, { bottom: 1.555, coverage: hairlineCoverage(front, side), offset, roughness: 0.004 });
}

export function addShortHair(builder: MeshBuilder, detail: HumanDetail): void {
  builder.add(capShell(detail, 0.012), { style: HAIR });
}

export function addWildHair(builder: MeshBuilder, detail: HumanDetail): void {
  const shell = headShell(detail, {
    bottom: 1.555,
    coverage: hairlineCoverage(1.672, 1.57),
    offset: 0.026,
    roughness: 0.022,
  });

  builder.add(shell, { style: HAIR });
}

const SIDE_COVERAGE = hairlineCoverage(1.75, 1.585);

function ringCoverage(vertex: ShapeVertex): number {
  const sides = SIDE_COVERAGE(vertex);
  const balding = 1 - smoothstep(1.655, 1.67, vertex.y);

  return sides * balding * (1 - frontness(vertex) ** 2);
}

export function addFringeHair(builder: MeshBuilder, detail: HumanDetail): void {
  const shell = headShell(detail, { bottom: 1.555, coverage: ringCoverage, offset: 0.01, roughness: 0.006 });

  builder.add(shell, { style: HAIR });
}

function lockPath(angle: number, length: number): TubePoint[] {
  const directionX = Math.cos(angle);
  const directionZ = Math.sin(angle);
  const points: TubePoint[] = [];

  for (let index = 0; index <= 5; index += 1) {
    const amount = index / 5;

    const reach = 0.098 + 0.03 * Math.sin(amount * Math.PI * 0.8);

    points.push({
      radius: lerp(0.036, 0.012, amount ** 1.4),
      x: directionX * reach,
      y: lerp(1.66, 1.66 - length, amount),
      z: -0.01 + directionZ * reach - 0.02 * amount,
    });
  }

  return points;
}

export function addLongHair(builder: MeshBuilder, detail: HumanDetail): void {
  const style = { ...headToChestStyle(1.56, 1.4), slot: MaterialSlot.Hair };
  const lockCount = detail.hasFineDetails ? 9 : 5;
  const segments = Math.max(4, detail.limbSegments - 3);

  builder.add(capShell(detail, 0.014, 1.688, 1.56), { style: HAIR });

  for (let lock = 0; lock < lockCount; lock += 1) {
    const amount = lock / (lockCount - 1);

    const angle = Math.PI * (1.08 + 0.84 * amount);
    const length = 0.27 + 0.06 * Math.sin(amount * Math.PI) - 0.02 * ((lock % 2) * 2 - 1);

    builder.add(tube(lockPath(angle, length), { radialSegments: segments }), { style });
  }
}

function braidPath(): TubePoint[] {
  const points: TubePoint[] = [];
  const count = 14;

  for (let index = 0; index <= count; index += 1) {
    const amount = index / count;
    const bulge = index % 2 === 0 ? 1 : 0.72;

    points.push({
      radius: lerp(0.024, 0.016, amount) * bulge,
      x: lerp(0.088, 0.122, amount),
      y: lerp(1.61, 1.3, amount),
      z: lerp(-0.01, 0.092, amount ** 0.8),
    });
  }

  return points;
}

export function addBraids(builder: MeshBuilder, detail: HumanDetail): void {
  const braid = braidPath();
  const style = { ...headToChestStyle(1.58, 1.42), slot: MaterialSlot.Hair };

  builder.add(capShell(detail, 0.012), { style: HAIR });

  forEachSide((_side, mirror) => {
    builder.add(tube(braid, { radialSegments: Math.max(5, detail.limbSegments - 2) }), { style, transform: mirror });
    builder.add(torus(0.016, 0.006, 10, 4), {
      style: { ...style, slot: MaterialSlot.Accent },
      transform: combine(mirror, transformOf({ position: [0.12, 1.325, 0.088], rotation: [0.3, 0, 0] })),
    });
  });
}

export function addBun(builder: MeshBuilder, detail: HumanDetail): void {
  builder.add(capShell(detail, 0.012, 1.7, 1.575), { style: HAIR });
  builder.add(sphere(0.05, detail.headSegments, 6), {
    style: HAIR,
    transform: transformOf({ position: [0, 1.722, -0.088], scale: [1, 0.86, 0.92] }),
  });
  builder.add(
    tube(
      [
        { radius: 0.005, x: -0.07, y: 1.74, z: -0.08 },
        { radius: 0.005, x: 0.07, y: 1.71, z: -0.095 },
      ],
      { radialSegments: 4 }
    ),
    {
      style: { ...rigidStyle(HumanBone.Head), slot: MaterialSlot.Bone },
    }
  );
}

export function addPonytail(builder: MeshBuilder, detail: HumanDetail): void {
  builder.add(capShell(detail, 0.012), { style: HAIR });
  builder.add(
    tube(
      [
        { radius: 0.03, x: 0, y: 1.69, z: -0.1 },
        { radius: 0.034, x: 0, y: 1.63, z: -0.135 },
        { radius: 0.029, x: 0, y: 1.54, z: -0.15 },
        { radius: 0.018, x: 0, y: 1.46, z: -0.15 },
        { radius: 0, x: 0, y: 1.41, z: -0.145 },
      ],
      { hasEndCap: false, radialSegments: Math.max(5, detail.limbSegments - 2) }
    ),
    { style: { ...headToChestStyle(1.62, 1.46), slot: MaterialSlot.Hair } }
  );
  builder.add(torus(0.03, 0.007, 10, 4), {
    style: { ...rigidStyle(HumanBone.Head), slot: MaterialSlot.Accent },
    transform: transformOf({ position: [0, 1.672, -0.112], rotation: [1.2, 0, 0] }),
  });
}

function beardCoverage(vertex: ShapeVertex): number {
  const isFront = smoothstep(-0.03, 0.02, vertex.z);
  const isLow = 1 - smoothstep(1.598, 1.61, vertex.y);
  const isLip =
    smoothstep(0.03, 0.022, Math.abs(vertex.x)) *
    smoothstep(1.553, 1.558, vertex.y) *
    smoothstep(1.578, 1.572, vertex.y);

  return isFront * isLow * (1 - isLip);
}

function beardShell(detail: HumanDetail): Shape {
  const sections: LoftSection[] = [
    { centerZ: 0.052, radiusX: 0, radiusZ: 0, y: 1.5 },
    { centerZ: 0.054, radiusX: 0.034, radiusZ: 0.03, y: 1.51 },
    { centerZ: 0.03, radiusX: 0.071, radiusZ: 0.08, y: 1.545 },
    { centerZ: 0.013, radiusX: 0.092, radiusZ: 0.103, y: 1.58 },
    { centerZ: 0.003, radiusX: 0.101, radiusZ: 0.112, y: 1.62 },
    { centerZ: 0.003, radiusX: 0, radiusZ: 0, y: 1.63 },
  ];

  return deformShape(loft(sections, detail.headSegments), (vertex) => {
    const push = -0.022 * (1 - beardCoverage(vertex));

    return [vertex.normalX * push, vertex.normalY * push, vertex.normalZ * push];
  });
}

export function addShortBeard(builder: MeshBuilder, detail: HumanDetail): void {
  builder.add(beardShell(detail), { style: HAIR });
}

export function addFullBeard(builder: MeshBuilder, detail: HumanDetail): void {
  builder.add(beardShell(detail), { style: HAIR });
  builder.add(
    loft(
      [
        { centerZ: 0.07, radiusX: 0, radiusZ: 0, y: 1.39 },
        { centerZ: 0.075, radiusX: 0.03, radiusZ: 0.022, y: 1.42 },
        { centerZ: 0.075, radiusX: 0.058, radiusZ: 0.04, y: 1.48 },
        { centerZ: 0.07, radiusX: 0.07, radiusZ: 0.045, y: 1.53 },
        { centerZ: 0.06, radiusX: 0.05, radiusZ: 0.035, y: 1.56 },
        { centerZ: 0.06, radiusX: 0, radiusZ: 0, y: 1.565 },
      ],
      detail.headSegments
    ),
    { style: HAIR }
  );
}

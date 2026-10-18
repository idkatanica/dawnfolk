import { Vector3 } from "three";
import { FULL_TURN } from "../../shared/math.ts";
import { MaterialSlot } from "../materials.ts";
import type { MeshBuilder, SurfacePoint, VertexStyle } from "../mesh/mesh-builder.ts";
import { type BodySection, cone, lengthwiseLoft, sphere, type TubePoint, tube } from "../mesh/shapes.ts";
import { outermostHit, surfaceTransform } from "../mesh/surface-probe.ts";
import { combine, sideMirror, type Triple, transformOf } from "../mesh/transforms.ts";
import { degrees } from "../rig/curves.ts";
import { rigidStyle } from "../rig/skin-weights.ts";
import type { GaitStyle } from "./quadruped-clips.ts";
import { bodyStyle, legStyle, neckStyle, tailStyle } from "./quadruped-rigging.ts";
import { LEG_SIDES, QuadrupedBone, type QuadrupedFrame } from "./quadruped-skeleton.ts";

export const DEER_FRAME: QuadrupedFrame = {
  bodyContacts: [
    { bone: QuadrupedBone.Chest, position: [0, 0.8, 0.2] },
    { bone: QuadrupedBone.Pelvis, position: [0, 0.82, -0.45] },
    { bone: QuadrupedBone.Chest, position: [0.17, 1.02, 0.2] },
    { bone: QuadrupedBone.Chest, position: [-0.17, 1.02, 0.2] },
    { bone: QuadrupedBone.Pelvis, position: [0.17, 1.02, -0.45] },
    { bone: QuadrupedBone.Pelvis, position: [-0.17, 1.02, -0.45] },
    { bone: QuadrupedBone.Head, position: [0.07, 1.62, 0.95] },
    { bone: QuadrupedBone.Head, position: [-0.07, 1.62, 0.95] },
  ],
  chest: [0, 1.06, 0.3],
  extraBones: [],
  frontHoof: [0.12, 0, 0.445],
  frontLeg: [
    [0.12, 0.98, 0.42],
    [0.12, 0.7, 0.38],
    [0.12, 0.38, 0.42],
  ],
  head: [0, 1.6, 0.8],
  hindHoof: [0.12, 0, -0.565],
  hindLeg: [
    [0.12, 0.98, -0.52],
    [0.12, 0.66, -0.36],
    [0.12, 0.44, -0.62],
  ],
  neck: [0, 1.16, 0.56],
  pelvis: [0, 1.06, -0.5],
  spine: [0, 1.04, -0.12],
  tail: [0, 1.1, -0.78],
};

export const DEER_GAIT: GaitStyle = {
  grazeReach: degrees(70),
  headBob: degrees(4),
  lowerFlex: degrees(55),
  runKind: "gallop",
  runSwing: degrees(38),
  tailSwish: degrees(14),
  walkSwing: degrees(20),
};

const BODY: readonly BodySection[] = [
  { centerY: 1.08, halfHeight: 0, halfWidth: 0, z: -0.8 },
  { centerY: 1.08, halfHeight: 0.1, halfWidth: 0.08, z: -0.765 },
  { centerY: 1.04, halfHeight: 0.19, halfWidth: 0.15, z: -0.64 },
  { centerY: 1.02, halfHeight: 0.21, halfWidth: 0.165, z: -0.45 },
  { centerY: 1, halfHeight: 0.21, halfWidth: 0.155, z: -0.15 },
  { centerY: 1.02, halfHeight: 0.23, halfWidth: 0.165, z: 0.15 },
  { centerY: 1.06, halfHeight: 0.24, halfWidth: 0.155, z: 0.38 },
  { centerY: 1.1, halfHeight: 0.2, halfWidth: 0.12, z: 0.52 },
  { centerY: 1.12, halfHeight: 0, halfWidth: 0, z: 0.6 },
];

const FRONT_LEG: readonly (readonly TubePoint[])[] = [
  [
    { radius: 0.085, x: 0.12, y: 1.04, z: 0.42 },
    { radius: 0.066, x: 0.12, y: 0.84, z: 0.4 },
    { radius: 0.05, x: 0.12, y: 0.69, z: 0.38 },
  ],
  [
    { radius: 0.046, x: 0.12, y: 0.73, z: 0.38 },
    { radius: 0.035, x: 0.12, y: 0.5, z: 0.41 },
    { radius: 0.032, x: 0.12, y: 0.37, z: 0.42 },
  ],
  [
    { radius: 0.03, x: 0.12, y: 0.41, z: 0.42 },
    { radius: 0.022, x: 0.12, y: 0.13, z: 0.44 },
    { radius: 0.023, x: 0.12, y: 0.06, z: 0.445 },
  ],
];

const HIND_LEG: readonly (readonly TubePoint[])[] = [
  [
    { radius: 0.13, x: 0.12, y: 1.06, z: -0.52 },
    { radius: 0.1, x: 0.12, y: 0.85, z: -0.44 },
    { radius: 0.06, x: 0.12, y: 0.66, z: -0.36 },
  ],
  [
    { radius: 0.056, x: 0.12, y: 0.69, z: -0.37 },
    { radius: 0.042, x: 0.12, y: 0.55, z: -0.5 },
    { radius: 0.035, x: 0.12, y: 0.43, z: -0.62 },
  ],
  [
    { radius: 0.031, x: 0.12, y: 0.47, z: -0.62 },
    { radius: 0.022, x: 0.12, y: 0.13, z: -0.57 },
    { radius: 0.023, x: 0.12, y: 0.06, z: -0.565 },
  ],
];

const BLEND = 0.06;

function coatSlot(point: SurfacePoint): number {
  const { y, z } = point.position;

  const isBelly = y < 0.9 && z > -0.62 && z < 0.5;
  const isRump = z < -0.7;

  return isBelly || isRump ? MaterialSlot.CoatLight : MaterialSlot.Coat;
}

function addLegs(builder: MeshBuilder, segments: number): void {
  for (const side of LEG_SIDES) {
    const mirror = sideMirror(side);

    for (const [end, segmentsOfLeg] of [
      ["front", FRONT_LEG],
      ["hind", HIND_LEG],
    ] as const) {
      const style: VertexStyle = { ...legStyle(DEER_FRAME, end, side, BLEND), slot: MaterialSlot.Coat };

      for (const points of segmentsOfLeg) {
        builder.add(tube(points, { radialSegments: segments }), { style, transform: mirror });
      }

      const hoof: Triple = end === "front" ? [0.12, 0, 0.45] : [0.12, 0, -0.56];

      builder.add(cone(0.032, 0.075, segments), {
        style: { ...style, slot: MaterialSlot.Hoof },
        transform: combine(mirror, transformOf({ position: hoof, scale: [1, 1, 1.25] })),
      });
    }
  }
}

function addHead(builder: MeshBuilder, segments: number): void {
  const head = rigidStyle(QuadrupedBone.Head);

  builder.add(
    tube(
      [
        { radius: 0.084, x: 0, y: 1.665, z: 0.75 },
        { radius: 0.088, x: 0, y: 1.665, z: 0.85 },
        { radius: 0.066, x: 0, y: 1.6, z: 0.98 },
        { radius: 0.046, x: 0, y: 1.535, z: 1.08 },
        { radius: 0.04, x: 0, y: 1.505, z: 1.14 },
        { radius: 0, x: 0, y: 1.495, z: 1.165 },
      ],
      { hasEndCap: false, radialSegments: segments }
    ),
    { style: { ...head, slot: MaterialSlot.Coat }, transform: transformOf({ scale: [0.78, 1, 1] }) }
  );
  builder.add(sphere(0.026, 6, 4), {
    style: { ...head, slot: MaterialSlot.Hoof },
    transform: transformOf({ position: [0, 1.508, 1.148] }),
  });

  for (const side of LEG_SIDES) {
    const mirror = sideMirror(side);

    builder.add(sphere(0.016, 6, 4), {
      style: { ...head, slot: MaterialSlot.Eye },
      transform: combine(mirror, transformOf({ position: [0.058, 1.678, 0.9] })),
    });
    builder.add(cone(0.042, 0.15, 6), {
      style: { ...head, slot: MaterialSlot.Coat },
      transform: combine(
        mirror,
        transformOf({ position: [0.06, 1.72, 0.78], rotation: [-0.5, 0.2, -0.9], scale: [1, 1, 0.42] })
      ),
    });
  }
}

export function addDeerBody(builder: MeshBuilder, segments: number): void {
  builder.add(lengthwiseLoft(BODY, segments + 2), { style: { ...bodyStyle(DEER_FRAME, 0.14), slot: coatSlot } });
  builder.add(
    tube(
      [
        { radius: 0.12, x: 0, y: 1.1, z: 0.42 },
        { radius: 0.1, x: 0, y: 1.28, z: 0.6 },
        { radius: 0.082, x: 0, y: 1.48, z: 0.73 },
        { radius: 0.076, x: 0, y: 1.63, z: 0.8 },
      ],
      { radialSegments: segments }
    ),
    {
      style: {
        ...neckStyle(DEER_FRAME, 0.09),
        slot: (point) =>
          point.position.z > 0.62 && point.position.y < 1.45 ? MaterialSlot.CoatLight : MaterialSlot.Coat,
      },
      transform: transformOf({ scale: [0.82, 1, 1] }),
    }
  );
  addHead(builder, segments);
  addLegs(builder, Math.max(5, segments - 2));
  builder.add(cone(0.055, 0.17, 6), {
    style: { ...tailStyle(DEER_FRAME, 0.04), slot: MaterialSlot.CoatLight },
    transform: transformOf({ position: [0, 1.12, -0.77], rotation: [2.5, 0, 0], scale: [1, 1, 0.5] }),
  });
}

function antlerBeam(scale: number): TubePoint[] {
  return [
    { radius: 0.024, x: 0.05, y: 1.74, z: 0.8 },
    { radius: 0.021, x: 0.12, y: 1.74 + 0.18 * scale, z: 0.8 - 0.06 * scale },
    { radius: 0.017, x: 0.12 + 0.08 * scale, y: 1.74 + 0.34 * scale, z: 0.8 - 0.14 * scale },
    { radius: 0.012, x: 0.12 + 0.12 * scale, y: 1.74 + 0.48 * scale, z: 0.8 - 0.2 * scale },
    { radius: 0, x: 0.12 + 0.1 * scale, y: 1.74 + 0.58 * scale, z: 0.8 - 0.18 * scale },
  ];
}

function antlerTine(start: Triple, end: Triple): TubePoint[] {
  return [
    { radius: 0.014, x: start[0], y: start[1], z: start[2] },
    { radius: 0, x: end[0], y: end[1], z: end[2] },
  ];
}

function addAntlers(builder: MeshBuilder, segments: number, scale: number): void {
  const style = { ...rigidStyle(QuadrupedBone.Head), slot: MaterialSlot.Antler };

  for (const side of LEG_SIDES) {
    const mirror = sideMirror(side);

    builder.add(tube(antlerBeam(scale), { radialSegments: Math.max(4, segments - 3) }), { style, transform: mirror });

    for (const [start, end] of antlerTines(scale)) {
      builder.add(tube(antlerTine(start, end), { radialSegments: 4 }), { style, transform: mirror });
    }
  }
}

function antlerTines(scale: number): (readonly [Triple, Triple])[] {
  const point = (x: number, rise: number, z: number): Triple => [x, 1.74 + rise * scale, z];

  return [
    [point(0.08, 0.06, 0.79), point(0.1, 0.11, 0.93)],
    [point(0.13, 0.24, 0.73), point(0.17, 0.29, 0.86)],
    [point(0.2, 0.38, 0.65), point(0.26, 0.5, 0.72)],
  ];
}

export function addSmallAntlers(builder: MeshBuilder, segments: number): void {
  addAntlers(builder, segments, 0.72);
}

export function addLargeAntlers(builder: MeshBuilder, segments: number): void {
  addAntlers(builder, segments, 1.1);
}

const SPOT_COUNT = 14;
const SPOT_RAY_HEIGHT = 1;
const SPOT_FLATNESS = transformOf({ scale: [1, 0.5, 1] });

export function addFawnSpots(builder: MeshBuilder, segments: number): void {
  const style = { ...bodyStyle(DEER_FRAME, 0.14), slot: MaterialSlot.CoatLight };
  const body = lengthwiseLoft(BODY, segments + 2);

  for (let index = 0; index < SPOT_COUNT; index += 1) {
    const side = index % 2 === 0 ? 1 : -1;
    const z = -0.55 + (Math.floor(index / 2) / 6) * 0.95;
    const angle = (index * 0.37) % 1;

    const across = new Vector3(
      side * (0.07 + 0.05 * angle),
      1.2 + 0.03 * Math.cos(angle * FULL_TURN) - SPOT_RAY_HEIGHT,
      0
    );

    const hit = outermostHit(body, new Vector3(0, SPOT_RAY_HEIGHT, z), across);

    if (hit === null) {
      continue;
    }

    builder.add(sphere(0.022, 5, 3), { style, transform: combine(surfaceTransform(hit), SPOT_FLATNESS) });
  }
}

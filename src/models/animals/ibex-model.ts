import { MaterialSlot } from "../materials.ts";
import type { MeshBuilder, SurfacePoint, VertexStyle } from "../mesh/mesh-builder.ts";
import { type BodySection, cone, lengthwiseLoft, sphere, type TubePoint, tube } from "../mesh/shapes.ts";
import { combine, sideMirror, type Triple, transformOf } from "../mesh/transforms.ts";
import { degrees } from "../rig/curves.ts";
import { rigidStyle } from "../rig/skin-weights.ts";
import type { GaitStyle } from "./quadruped-clips.ts";
import { bodyStyle, legStyle, neckStyle, tailStyle } from "./quadruped-rigging.ts";
import { LEG_SIDES, QuadrupedBone, type QuadrupedFrame } from "./quadruped-skeleton.ts";

export const IBEX_FRAME: QuadrupedFrame = {
  bodyContacts: [
    { bone: QuadrupedBone.Chest, position: [0, 0.6, 0.18] },
    { bone: QuadrupedBone.Pelvis, position: [0, 0.62, -0.4] },
    { bone: QuadrupedBone.Chest, position: [0.18, 0.84, 0.18] },
    { bone: QuadrupedBone.Chest, position: [-0.18, 0.84, 0.18] },
    { bone: QuadrupedBone.Pelvis, position: [0.18, 0.84, -0.4] },
    { bone: QuadrupedBone.Pelvis, position: [-0.18, 0.84, -0.4] },
    { bone: QuadrupedBone.Head, position: [0.07, 1.24, 0.72] },
    { bone: QuadrupedBone.Head, position: [-0.07, 1.24, 0.72] },
  ],
  chest: [0, 0.86, 0.22],
  extraBones: [],
  frontHoof: [0.13, 0, 0.345],
  frontLeg: [
    [0.13, 0.76, 0.32],
    [0.13, 0.5, 0.3],
    [0.13, 0.24, 0.33],
  ],
  head: [0, 1.22, 0.6],
  hindHoof: [0.13, 0, -0.455],
  hindLeg: [
    [0.13, 0.8, -0.44],
    [0.13, 0.52, -0.3],
    [0.13, 0.3, -0.5],
  ],
  neck: [0, 0.96, 0.4],
  pelvis: [0, 0.84, -0.42],
  spine: [0, 0.83, -0.1],
  tail: [0, 0.92, -0.62],
};

export const IBEX_GAIT: GaitStyle = {
  deadHeadRoll: -degrees(40),
  grazeReach: degrees(62),
  headBob: degrees(4),
  lowerFlex: degrees(52),
  runKind: "gallop",
  runSwing: degrees(36),
  tailSwish: degrees(12),
  walkSwing: degrees(20),
};

const BODY: readonly BodySection[] = [
  { centerY: 0.88, halfHeight: 0, halfWidth: 0, z: -0.66 },
  { centerY: 0.88, halfHeight: 0.1, halfWidth: 0.09, z: -0.63 },
  { centerY: 0.86, halfHeight: 0.19, halfWidth: 0.17, z: -0.52 },
  { centerY: 0.84, halfHeight: 0.21, halfWidth: 0.19, z: -0.32 },
  { centerY: 0.83, halfHeight: 0.22, halfWidth: 0.19, z: -0.06 },
  { centerY: 0.86, halfHeight: 0.24, halfWidth: 0.19, z: 0.18 },
  { centerY: 0.9, halfHeight: 0.22, halfWidth: 0.16, z: 0.36 },
  { centerY: 0.94, halfHeight: 0.16, halfWidth: 0.12, z: 0.46 },
  { centerY: 0.96, halfHeight: 0, halfWidth: 0, z: 0.52 },
];

const FRONT_LEG: readonly (readonly TubePoint[])[] = [
  [
    { radius: 0.098, x: 0.13, y: 0.82, z: 0.32 },
    { radius: 0.081, x: 0.13, y: 0.64, z: 0.31 },
    { radius: 0.062, x: 0.13, y: 0.49, z: 0.3 },
  ],
  [
    { radius: 0.057, x: 0.13, y: 0.53, z: 0.3 },
    { radius: 0.046, x: 0.13, y: 0.34, z: 0.32 },
    { radius: 0.043, x: 0.13, y: 0.23, z: 0.33 },
  ],
  [
    { radius: 0.041, x: 0.13, y: 0.27, z: 0.33 },
    { radius: 0.034, x: 0.13, y: 0.1, z: 0.34 },
    { radius: 0.036, x: 0.13, y: 0.06, z: 0.345 },
  ],
];

const HIND_LEG: readonly (readonly TubePoint[])[] = [
  [
    { radius: 0.138, x: 0.13, y: 0.86, z: -0.44 },
    { radius: 0.109, x: 0.13, y: 0.68, z: -0.37 },
    { radius: 0.069, x: 0.13, y: 0.52, z: -0.3 },
  ],
  [
    { radius: 0.063, x: 0.13, y: 0.55, z: -0.31 },
    { radius: 0.052, x: 0.13, y: 0.42, z: -0.4 },
    { radius: 0.046, x: 0.13, y: 0.29, z: -0.5 },
  ],
  [
    { radius: 0.044, x: 0.13, y: 0.33, z: -0.5 },
    { radius: 0.034, x: 0.13, y: 0.1, z: -0.46 },
    { radius: 0.036, x: 0.13, y: 0.06, z: -0.455 },
  ],
];

const BLEND = 0.06;

function coatSlot(point: SurfacePoint): number {
  const { y, z } = point.position;

  const isBelly = y < 0.68 && z > -0.5 && z < 0.4;
  const isRump = z < -0.6;

  return isBelly || isRump ? MaterialSlot.CoatLight : MaterialSlot.Coat;
}

function addLegs(builder: MeshBuilder, segments: number): void {
  for (const side of LEG_SIDES) {
    const mirror = sideMirror(side);

    for (const [end, segmentsOfLeg] of [
      ["front", FRONT_LEG],
      ["hind", HIND_LEG],
    ] as const) {
      const style: VertexStyle = { ...legStyle(IBEX_FRAME, end, side, BLEND), slot: MaterialSlot.Coat };

      for (const points of segmentsOfLeg) {
        builder.add(tube(points, { radialSegments: segments }), { style, transform: mirror });
      }

      const hoof: Triple = end === "front" ? [0.13, 0, 0.35] : [0.13, 0, -0.45];

      builder.add(cone(0.04, 0.08, segments), {
        style: { ...style, slot: MaterialSlot.Hoof },
        transform: combine(mirror, transformOf({ position: hoof, scale: [1, 1, 1.2] })),
      });
    }
  }
}

function addHead(builder: MeshBuilder, segments: number): void {
  const head = rigidStyle(QuadrupedBone.Head);

  builder.add(
    tube(
      [
        { radius: 0.085, x: 0, y: 1.28, z: 0.55 },
        { radius: 0.09, x: 0, y: 1.27, z: 0.63 },
        { radius: 0.07, x: 0, y: 1.21, z: 0.74 },
        { radius: 0.05, x: 0, y: 1.15, z: 0.83 },
        { radius: 0.042, x: 0, y: 1.13, z: 0.87 },
        { radius: 0, x: 0, y: 1.125, z: 0.89 },
      ],
      { hasEndCap: false, radialSegments: segments }
    ),
    { style: { ...head, slot: MaterialSlot.Coat }, transform: transformOf({ scale: [0.8, 1, 1] }) }
  );
  builder.add(sphere(0.026, 6, 4), {
    style: { ...head, slot: MaterialSlot.Hoof },
    transform: transformOf({ position: [0, 1.13, 0.875] }),
  });

  for (const side of LEG_SIDES) {
    const mirror = sideMirror(side);

    builder.add(sphere(0.016, 6, 4), {
      style: { ...head, slot: MaterialSlot.Eye },
      transform: combine(mirror, transformOf({ position: [0.06, 1.29, 0.66] })),
    });
    builder.add(cone(0.03, 0.11, 6), {
      style: { ...head, slot: MaterialSlot.Coat },
      transform: combine(
        mirror,
        transformOf({ position: [0.06, 1.3, 0.56], rotation: [0.2, 0, -1.25], scale: [1, 1, 0.45] })
      ),
    });
  }
}

export function addIbexBody(builder: MeshBuilder, segments: number): void {
  builder.add(lengthwiseLoft(BODY, segments + 2), { style: { ...bodyStyle(IBEX_FRAME, 0.14), slot: coatSlot } });
  builder.add(
    tube(
      [
        { radius: 0.15, x: 0, y: 0.92, z: 0.34 },
        { radius: 0.13, x: 0, y: 1.04, z: 0.45 },
        { radius: 0.1, x: 0, y: 1.18, z: 0.54 },
        { radius: 0.088, x: 0, y: 1.27, z: 0.58 },
      ],
      { radialSegments: segments }
    ),
    {
      style: { ...neckStyle(IBEX_FRAME, 0.09), slot: MaterialSlot.Coat },
      transform: transformOf({ scale: [0.85, 1, 1] }),
    }
  );
  addHead(builder, segments);
  addLegs(builder, Math.max(5, segments - 2));
  builder.add(cone(0.05, 0.12, 6), {
    style: { ...tailStyle(IBEX_FRAME, 0.04), slot: MaterialSlot.Coat },
    transform: transformOf({ position: [0, 0.93, -0.62], rotation: [-0.5, 0, 0], scale: [1, 1, 0.6] }),
  });
}

function hornPath(length: number): TubePoint[] {
  return [
    { radius: 0.036, x: 0.04, y: 1.3, z: 0.6 },
    { radius: 0.034, x: 0.055, y: 1.3 + 0.13 * length, z: 0.58 - 0.03 * length },
    { radius: 0.03, x: 0.07, y: 1.3 + 0.24 * length, z: 0.58 - 0.12 * length },
    { radius: 0.024, x: 0.085, y: 1.3 + 0.29 * length, z: 0.58 - 0.25 * length },
    { radius: 0.016, x: 0.095, y: 1.3 + 0.26 * length, z: 0.58 - 0.37 * length },
    { radius: 0, x: 0.1, y: 1.3 + 0.17 * length, z: 0.58 - 0.44 * length },
  ];
}

function addHorns(builder: MeshBuilder, segments: number, length: number): void {
  const style = { ...rigidStyle(QuadrupedBone.Head), slot: MaterialSlot.Horn };

  for (const side of LEG_SIDES) {
    builder.add(tube(hornPath(length), { hasEndCap: false, radialSegments: Math.max(5, segments - 3) }), {
      style,
      transform: sideMirror(side),
    });
  }
}

export function addShortHorns(builder: MeshBuilder, segments: number): void {
  addHorns(builder, segments, 0.45);
}

export function addLongHorns(builder: MeshBuilder, segments: number): void {
  addHorns(builder, segments, 1.15);
  builder.add(cone(0.035, 0.13, 6), {
    style: { ...rigidStyle(QuadrupedBone.Head), slot: MaterialSlot.CoatLight },
    transform: transformOf({ position: [0, 1.135, 0.79], rotation: [Math.PI, 0, 0], scale: [1, 1, 0.7] }),
  });
}

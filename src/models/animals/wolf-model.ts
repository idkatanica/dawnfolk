import { MaterialSlot } from "../materials.ts";
import type { MeshBuilder, SurfacePoint, VertexStyle } from "../mesh/mesh-builder.ts";
import { type BodySection, cone, lengthwiseLoft, sphere, type TubePoint, tube } from "../mesh/shapes.ts";
import { combine, sideMirror, type Triple, transformOf } from "../mesh/transforms.ts";
import { degrees } from "../rig/curves.ts";
import { rigidStyle } from "../rig/skin-weights.ts";
import type { GaitStyle } from "./quadruped-clips.ts";
import { bodyStyle, legStyle, neckStyle, tailStyle } from "./quadruped-rigging.ts";
import { LEG_SIDES, QuadrupedBone, type QuadrupedFrame } from "./quadruped-skeleton.ts";

export const WOLF_FRAME: QuadrupedFrame = {
  bodyContacts: [
    { bone: QuadrupedBone.Chest, position: [0, 0.6, 0.25] },
    { bone: QuadrupedBone.Pelvis, position: [0, 0.62, -0.45] },
    { bone: QuadrupedBone.Chest, position: [0.15, 0.8, 0.25] },
    { bone: QuadrupedBone.Chest, position: [-0.15, 0.8, 0.25] },
    { bone: QuadrupedBone.Pelvis, position: [0.14, 0.8, -0.45] },
    { bone: QuadrupedBone.Pelvis, position: [-0.14, 0.8, -0.45] },
    { bone: QuadrupedBone.Head, position: [0.08, 1.02, 0.7] },
    { bone: QuadrupedBone.Head, position: [-0.08, 1.02, 0.7] },
  ],
  chest: [0, 0.82, 0.26],
  extraBones: [],
  frontHoof: [0.11, 0, 0.39],
  frontLeg: [
    [0.11, 0.72, 0.36],
    [0.11, 0.44, 0.34],
    [0.11, 0.14, 0.37],
  ],
  head: [0, 1.02, 0.64],
  hindHoof: [0.11, 0, -0.54],
  hindLeg: [
    [0.11, 0.76, -0.5],
    [0.11, 0.48, -0.36],
    [0.11, 0.2, -0.56],
  ],
  neck: [0, 0.88, 0.46],
  pelvis: [0, 0.8, -0.48],
  spine: [0, 0.79, -0.12],
  tail: [0, 0.84, -0.66],
};

export const WOLF_GAIT: GaitStyle = {
  deadHeadRoll: 0,
  grazeReach: degrees(55),
  headBob: degrees(3),
  lowerFlex: degrees(55),
  runKind: "gallop",
  runSwing: degrees(42),
  tailSwish: degrees(8),
  walkSwing: degrees(27),
};

const BODY: readonly BodySection[] = [
  { centerY: 0.82, halfHeight: 0, halfWidth: 0, z: -0.7 },
  { centerY: 0.82, halfHeight: 0.09, halfWidth: 0.08, z: -0.67 },
  { centerY: 0.81, halfHeight: 0.16, halfWidth: 0.13, z: -0.56 },
  { centerY: 0.8, halfHeight: 0.17, halfWidth: 0.14, z: -0.36 },
  { centerY: 0.8, halfHeight: 0.16, halfWidth: 0.13, z: -0.12 },
  { centerY: 0.81, halfHeight: 0.2, halfWidth: 0.15, z: 0.14 },
  { centerY: 0.84, halfHeight: 0.22, halfWidth: 0.15, z: 0.34 },
  { centerY: 0.87, halfHeight: 0.16, halfWidth: 0.11, z: 0.47 },
  { centerY: 0.89, halfHeight: 0, halfWidth: 0, z: 0.53 },
];

const FRONT_LEG: readonly (readonly TubePoint[])[] = [
  [
    { radius: 0.075, x: 0.11, y: 0.8, z: 0.36 },
    { radius: 0.06, x: 0.11, y: 0.6, z: 0.35 },
    { radius: 0.045, x: 0.11, y: 0.43, z: 0.34 },
  ],
  [
    { radius: 0.042, x: 0.11, y: 0.47, z: 0.34 },
    { radius: 0.034, x: 0.11, y: 0.26, z: 0.36 },
    { radius: 0.032, x: 0.11, y: 0.13, z: 0.37 },
  ],
  [
    { radius: 0.031, x: 0.11, y: 0.17, z: 0.37 },
    { radius: 0.03, x: 0.11, y: 0.06, z: 0.38 },
  ],
];

const HIND_LEG: readonly (readonly TubePoint[])[] = [
  [
    { radius: 0.1, x: 0.11, y: 0.82, z: -0.5 },
    { radius: 0.08, x: 0.11, y: 0.64, z: -0.43 },
    { radius: 0.05, x: 0.11, y: 0.48, z: -0.36 },
  ],
  [
    { radius: 0.047, x: 0.11, y: 0.51, z: -0.37 },
    { radius: 0.038, x: 0.11, y: 0.36, z: -0.46 },
    { radius: 0.034, x: 0.11, y: 0.2, z: -0.56 },
  ],
  [
    { radius: 0.032, x: 0.11, y: 0.24, z: -0.56 },
    { radius: 0.03, x: 0.11, y: 0.06, z: -0.54 },
  ],
];

const BLEND = 0.05;

function coatSlot(point: SurfacePoint): number {
  const { y, z } = point.position;

  const isBelly = y < 0.7 && z > -0.55 && z < 0.45;

  return isBelly ? MaterialSlot.CoatLight : MaterialSlot.Coat;
}

function addLegs(builder: MeshBuilder, segments: number): void {
  for (const side of LEG_SIDES) {
    const mirror = sideMirror(side);

    for (const [end, segmentsOfLeg] of [
      ["front", FRONT_LEG],
      ["hind", HIND_LEG],
    ] as const) {
      const style: VertexStyle = { ...legStyle(WOLF_FRAME, end, side, BLEND), slot: MaterialSlot.Coat };

      for (const points of segmentsOfLeg) {
        builder.add(tube(points, { radialSegments: segments }), { style, transform: mirror });
      }

      const paw: Triple = end === "front" ? [0.11, 0.03, 0.4] : [0.11, 0.03, -0.52];

      builder.add(sphere(0.042, segments, Math.max(4, segments - 2)), {
        style: { ...style, slot: MaterialSlot.Coat },
        transform: combine(mirror, transformOf({ position: paw, scale: [0.9, 0.7, 1.35] })),
      });
    }
  }
}

function addHead(builder: MeshBuilder, segments: number): void {
  const head = rigidStyle(QuadrupedBone.Head);

  builder.add(
    tube(
      [
        { radius: 0.1, x: 0, y: 1.05, z: 0.57 },
        { radius: 0.105, x: 0, y: 1.05, z: 0.65 },
        { radius: 0.07, x: 0, y: 1.0, z: 0.76 },
        { radius: 0.045, x: 0, y: 0.97, z: 0.86 },
        { radius: 0.038, x: 0, y: 0.96, z: 0.9 },
        { radius: 0, x: 0, y: 0.958, z: 0.915 },
      ],
      { hasEndCap: false, radialSegments: segments }
    ),
    {
      style: {
        ...head,
        slot: (point) =>
          point.position.y < 0.99 && point.position.z > 0.7 ? MaterialSlot.CoatLight : MaterialSlot.Coat,
      },
      transform: transformOf({ scale: [0.88, 1, 1] }),
    }
  );
  builder.add(sphere(0.026, 6, 4), {
    style: { ...head, slot: MaterialSlot.Hoof },
    transform: transformOf({ position: [0, 0.97, 0.905] }),
  });

  for (const side of LEG_SIDES) {
    const mirror = sideMirror(side);

    builder.add(sphere(0.016, 6, 4), {
      style: { ...head, slot: MaterialSlot.Eye },
      transform: combine(mirror, transformOf({ position: [0.055, 1.08, 0.7] })),
    });
    builder.add(cone(0.045, 0.12, 5), {
      style: { ...head, slot: MaterialSlot.Coat },
      transform: combine(
        mirror,
        transformOf({ position: [0.06, 1.12, 0.6], rotation: [-0.2, 0, -0.3], scale: [1, 1, 0.45] })
      ),
    });
  }
}

const TAIL: readonly TubePoint[] = [
  { radius: 0.045, x: 0, y: 0.85, z: -0.64 },
  { radius: 0.07, x: 0, y: 0.74, z: -0.76 },
  { radius: 0.075, x: 0, y: 0.6, z: -0.83 },
  { radius: 0.055, x: 0, y: 0.47, z: -0.86 },
  { radius: 0, x: 0, y: 0.38, z: -0.86 },
];

export function addWolfBody(builder: MeshBuilder, segments: number): void {
  builder.add(lengthwiseLoft(BODY, segments + 2), { style: { ...bodyStyle(WOLF_FRAME, 0.14), slot: coatSlot } });
  builder.add(
    tube(
      [
        { radius: 0.14, x: 0, y: 0.84, z: 0.38 },
        { radius: 0.125, x: 0, y: 0.92, z: 0.5 },
        { radius: 0.105, x: 0, y: 1.02, z: 0.6 },
      ],
      { radialSegments: segments }
    ),
    {
      style: { ...neckStyle(WOLF_FRAME, 0.09), slot: MaterialSlot.Coat },
      transform: transformOf({ scale: [0.9, 1, 1] }),
    }
  );
  addHead(builder, segments);
  addLegs(builder, Math.max(5, segments - 2));
  builder.add(tube(TAIL, { hasEndCap: false, radialSegments: Math.max(5, segments - 3) }), {
    style: {
      ...tailStyle(WOLF_FRAME, 0.05),
      slot: (point) => (point.position.y < 0.5 ? MaterialSlot.CoatLight : MaterialSlot.Coat),
    },
  });
}

export function addRuff(builder: MeshBuilder, segments: number): void {
  builder.add(sphere(0.2, segments, Math.max(4, segments - 3)), {
    style: {
      ...neckStyle(WOLF_FRAME, 0.09),
      slot: (point) => (point.position.z > 0.5 && point.position.y < 0.86 ? MaterialSlot.CoatLight : MaterialSlot.Coat),
    },
    transform: transformOf({ position: [0, 0.9, 0.44], rotation: [0.6, 0, 0], scale: [0.92, 1.1, 0.72] }),
  });
}

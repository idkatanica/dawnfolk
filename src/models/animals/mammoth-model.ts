import { createVolumeNoise } from "../../shared/noise.ts";
import { createRandom } from "../../shared/random.ts";
import type { AnimalPose } from "../../world/agent-poses.ts";
import { MaterialSlot } from "../materials.ts";
import type { MeshBuilder, VertexStyle } from "../mesh/mesh-builder.ts";
import { deformShape } from "../mesh/shape.ts";
import { type BodySection, blob, cone, lengthwiseLoft, loft, sphere, type TubePoint, tube } from "../mesh/shapes.ts";
import { combine, sideMirror, transformOf } from "../mesh/transforms.ts";
import { degrees, wave } from "../rig/curves.ts";
import type { Pose } from "../rig/pose.ts";
import { chainStyle, createChain, rigidStyle } from "../rig/skin-weights.ts";
import type { AnimalClipContext, GaitStyle } from "./quadruped-clips.ts";
import { bodyStyle, legStyle, neckStyle, tailStyle } from "./quadruped-rigging.ts";
import { LEG_SIDES, QuadrupedBone, type QuadrupedFrame } from "./quadruped-skeleton.ts";

export const MammothBone = {
  TrunkBase: 18,
  TrunkMiddle: 19,
  TrunkTip: 20,
} as const;

export const MAMMOTH_BONE_COUNT = 21;

export const MAMMOTH_FRAME: QuadrupedFrame = {
  bodyContacts: [
    { bone: QuadrupedBone.Chest, position: [0, 1.25, 0.35] },
    { bone: QuadrupedBone.Pelvis, position: [0, 1.3, -0.9] },
    { bone: QuadrupedBone.Chest, position: [0.9, 2.3, 0.3] },
    { bone: QuadrupedBone.Chest, position: [-0.9, 2.3, 0.3] },
    { bone: QuadrupedBone.Pelvis, position: [0.86, 2.15, -0.9] },
    { bone: QuadrupedBone.Pelvis, position: [-0.86, 2.15, -0.9] },
    { bone: QuadrupedBone.Head, position: [0.5, 2.9, 1.45] },
    { bone: QuadrupedBone.Head, position: [-0.5, 2.9, 1.45] },
  ],
  chest: [0, 2.35, 0.45],
  extraBones: [
    { joint: [0, 2.45, 1.85], name: "trunkBase", parent: QuadrupedBone.Head },
    { joint: [0, 1.78, 2.02], name: "trunkMiddle", parent: MammothBone.TrunkBase },
    { joint: [0, 1.12, 2.04], name: "trunkTip", parent: MammothBone.TrunkMiddle },
  ],
  frontHoof: [0.45, 0, 0.66],
  frontLeg: [
    [0.45, 2.1, 0.62],
    [0.45, 1.25, 0.6],
    [0.45, 0.55, 0.64],
  ],
  head: [0, 2.7, 1.3],
  hindHoof: [0.48, 0, -0.98],
  hindLeg: [
    [0.48, 2, -1],
    [0.48, 1.2, -0.85],
    [0.48, 0.55, -1.02],
  ],
  neck: [0, 2.55, 1],
  pelvis: [0, 2.15, -1],
  spine: [0, 2.25, -0.35],
  tail: [0, 2.15, -1.55],
};

export const MAMMOTH_GAIT: GaitStyle = {
  grazeReach: degrees(28),
  headBob: degrees(3),
  lowerFlex: degrees(38),
  runKind: "amble",
  runSwing: degrees(24),
  tailSwish: degrees(18),
  walkSwing: degrees(16),
};

const BODY: readonly BodySection[] = [
  { centerY: 2.1, halfHeight: 0, halfWidth: 0, z: -1.62 },
  { centerY: 2.1, halfHeight: 0.5, halfWidth: 0.45, z: -1.52 },
  { centerY: 2.1, halfHeight: 0.8, halfWidth: 0.78, z: -1.2 },
  { centerY: 2.15, halfHeight: 0.92, halfWidth: 0.88, z: -0.6 },
  { centerY: 2.25, halfHeight: 1, halfWidth: 0.9, z: 0 },
  { centerY: 2.4, halfHeight: 1.08, halfWidth: 0.86, z: 0.5 },
  { centerY: 2.5, halfHeight: 0.95, halfWidth: 0.7, z: 0.95 },
  { centerY: 2.55, halfHeight: 0.7, halfWidth: 0.45, z: 1.2 },
  { centerY: 2.55, halfHeight: 0, halfWidth: 0, z: 1.3 },
];

const FUR_NOISE = createVolumeNoise(createRandom(7171));

const BLEND = 0.2;

function legPoints(x: number, z: number, top: number, joints: readonly [number, number]): TubePoint[][] {
  const [middle, lower] = joints;

  return [
    [
      { radius: 0.4, x, y: top, z },
      { radius: 0.33, x, y: (top + middle) / 2, z },
      { radius: 0.3, x, y: middle - 0.05, z },
    ],
    [
      { radius: 0.29, x, y: middle + 0.05, z },
      { radius: 0.26, x, y: lower - 0.05, z: z + 0.02 },
    ],
    [
      { radius: 0.25, x, y: lower + 0.05, z: z + 0.03 },
      { radius: 0.26, x, y: 0.1, z: z + 0.04 },
      { radius: 0.27, x, y: 0, z: z + 0.04 },
    ],
  ];
}

const LEG_PIECES: Readonly<Record<"front" | "hind", readonly TubePoint[][]>> = {
  front: legPoints(0.45, 0.62, 2.3, [1.25, 0.55]),
  hind: legPoints(0.48, -0.95, 2.2, [1.2, 0.55]),
};

function addLegs(builder: MeshBuilder, segments: number): void {
  for (const side of LEG_SIDES) {
    const mirror = sideMirror(side);

    for (const end of ["front", "hind"] as const) {
      const style: VertexStyle = { ...legStyle(MAMMOTH_FRAME, end, side, BLEND), slot: MaterialSlot.Coat };
      for (const points of LEG_PIECES[end]) {
        builder.add(tube(points, { radialSegments: segments }), { style, transform: mirror });
      }
    }
  }
}

function addFurSkirt(builder: MeshBuilder, segments: number): void {
  const skirt = loft(
    [
      { centerZ: -0.4, radiusX: 0, radiusZ: 0, y: 1.65 },
      { centerZ: -0.4, radiusX: 0.6, radiusZ: 1.2, y: 1.6 },
      { centerZ: -0.42, radiusX: 0.96, radiusZ: 1.62, y: 1.32 },
      { centerZ: -0.4, radiusX: 0.98, radiusZ: 1.66, y: 1.8 },
      { centerZ: -0.35, radiusX: 0.94, radiusZ: 1.62, y: 2.3 },
      { centerZ: -0.35, radiusX: 0, radiusZ: 0, y: 2.35 },
    ],
    segments * 3
  );

  const shaggy = deformShape(skirt, (vertex) => {
    if (vertex.y > 1.4) {
      return [0, 0, 0];
    }

    const strand = FUR_NOISE.sample(vertex.x * 7, 0, vertex.z * 7);

    return [0, -0.12 - 0.14 * Math.abs(strand), 0];
  });

  builder.add(shaggy, { style: { ...bodyStyle(MAMMOTH_FRAME, 0.5), slot: MaterialSlot.Coat } });
}

const TRUNK_STYLE = chainStyle(
  createChain(
    [QuadrupedBone.Head, MammothBone.TrunkBase, MammothBone.TrunkMiddle, MammothBone.TrunkTip],
    [
      { axis: [0, -0.6, 0.3], blend: 0.1, position: [0, 2.45, 1.85] },
      { axis: [0, -1, 0.1], blend: 0.12, position: [0, 1.78, 2.02] },
      { axis: [0, -1, 0.05], blend: 0.1, position: [0, 1.12, 2.04] },
    ]
  )
);

function addHead(builder: MeshBuilder, segments: number): void {
  const head = rigidStyle(QuadrupedBone.Head);

  builder.add(sphere(0.6, segments + 2, segments), {
    style: { ...head, slot: MaterialSlot.Coat },
    transform: transformOf({ position: [0, 2.9, 1.45], scale: [0.82, 1.08, 0.9] }),
  });
  builder.add(blob({ noise: FUR_NOISE, offset: [3, 4, 5], radius: 0.42, roughness: 0.3 }), {
    style: { ...head, slot: MaterialSlot.Coat },
    transform: transformOf({ position: [0, 3.36, 1.3], scale: [0.9, 0.8, 1] }),
  });
  builder.add(
    tube(
      [
        { radius: 0.21, x: 0, y: 2.62, z: 1.88 },
        { radius: 0.17, x: 0, y: 2.15, z: 2.02 },
        { radius: 0.13, x: 0, y: 1.65, z: 2.04 },
        { radius: 0.1, x: 0, y: 1.18, z: 2.04 },
        { radius: 0.08, x: 0, y: 0.98, z: 2.12 },
        { radius: 0.065, x: 0, y: 0.92, z: 2.24 },
      ],
      { radialSegments: segments }
    ),
    { style: { ...TRUNK_STYLE, slot: MaterialSlot.Coat } }
  );

  for (const side of LEG_SIDES) {
    const mirror = sideMirror(side);

    builder.add(sphere(0.045, 6, 4), {
      style: { ...head, slot: MaterialSlot.Eye },
      transform: combine(mirror, transformOf({ position: [0.38, 3.0, 1.82] })),
    });
    builder.add(sphere(0.24, segments, Math.max(4, segments - 3)), {
      style: { ...head, slot: MaterialSlot.Coat },
      transform: combine(
        mirror,
        transformOf({ position: [0.5, 3.02, 1.22], rotation: [0, 0.3, 0], scale: [0.35, 1, 0.8] })
      ),
    });
  }
}

function tuskPath(length: number): TubePoint[] {
  return [
    { radius: 0.085, x: 0.16, y: 2.64, z: 1.66 },
    { radius: 0.085, x: 0.28, y: 2.45, z: 1.86 },
    { radius: 0.08, x: 0.34, y: 2.45 - 0.48 * length, z: 1.86 + 0.32 * length },
    { radius: 0.07, x: 0.34 + 0.14 * length, y: 2.45 - 0.78 * length, z: 1.86 + 0.82 * length },
    { radius: 0.055, x: 0.34 + 0.16 * length, y: 2.45 - 0.72 * length, z: 1.86 + 1.3 * length },
    { radius: 0.035, x: 0.34 + 0.02 * length, y: 2.45 - 0.42 * length, z: 1.86 + 1.55 * length },
    { radius: 0, x: 0.34 - 0.14 * length, y: 2.45 - 0.12 * length, z: 1.86 + 1.5 * length },
  ];
}

function addTusks(builder: MeshBuilder, segments: number, length: number): void {
  const style = { ...rigidStyle(QuadrupedBone.Head), slot: MaterialSlot.Tusk };

  for (const side of LEG_SIDES) {
    builder.add(tube(tuskPath(length), { hasEndCap: false, radialSegments: Math.max(5, segments - 2) }), {
      style,
      transform: sideMirror(side),
    });
  }
}

export function addShortTusks(builder: MeshBuilder, segments: number): void {
  addTusks(builder, segments, 0.55);
}

export function addLongTusks(builder: MeshBuilder, segments: number): void {
  addTusks(builder, segments, 1);
}

export function addMammothBody(builder: MeshBuilder, segments: number): void {
  builder.add(lengthwiseLoft(BODY, segments + 4), {
    style: { ...bodyStyle(MAMMOTH_FRAME, 0.5), slot: MaterialSlot.Coat },
  });
  builder.add(blob({ noise: FUR_NOISE, offset: [1, 2, 3], radius: 0.62, roughness: 0.25 }), {
    style: { ...bodyStyle(MAMMOTH_FRAME, 0.5), slot: MaterialSlot.Coat },
    transform: transformOf({ position: [0, 3.18, 0.42], scale: [1.15, 0.72, 1.3] }),
  });
  builder.add(
    tube(
      [
        { radius: 0.7, x: 0, y: 2.55, z: 0.9 },
        { radius: 0.62, x: 0, y: 2.7, z: 1.15 },
        { radius: 0.55, x: 0, y: 2.8, z: 1.35 },
      ],
      { radialSegments: segments + 2 }
    ),
    { style: { ...neckStyle(MAMMOTH_FRAME, 0.25), slot: MaterialSlot.Coat } }
  );
  addHead(builder, segments);
  addLegs(builder, segments);
  addFurSkirt(builder, segments);
  builder.add(
    tube(
      [
        { radius: 0.08, x: 0, y: 2.25, z: -1.52 },
        { radius: 0.05, x: 0, y: 1.9, z: -1.66 },
        { radius: 0.04, x: 0, y: 1.65, z: -1.68 },
      ],
      { radialSegments: 5 }
    ),
    { style: { ...tailStyle(MAMMOTH_FRAME, 0.15), slot: MaterialSlot.Coat } }
  );
  builder.add(cone(0.09, 0.28, 6), {
    style: { ...tailStyle(MAMMOTH_FRAME, 0.15), slot: MaterialSlot.Coat },
    transform: transformOf({ position: [0, 1.66, -1.68], rotation: [Math.PI, 0, 0] }),
  });
}

export function mammothTrunkMotion(pose: Pose, clip: AnimalPose, phase: number, _context: AnimalClipContext): void {
  if (clip === "graze") {
    pose.rotate(MammothBone.TrunkBase, degrees(8), 0, 0);
    pose.rotate(MammothBone.TrunkMiddle, degrees(22) + degrees(10) * wave(phase * 3), 0, 0);
    pose.rotate(MammothBone.TrunkTip, degrees(48) + degrees(15) * wave(phase * 3, 0.2), 0, 0);

    return;
  }

  if (clip === "dead") {
    pose.rotate(MammothBone.TrunkMiddle, degrees(25), 0, 0);

    return;
  }

  pose.rotate(MammothBone.TrunkBase, -degrees(6) * wave(phase), degrees(4) * wave(phase, 0.25), 0);
  pose.rotate(MammothBone.TrunkMiddle, degrees(10) + degrees(8) * wave(phase, 0.1), 0, 0);
  pose.rotate(MammothBone.TrunkTip, degrees(18) + degrees(12) * wave(phase, 0.2), 0, 0);
}

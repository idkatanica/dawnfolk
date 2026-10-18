import { type Matrix4, Vector3 } from "three";
import { MaterialSlot } from "../materials.ts";
import type { MeshBuilder, VertexStyle } from "../mesh/mesh-builder.ts";
import type { Shape } from "../mesh/shape.ts";
import { type LoftSection, loft, sphere, type TubePoint, tube } from "../mesh/shapes.ts";
import { outermostHit } from "../mesh/surface-probe.ts";
import { combine, MIRROR_X, sideMirror, type Triple, transformOf } from "../mesh/transforms.ts";
import { rigidStyle } from "../rig/skin-weights.ts";
import type { HumanDetail } from "./human-detail.ts";
import { armStyle, FLEXIBLE_TORSO_STYLE, legStyle, TORSO_STYLE } from "./human-rigging.ts";
import { HumanBone, HumanJoint, SIDES, type Side, sideBones } from "./human-skeleton.ts";

const HEAD_SECTIONS: readonly LoftSection[] = [
  { centerZ: 0.052, radiusX: 0, radiusZ: 0, y: 1.512 },
  { centerZ: 0.054, radiusX: 0.03, radiusZ: 0.024, y: 1.521 },
  { centerZ: 0.03, radiusX: 0.062, radiusZ: 0.07, y: 1.545 },
  { centerZ: 0.013, radiusX: 0.083, radiusZ: 0.094, y: 1.58 },
  { centerZ: 0.003, radiusX: 0.093, radiusZ: 0.104, y: 1.62 },
  { centerZ: -0.006, radiusX: 0.096, radiusZ: 0.107, y: 1.66 },
  { centerZ: -0.012, radiusX: 0.088, radiusZ: 0.099, y: 1.7 },
  { centerZ: -0.014, radiusX: 0.066, radiusZ: 0.076, y: 1.732 },
  { centerZ: -0.012, radiusX: 0.035, radiusZ: 0.04, y: 1.748 },
  { centerZ: -0.01, radiusX: 0, radiusZ: 0, y: 1.753 },
];

const MALE_TORSO: readonly LoftSection[] = [
  { radiusX: 0, radiusZ: 0, y: 0.84 },
  { radiusX: 0.06, radiusZ: 0.05, y: 0.85 },
  { centerZ: -0.008, radiusX: 0.135, radiusZ: 0.095, y: 0.88 },
  { centerZ: -0.012, radiusX: 0.158, radiusZ: 0.108, y: 0.93 },
  { centerZ: -0.004, radiusX: 0.152, radiusZ: 0.1, y: 0.99 },
  { centerZ: 0.004, radiusX: 0.142, radiusZ: 0.094, y: 1.05 },
  { centerZ: 0.01, radiusX: 0.148, radiusZ: 0.098, y: 1.12 },
  { centerZ: 0.008, radiusX: 0.16, radiusZ: 0.104, y: 1.2 },
  { centerZ: 0.004, radiusX: 0.176, radiusZ: 0.11, y: 1.29 },
  { centerZ: -0.004, radiusX: 0.184, radiusZ: 0.106, y: 1.36 },
  { centerZ: -0.012, radiusX: 0.178, radiusZ: 0.095, y: 1.41 },
  { centerZ: -0.012, radiusX: 0.12, radiusZ: 0.072, y: 1.445 },
  { centerZ: -0.01, radiusX: 0.06, radiusZ: 0.055, y: 1.465 },
  { centerZ: -0.008, radiusX: 0, radiusZ: 0, y: 1.47 },
];

const FEMALE_TORSO: readonly LoftSection[] = [
  { radiusX: 0, radiusZ: 0, y: 0.84 },
  { radiusX: 0.06, radiusZ: 0.05, y: 0.85 },
  { centerZ: -0.012, radiusX: 0.145, radiusZ: 0.1, y: 0.88 },
  { centerZ: -0.016, radiusX: 0.17, radiusZ: 0.112, y: 0.93 },
  { centerZ: -0.006, radiusX: 0.16, radiusZ: 0.102, y: 0.99 },
  { centerZ: 0.004, radiusX: 0.128, radiusZ: 0.086, y: 1.06 },
  { centerZ: 0.01, radiusX: 0.135, radiusZ: 0.09, y: 1.13 },
  { centerZ: 0.014, radiusX: 0.148, radiusZ: 0.1, y: 1.21 },
  { centerZ: 0.024, radiusX: 0.158, radiusZ: 0.118, y: 1.28 },
  { centerZ: 0.016, radiusX: 0.162, radiusZ: 0.112, y: 1.34 },
  { centerZ: -0.008, radiusX: 0.16, radiusZ: 0.092, y: 1.4 },
  { centerZ: -0.012, radiusX: 0.11, radiusZ: 0.07, y: 1.44 },
  { centerZ: -0.01, radiusX: 0.055, radiusZ: 0.052, y: 1.465 },
  { centerZ: -0.008, radiusX: 0, radiusZ: 0, y: 1.47 },
];

const CHILD_TORSO: readonly LoftSection[] = [
  { radiusX: 0, radiusZ: 0, y: 0.84 },
  { radiusX: 0.06, radiusZ: 0.05, y: 0.85 },
  { centerZ: -0.006, radiusX: 0.13, radiusZ: 0.095, y: 0.88 },
  { centerZ: -0.008, radiusX: 0.145, radiusZ: 0.105, y: 0.93 },
  { centerZ: 0.006, radiusX: 0.145, radiusZ: 0.105, y: 1 },
  { centerZ: 0.014, radiusX: 0.15, radiusZ: 0.11, y: 1.08 },
  { centerZ: 0.008, radiusX: 0.15, radiusZ: 0.104, y: 1.18 },
  { centerZ: 0, radiusX: 0.155, radiusZ: 0.1, y: 1.28 },
  { centerZ: -0.006, radiusX: 0.16, radiusZ: 0.096, y: 1.37 },
  { centerZ: -0.012, radiusX: 0.15, radiusZ: 0.088, y: 1.415 },
  { centerZ: -0.012, radiusX: 0.1, radiusZ: 0.066, y: 1.445 },
  { centerZ: -0.01, radiusX: 0.055, radiusZ: 0.05, y: 1.465 },
  { centerZ: -0.008, radiusX: 0, radiusZ: 0, y: 1.47 },
];

const ARM: readonly TubePoint[] = [
  { radius: 0.024, x: 0.18, y: 1.47, z: -0.005 },
  { radius: 0.06, x: 0.19, y: 1.44, z: 0 },
  { radius: 0.064, x: 0.198, y: 1.37, z: -0.003 },
  { radius: 0.055, x: 0.202, y: 1.27, z: -0.004 },
  { radius: 0.047, x: 0.205, y: 1.17, z: -0.005 },
  { radius: 0.045, x: 0.206, y: 1.13, z: -0.004 },
  { radius: 0.047, x: 0.209, y: 1.065, z: 0 },
  { radius: 0.037, x: 0.213, y: 0.965, z: 0.006 },
  { radius: 0.028, x: 0.215, y: 0.895, z: 0.01 },
  { radius: 0.02, x: 0.216, y: 0.858, z: 0.014 },
];

const LEG: readonly TubePoint[] = [
  { radius: 0.055, x: 0.092, y: 0.985, z: -0.005 },
  { radius: 0.095, x: 0.095, y: 0.93, z: 0 },
  { radius: 0.089, x: 0.097, y: 0.82, z: 0.005 },
  { radius: 0.073, x: 0.099, y: 0.68, z: 0.008 },
  { radius: 0.058, x: 0.1, y: 0.56, z: 0.012 },
  { radius: 0.055, x: 0.1, y: 0.5, z: 0.012 },
  { radius: 0.056, x: 0.1, y: 0.44, z: -0.002 },
  { radius: 0.05, x: 0.1, y: 0.32, z: -0.008 },
  { radius: 0.037, x: 0.1, y: 0.2, z: -0.006 },
  { radius: 0.032, x: 0.1, y: 0.11, z: -0.01 },
  { radius: 0.03, x: 0.1, y: 0.07, z: -0.012 },
];

const NECK: readonly TubePoint[] = [
  { radius: 0.053, x: 0, y: 1.43, z: -0.008 },
  { radius: 0.048, x: 0, y: 1.5, z: -0.004 },
  { radius: 0.046, x: 0, y: 1.565, z: 0 },
];

const SKIN_SEAM = 0.035;
const FACE_SEAM = 0.012;
const HAND_SEAM = 0.02;

export const FOOT_SECTIONS: readonly LoftSection[] = [
  { centerZ: -0.035, radiusX: 0, radiusZ: 0, y: -0.064 },
  { centerZ: -0.037, radiusX: 0.028, radiusZ: 0.031, y: -0.054 },
  { centerZ: -0.045, radiusX: 0.035, radiusZ: 0.043, y: -0.02 },
  { centerZ: -0.034, radiusX: 0.041, radiusZ: 0.034, y: 0.04 },
  { centerZ: -0.026, radiusX: 0.045, radiusZ: 0.026, y: 0.1 },
  { centerZ: -0.021, radiusX: 0.042, radiusZ: 0.02, y: 0.148 },
  { centerZ: -0.019, radiusX: 0, radiusZ: 0, y: 0.172 },
];

export function footTransform(side: Side): Matrix4 {
  const placement = transformOf({ position: [0.1, 0, 0], rotation: [Math.PI / 2, 0, 0] });

  if (side === 1) {
    return placement;
  }

  return combine(MIRROR_X, placement);
}

const SKIN = { slot: MaterialSlot.Skin };

export function forEachSide(add: (side: Side, mirror: Matrix4) => void): void {
  for (const side of SIDES) {
    add(side, sideMirror(side));
  }
}

export function headShape(detail: HumanDetail): Shape {
  return loft(HEAD_SECTIONS, detail.headSegments);
}

const HEAD_AXIS_Z = -0.01;

function onHead(head: Shape, point: Triple, lift: number): Vector3 {
  const [x, y, z] = point;

  const hit = outermostHit(head, new Vector3(0, y, HEAD_AXIS_Z), new Vector3(x, 0, z - HEAD_AXIS_Z));

  if (hit === null) {
    return new Vector3(x, y, z);
  }

  return hit.point.addScaledVector(hit.normal, lift);
}

export function headStroke(head: Shape, points: readonly Triple[], radius: number, lift: number): TubePoint[] {
  return points.map((point) => {
    const surface = onHead(head, point, lift);

    return { radius, x: surface.x, y: surface.y, z: surface.z };
  });
}

const BROW: readonly Triple[] = [
  [0.018, 1.653, 0.1],
  [0.035, 1.658, 0.1],
  [0.052, 1.652, 0.1],
];

const MOUTH: readonly Triple[] = [
  [-0.018, 1.566, 0.1],
  [0, 1.563, 0.1],
  [0.018, 1.566, 0.1],
];

function addFace(builder: MeshBuilder, head: Shape, detail: HumanDetail): void {
  const style = rigidStyle(HumanBone.Head);
  const segments = Math.max(5, detail.headSegments / 2);

  builder.add(
    tube(
      [
        { radius: 0.017, x: 0, y: 1.632, z: 0.09 },
        { radius: 0.017, x: 0, y: 1.628, z: 0.097 },
        { radius: 0.015, x: 0, y: 1.603, z: 0.114 },
        { radius: 0.011, x: 0, y: 1.588, z: 0.121 },
        { radius: 0, x: 0, y: 1.584, z: 0.116 },
      ],
      { hasEndCap: false, radialSegments: segments }
    ),
    { seam: FACE_SEAM, style: { ...style, ...SKIN } }
  );

  forEachSide((_side, mirror) => {
    builder.add(sphere(0.028, segments, 5), {
      seam: FACE_SEAM,
      style: { ...style, ...SKIN },
      transform: combine(mirror, transformOf({ position: [0.09, 1.622, -0.008], scale: [0.36, 1, 0.72] })),
    });
  });

  if (!detail.hasFineDetails) {
    return;
  }

  forEachSide((_side, mirror) => {
    builder.add(sphere(0.0125, 8, 5), {
      style: { ...style, slot: MaterialSlot.Eye },
      transform: combine(mirror, transformOf({ position: [0.034, 1.632, 0.094] })),
    });
    builder.add(tube(headStroke(head, BROW, 0.0045, -0.001), { radialSegments: 4 }), {
      style: { ...style, slot: MaterialSlot.Hair },
      transform: mirror,
    });
  });

  builder.add(tube(headStroke(head, MOUTH, 0.0035, -0.0012), { radialSegments: 4 }), {
    style: { ...style, slot: MaterialSlot.Lip },
  });
}

function addHead(builder: MeshBuilder, detail: HumanDetail): void {
  const head = headShape(detail);

  builder.add(head, { seam: SKIN_SEAM, style: { ...rigidStyle(HumanBone.Head), ...SKIN } });
  builder.add(tube(NECK, { radialSegments: detail.limbSegments }), {
    seam: SKIN_SEAM,
    style: { ...TORSO_STYLE, ...SKIN },
  });
  addFace(builder, head, detail);
}

function handShape(builder: MeshBuilder, style: VertexStyle, mirror: Matrix4, detail: HumanDetail): void {
  builder.add(sphere(1, detail.limbSegments, 6), {
    seam: HAND_SEAM,
    style,
    transform: combine(
      mirror,
      transformOf({ position: [0.217, 0.838, 0.016], rotation: [0.08, 0, 0.06], scale: [0.028, 0.054, 0.041] })
    ),
  });
  builder.add(sphere(1, Math.max(5, detail.limbSegments - 2), 5), {
    seam: HAND_SEAM,
    style,
    transform: combine(
      mirror,
      transformOf({ position: [0.202, 0.857, 0.042], rotation: [0.3, 0, 0.4], scale: [0.012, 0.028, 0.013] })
    ),
  });
}

const SHOULDER_RADIUS = 0.058;

function addArms(builder: MeshBuilder, detail: HumanDetail): void {
  forEachSide((side, mirror) => {
    const style = { ...armStyle(side), ...SKIN };

    builder.add(tube(ARM, { radialSegments: detail.limbSegments }), { seam: SKIN_SEAM, style, transform: mirror });
    builder.add(sphere(SHOULDER_RADIUS, detail.limbSegments, Math.max(4, detail.limbSegments - 3)), {
      seam: SKIN_SEAM,
      style: { ...rigidStyle(sideBones(side).upperArm), ...SKIN },
      transform: combine(mirror, transformOf({ position: HumanJoint.Shoulder })),
    });
    handShape(builder, style, mirror, detail);
  });
}

function addLegs(builder: MeshBuilder, detail: HumanDetail): void {
  forEachSide((side, mirror) => {
    const style = { ...legStyle(side), ...SKIN };

    builder.add(tube(LEG, { radialSegments: detail.limbSegments }), { seam: SKIN_SEAM, style, transform: mirror });
    builder.add(loft(FOOT_SECTIONS, detail.limbSegments), {
      seam: SKIN_SEAM,
      style,
      transform: footTransform(side),
    });
  });
}

function torsoShape(sections: readonly LoftSection[], detail: HumanDetail): Shape {
  return loft(sections, detail.torsoSegments);
}

function addLimbReferences(builder: MeshBuilder, detail: HumanDetail): void {
  builder.addSeamReference(tube(NECK, { radialSegments: detail.limbSegments }));

  forEachSide((side, mirror) => {
    builder.addSeamReference(tube(ARM, { radialSegments: detail.limbSegments }), mirror);
    builder.addSeamReference(tube(LEG, { radialSegments: detail.limbSegments }), mirror);
    builder.addSeamReference(loft(FOOT_SECTIONS, detail.limbSegments), footTransform(side));
  });
}

function addTorso(builder: MeshBuilder, sections: readonly LoftSection[], detail: HumanDetail): void {
  builder.add(torsoShape(sections, detail), { seam: SKIN_SEAM, style: { ...FLEXIBLE_TORSO_STYLE, ...SKIN } });
  addLimbReferences(builder, detail);
}

export function addMaleTorso(builder: MeshBuilder, detail: HumanDetail): void {
  addTorso(builder, MALE_TORSO, detail);
}

export function addFemaleTorso(builder: MeshBuilder, detail: HumanDetail): void {
  addTorso(builder, FEMALE_TORSO, detail);
}

export function addChildTorso(builder: MeshBuilder, detail: HumanDetail): void {
  addTorso(builder, CHILD_TORSO, detail);
}

export function addBody(builder: MeshBuilder, detail: HumanDetail): void {
  addHead(builder, detail);
  addArms(builder, detail);
  addLegs(builder, detail);
  builder.addSeamReference(torsoShape(MALE_TORSO, detail));
}

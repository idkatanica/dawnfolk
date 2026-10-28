import type { Triple } from "../mesh/transforms.ts";
import { type BoneDefinition, type ContactPoint, createSkeleton, NO_PARENT } from "../rig/skeleton.ts";

export const HumanBone = {
  Chest: 2,
  FootLeft: 13,
  FootRight: 16,
  ForearmLeft: 6,
  ForearmRight: 9,
  HandLeft: 7,
  HandRight: 10,
  Head: 4,
  Neck: 3,
  Pelvis: 0,
  ShinLeft: 12,
  ShinRight: 15,
  Spine: 1,
  ThighLeft: 11,
  ThighRight: 14,
  UpperArmLeft: 5,
  UpperArmRight: 8,
} as const;

type HumanBoneIndex = (typeof HumanBone)[keyof typeof HumanBone];

export const HumanJoint = {
  Ankle: [0.1, 0.085, -0.012],
  Chest: [0, 1.22, 0],
  Elbow: [0.205, 1.13, -0.005],
  Head: [0, 1.53, 0.01],
  Hip: [0.095, 0.93, 0],
  Knee: [0.1, 0.5, 0.012],
  Neck: [0, 1.46, -0.005],
  Pelvis: [0, 0.95, 0],
  Shoulder: [0.19, 1.42, 0],
  Spine: [0, 1.03, 0],
  Wrist: [0.215, 0.885, 0.01],
} as const satisfies Readonly<Record<string, Triple>>;

export const HUMAN_BONE_COUNT = 17;

export type Side = -1 | 1;

export const SIDES: readonly Side[] = [1, -1];

interface SideBones {
  readonly foot: HumanBoneIndex;
  readonly forearm: HumanBoneIndex;
  readonly hand: HumanBoneIndex;
  readonly name: string;
  readonly shin: HumanBoneIndex;
  readonly thigh: HumanBoneIndex;
  readonly upperArm: HumanBoneIndex;
}

const LEFT_BONES: SideBones = {
  foot: HumanBone.FootLeft,
  forearm: HumanBone.ForearmLeft,
  hand: HumanBone.HandLeft,
  name: "Left",
  shin: HumanBone.ShinLeft,
  thigh: HumanBone.ThighLeft,
  upperArm: HumanBone.UpperArmLeft,
};

const RIGHT_BONES: SideBones = {
  foot: HumanBone.FootRight,
  forearm: HumanBone.ForearmRight,
  hand: HumanBone.HandRight,
  name: "Right",
  shin: HumanBone.ShinRight,
  thigh: HumanBone.ThighRight,
  upperArm: HumanBone.UpperArmRight,
};

export const HUMAN_SKELETON = createSkeleton({
  bodyContacts: [
    ...sideContacts(1),
    ...sideContacts(-1),
    { bone: HumanBone.Pelvis, position: [0, 0.86, -0.1] },
    { bone: HumanBone.Chest, position: [0, 1.3, -0.125] },
    { bone: HumanBone.Chest, position: [0, 1.3, 0.13] },
    { bone: HumanBone.Head, position: [0, 1.64, -0.11] },
    { bone: HumanBone.Head, position: [0, 1.75, 0] },
    { bone: HumanBone.Head, position: [0, 1.62, 0.12] },
  ],
  bones: [
    { joint: HumanJoint.Pelvis, name: "pelvis", parent: NO_PARENT },
    { joint: HumanJoint.Spine, name: "spine", parent: HumanBone.Pelvis },
    { joint: HumanJoint.Chest, name: "chest", parent: HumanBone.Spine },
    { joint: HumanJoint.Neck, name: "neck", parent: HumanBone.Chest },
    { joint: HumanJoint.Head, name: "head", parent: HumanBone.Neck },
    ...armBones(1),
    ...armBones(-1),
    ...legBones(1),
    ...legBones(-1),
  ],
  footContacts: [...footContacts(1), ...footContacts(-1)],
});

export function otherSide(side: Side): Side {
  return side === 1 ? -1 : 1;
}

export function onSide(point: Triple, side: Side): Triple {
  return [point[0] * side, point[1], point[2]];
}

export function sideBones(side: Side): SideBones {
  return side === 1 ? LEFT_BONES : RIGHT_BONES;
}

function armBones(side: Side): BoneDefinition[] {
  const bones = sideBones(side);

  return [
    { joint: onSide(HumanJoint.Shoulder, side), name: `upperArm${bones.name}`, order: "limb", parent: HumanBone.Chest },
    { joint: onSide(HumanJoint.Elbow, side), name: `forearm${bones.name}`, order: "limb", parent: bones.upperArm },
    { joint: onSide(HumanJoint.Wrist, side), name: `hand${bones.name}`, order: "limb", parent: bones.forearm },
  ];
}

function legBones(side: Side): BoneDefinition[] {
  const bones = sideBones(side);

  return [
    { joint: onSide(HumanJoint.Hip, side), name: `thigh${bones.name}`, order: "limb", parent: HumanBone.Pelvis },
    { joint: onSide(HumanJoint.Knee, side), name: `shin${bones.name}`, order: "limb", parent: bones.thigh },
    { joint: onSide(HumanJoint.Ankle, side), name: `foot${bones.name}`, order: "limb", parent: bones.shin },
  ];
}

function footContacts(side: Side): ContactPoint[] {
  const { foot } = sideBones(side);

  return [
    { bone: foot, position: [0.1 * side, 0, -0.055] },
    { bone: foot, position: [0.1 * side, 0, 0.165] },
  ];
}

function sideContacts(side: Side): ContactPoint[] {
  const { forearm, hand, shin } = sideBones(side);

  return [
    { bone: shin, position: [0.1 * side, 0.5, 0.065] },
    { bone: HumanBone.Pelvis, position: [0.16 * side, 0.94, 0] },
    { bone: HumanBone.Chest, position: [0.24 * side, 1.38, 0] },
    { bone: HumanBone.Head, position: [0.105 * side, 1.64, 0] },
    { bone: forearm, position: [0.205 * side, 1.13, -0.045] },
    { bone: hand, position: [0.215 * side, 0.8, 0.02] },
  ];
}

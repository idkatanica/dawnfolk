import type { Pose } from "../rig/pose.ts";
import { HumanBone, type Side, sideBones } from "./human-skeleton.ts";

type TrunkBone = typeof HumanBone.Chest | typeof HumanBone.Head | typeof HumanBone.Neck | typeof HumanBone.Spine;

interface TrunkMotion {
  readonly forward?: number;
  readonly toLeft?: number;
  readonly turnLeft?: number;
}

interface LimbMotion {
  readonly forward?: number;
  readonly outward?: number;
  readonly twist?: number;
}

function rotateTrunk(pose: Pose, bone: number, motion: TrunkMotion): void {
  const { forward = 0, toLeft = 0, turnLeft = 0 } = motion;

  pose.rotate(bone, forward, -toLeft, turnLeft);
}

export function moveBody(pose: Pose, motion: TrunkMotion): void {
  rotateTrunk(pose, HumanBone.Pelvis, motion);
}

export function bendTrunk(pose: Pose, bone: TrunkBone, motion: TrunkMotion): void {
  rotateTrunk(pose, bone, motion);
}

function swingLimb(pose: Pose, bone: number, side: Side, motion: LimbMotion): void {
  const { forward = 0, outward = 0, twist = 0 } = motion;

  pose.rotate(bone, -forward, side * outward, side * twist);
}

export function swingArm(pose: Pose, side: Side, motion: LimbMotion): void {
  swingLimb(pose, sideBones(side).upperArm, side, motion);
}

export function swingLeg(pose: Pose, side: Side, motion: LimbMotion): void {
  swingLimb(pose, sideBones(side).thigh, side, motion);
}

export function bendElbow(pose: Pose, side: Side, flex: number): void {
  pose.rotate(sideBones(side).forearm, -flex, 0, 0);
}

export function bendWrist(pose: Pose, side: Side, flex: number): void {
  pose.rotate(sideBones(side).hand, -flex, 0, 0);
}

export function bendKnee(pose: Pose, side: Side, flex: number): void {
  pose.rotate(sideBones(side).shin, flex, 0, 0);
}

export function bendAnkle(pose: Pose, side: Side, toesUp: number): void {
  pose.rotate(sideBones(side).foot, -toesUp, 0, 0);
}

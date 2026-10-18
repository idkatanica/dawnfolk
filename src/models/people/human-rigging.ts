import { smoothstep } from "../../shared/math.ts";
import type { SurfacePoint, VertexStyle } from "../mesh/mesh-builder.ts";
import { type BoneBlend, chainBlend, chainStyle, createChain, type WeightChain } from "../rig/skin-weights.ts";
import { HumanBone, HumanJoint, onSide, type Side, sideBones } from "./human-skeleton.ts";

export const TORSO_CHAIN = createChain(
  [HumanBone.Pelvis, HumanBone.Spine, HumanBone.Chest, HumanBone.Neck, HumanBone.Head],
  [
    { axis: [0, 1, 0], blend: 0.05, position: HumanJoint.Spine },
    { axis: [0, 1, 0], blend: 0.07, position: HumanJoint.Chest },
    { axis: [0, 1, 0], blend: 0.035, position: HumanJoint.Neck },
    { axis: [0, 1, 0], blend: 0.025, position: HumanJoint.Head },
  ]
);

function armChain(side: Side): WeightChain {
  const bones = sideBones(side);

  return createChain(
    [HumanBone.Chest, bones.upperArm, bones.forearm, bones.hand],
    [
      { axis: [0.12 * side, -1, 0], blend: 0.045, position: onSide(HumanJoint.Shoulder, side) },
      { axis: [0.04 * side, -1, 0.06], blend: 0.04, position: onSide(HumanJoint.Elbow, side) },
      { axis: [0.02 * side, -1, 0.02], blend: 0.022, position: onSide(HumanJoint.Wrist, side) },
    ]
  );
}

function legChain(side: Side): WeightChain {
  const bones = sideBones(side);

  return createChain(
    [HumanBone.Pelvis, bones.thigh, bones.shin, bones.foot],
    [
      { axis: [0, -1, 0], blend: 0.06, position: onSide(HumanJoint.Hip, side) },
      { axis: [0, -1, 0.03], blend: 0.045, position: onSide(HumanJoint.Knee, side) },
      { axis: [0, -1, 0], blend: 0.03, position: onSide(HumanJoint.Ankle, side) },
    ]
  );
}

const ARM_CHAINS = { left: armChain(1), right: armChain(-1) };
const LEG_CHAINS = { left: legChain(1), right: legChain(-1) };

export function armStyle(side: Side): VertexStyle {
  return chainStyle(side === 1 ? ARM_CHAINS.left : ARM_CHAINS.right);
}

export function legStyle(side: Side): VertexStyle {
  return chainStyle(side === 1 ? LEG_CHAINS.left : LEG_CHAINS.right);
}

export const TORSO_STYLE: VertexStyle = chainStyle(TORSO_CHAIN);

function sideOf(point: SurfacePoint): Side {
  return point.position.x >= 0 ? 1 : -1;
}

interface TorsoInfluence {
  readonly bone: number;
  readonly weight: number;
}

function limbInfluence(point: SurfacePoint): TorsoInfluence {
  const { x, y } = point.position;
  const side = sideOf(point);

  const bones = sideBones(side);

  const shoulderWeight = 0.35 * smoothstep(0.13, 0.2, Math.abs(x)) * smoothstep(1.3, 1.41, y);
  const hipWeight = 0.3 * smoothstep(0.93, 0.85, y) * smoothstep(0.02, 0.08, Math.abs(x));

  if (shoulderWeight >= hipWeight) {
    return { bone: bones.upperArm, weight: shoulderWeight };
  }

  return { bone: bones.thigh, weight: hipWeight };
}

function torsoBlend(point: SurfacePoint): BoneBlend {
  const { x, y, z } = point.position;
  const influence = limbInfluence(point);

  const chain = chainBlend(TORSO_CHAIN, x, y, z);

  if (chain.weight > 0.02 || influence.weight < 0.02) {
    return chain;
  }

  return { boneA: chain.boneA, boneB: influence.bone, weight: influence.weight };
}

export const FLEXIBLE_TORSO_STYLE: VertexStyle = {
  boneA: (point) => torsoBlend(point).boneA,
  boneB: (point) => torsoBlend(point).boneB,
  boneWeight: (point) => torsoBlend(point).weight,
};

export function skirtStyle(followsLegs: number, hipLine = 0.92, hemLine = 0.55): VertexStyle {
  const weight = (point: SurfacePoint): number => followsLegs * smoothstep(hipLine, hemLine, point.position.y);

  return {
    boneA: HumanBone.Pelvis,
    boneB: (point) => sideBones(sideOf(point)).thigh,
    boneWeight: weight,
  };
}

export function headToChestStyle(top: number, bottom: number): VertexStyle {
  return {
    boneA: HumanBone.Head,
    boneB: HumanBone.Chest,
    boneWeight: (point) => smoothstep(top, bottom, point.position.y),
  };
}

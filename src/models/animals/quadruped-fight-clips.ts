import type { AnimalFightPose } from "../../world/agent-poses.ts";
import { SIDES } from "../mesh/transforms.ts";
import { degrees, type Keyframe, keyframes, wave } from "../rig/curves.ts";
import { once, type Pose, STRIDE_TIMING, seconds } from "../rig/pose.ts";
import type { AnimalClip, AnimalClipContext } from "./quadruped-clips.ts";
import {
  bendBone,
  GALLOP_PHASES,
  LYING_SPREAD,
  LYING_SWING,
  moveLeg,
  stepLegs,
  WALK_PHASES,
} from "./quadruped-motion.ts";
import { LEG_ENDS, QuadrupedBone, sideName } from "./quadruped-skeleton.ts";

export const QUADRUPED_FIGHT_CLIPS: Readonly<Record<AnimalFightPose, AnimalClip>> = {
  attack: { apply: attack, timing: seconds(0.9) },
  charge: { apply: charge, timing: STRIDE_TIMING },
  fall: { apply: fall, timing: once(1.3) },
  flinch: { apply: flinch, timing: once(0.5) },
};

const LUNGE: readonly Keyframe[] = [
  [0, 0],
  [0.3, -0.6],
  [0.48, 1],
  [0.62, 0.9],
  [0.86, 0],
];

const JOLT: readonly Keyframe[] = [
  [0, 0],
  [0.2, 1],
  [0.5, 0.6],
  [0.99, 0],
];

const COLLAPSE: readonly Keyframe[] = [
  [0, 0],
  [0.22, 0.15],
  [0.6, 0.92],
  [0.7, 1],
  [0.99, 1],
];

const BUCKLE: readonly Keyframe[] = [
  [0, 0],
  [0.25, 1],
  [0.55, 0.7],
  [0.72, 0],
  [0.99, 0],
];

function attack(pose: Pose, phase: number, context: AnimalClipContext): void {
  const lunge = keyframes(phase, LUNGE);
  const reach = Math.max(0, lunge);
  const gather = Math.max(0, -lunge);

  bendBone(pose, QuadrupedBone.Pelvis, degrees(8) * gather);
  bendBone(pose, QuadrupedBone.Spine, degrees(4) * reach);
  bendBone(pose, QuadrupedBone.Chest, degrees(8) * gather);
  bendBone(pose, QuadrupedBone.Neck, degrees(34) * reach - degrees(26) * gather + degrees(8));
  bendBone(pose, QuadrupedBone.Head, -degrees(4) * reach + degrees(18) * gather, 0, degrees(6) * wave(phase * 3));
  bendBone(pose, QuadrupedBone.Tail, -degrees(20), degrees(8) * wave(phase * 2));

  for (const side of SIDES) {
    moveLeg(pose, "front", side, degrees(30) * reach - degrees(10) * gather, context.gait.lowerFlex * 0.5 * gather);
    moveLeg(pose, "hind", side, -degrees(28) * reach + degrees(14) * gather, context.gait.lowerFlex * 0.4 * gather);
  }

  pose.height = 0.12 * reach * reach;
}

function charge(pose: Pose, phase: number, context: AnimalClipContext): void {
  const { gait } = context;

  const offsets = gait.runKind === "gallop" ? GALLOP_PHASES : WALK_PHASES;
  const fold = gait.lowerFlex * (gait.runKind === "gallop" ? 1.4 : 1.25);

  stepLegs(pose, phase, gait.runSwing, fold, offsets);
  bendBone(pose, QuadrupedBone.Pelvis, degrees(4) * wave(phase, 0.1));
  bendBone(pose, QuadrupedBone.Spine, -degrees(5) * wave(phase));
  bendBone(pose, QuadrupedBone.Neck, degrees(30) + degrees(5) * wave(phase, 0.3));
  bendBone(pose, QuadrupedBone.Head, degrees(14));
  bendBone(pose, QuadrupedBone.Tail, -degrees(34));
  pose.height = 0.1 * Math.max(0, wave(phase, -0.62));
}

function flinch(pose: Pose, phase: number, context: AnimalClipContext): void {
  const jolt = keyframes(Math.min(phase, 0.99), JOLT);

  bendBone(pose, QuadrupedBone.Pelvis, degrees(4) * jolt, degrees(6) * jolt);
  bendBone(pose, QuadrupedBone.Chest, -degrees(6) * jolt, -degrees(4) * jolt);
  bendBone(pose, QuadrupedBone.Neck, -degrees(22) * jolt, degrees(8) * jolt);
  bendBone(pose, QuadrupedBone.Head, -degrees(16) * jolt);
  bendBone(pose, QuadrupedBone.Tail, degrees(20) * jolt);

  for (const end of LEG_ENDS) {
    for (const side of SIDES) {
      moveLeg(
        pose,
        end,
        side,
        end === "front" ? degrees(8) * jolt : -degrees(6) * jolt,
        context.gait.lowerFlex * 0.4 * jolt
      );
    }
  }
}

function fall(pose: Pose, phase: number, context: AnimalClipContext): void {
  const progress = Math.min(phase, 0.99);
  const collapse = keyframes(progress, COLLAPSE);
  const buckle = keyframes(progress, BUCKLE);

  pose.grounding = "body";
  bendBone(pose, QuadrupedBone.Pelvis, degrees(6) * buckle, degrees(88) * collapse);
  bendBone(pose, QuadrupedBone.Neck, degrees(30) * collapse - degrees(16) * buckle, degrees(10) * collapse);
  bendBone(pose, QuadrupedBone.Head, degrees(15) * collapse, context.gait.deadHeadRoll * collapse);
  bendBone(pose, QuadrupedBone.Tail, -degrees(10) * buckle);

  for (const end of LEG_ENDS) {
    for (const side of SIDES) {
      moveLeg(
        pose,
        end,
        side,
        LYING_SWING[end] * collapse,
        degrees(12) * collapse + context.gait.lowerFlex * 0.9 * buckle,
        LYING_SPREAD[sideName(side)] * collapse
      );
    }
  }
}

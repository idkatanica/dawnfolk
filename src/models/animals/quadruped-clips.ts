import type { AnimalPose } from "../../world/agent-poses.ts";
import { cosineWave, degrees, keyframes, pulse, wave } from "../rig/curves.ts";
import type { Pose } from "../rig/pose.ts";
import { QUADRUPED_FIGHT_CLIPS } from "./quadruped-fight-clips.ts";
import { LEG_ENDS, LEG_SIDES, type LegEnd, type LegSide, legBones, QuadrupedBone } from "./quadruped-skeleton.ts";

type RunKind = "amble" | "gallop";

export interface GaitStyle {
  readonly deadHeadRoll: number;
  readonly grazeReach: number;
  readonly headBob: number;
  readonly lowerFlex: number;
  readonly runKind: RunKind;
  readonly runSwing: number;
  readonly tailSwish: number;
  readonly walkSwing: number;
}

export interface AnimalClipContext {
  readonly gait: GaitStyle;
  readonly variation: number;
}

type AnimalClipTiming =
  | { readonly cycleSeconds: number; readonly kind: "once" }
  | { readonly cycleSeconds: number; readonly kind: "seconds" }
  | { readonly kind: "stride" };

export type ExtraMotion = (pose: Pose, clip: AnimalPose, phase: number) => void;

export interface AnimalClip {
  readonly apply: (pose: Pose, phase: number, context: AnimalClipContext) => void;
  readonly timing: AnimalClipTiming;
}

const WALK_PHASES: Readonly<Record<LegEnd, Readonly<Record<"left" | "right", number>>>> = {
  front: { left: 0.25, right: 0.75 },
  hind: { left: 0, right: 0.5 },
};

const GALLOP_PHASES: Readonly<Record<LegEnd, Readonly<Record<"left" | "right", number>>>> = {
  front: { left: 0.42, right: 0.52 },
  hind: { left: 0, right: 0.09 },
};

const GRAZING_STANCE: Readonly<Record<LegEnd, number>> = { front: degrees(4), hind: -degrees(3) };

const LYING_SWING: Readonly<Record<LegEnd, number>> = { front: degrees(18), hind: -degrees(22) };

const LYING_SPREAD: Readonly<Record<"left" | "right", number>> = { left: degrees(4), right: -degrees(10) };

function sideName(side: LegSide): "left" | "right" {
  return side === 1 ? "left" : "right";
}

function bendTrunkBone(pose: Pose, bone: number, forward: number, toLeft = 0, turnLeft = 0): void {
  pose.rotate(bone, forward, -toLeft, turnLeft);
}

interface LegMotion {
  readonly fold: number;
  readonly outward?: number;
  readonly swing: number;
}

function moveLeg(pose: Pose, end: LegEnd, side: LegSide, motion: LegMotion): void {
  const { fold, outward = 0, swing } = motion;

  const bones = legBones(end, side);

  pose.rotate(bones.upper, -swing, side * outward, 0);

  if (end === "front") {
    pose.rotate(bones.lower, -fold * 0.45, 0, 0);
    pose.rotate(bones.hoof, fold * 1.2, 0, 0);

    return;
  }

  pose.rotate(bones.lower, -fold * 0.7, 0, 0);
  pose.rotate(bones.hoof, fold, 0, 0);
}

function stepLegs(pose: Pose, phase: number, swing: number, fold: number, offsets: typeof WALK_PHASES): void {
  for (const end of LEG_ENDS) {
    for (const side of LEG_SIDES) {
      const legPhase = phase + offsets[end][sideName(side)];

      moveLeg(pose, end, side, {
        fold: fold * pulse(legPhase, 0.78, 0.11),
        swing: swing * cosineWave(legPhase),
      });
    }
  }
}

function swishTail(pose: Pose, phase: number, amount: number): void {
  bendTrunkBone(pose, QuadrupedBone.Tail, degrees(10), amount * wave(phase * 2));
}

function walk(pose: Pose, phase: number, context: AnimalClipContext): void {
  const { gait } = context;

  stepLegs(pose, phase, gait.walkSwing, gait.lowerFlex, WALK_PHASES);
  bendTrunkBone(pose, QuadrupedBone.Pelvis, 0, degrees(1.5) * wave(phase), degrees(2) * wave(phase));
  bendTrunkBone(pose, QuadrupedBone.Neck, gait.headBob * cosineWave(phase * 2));
  bendTrunkBone(pose, QuadrupedBone.Head, -gait.headBob * 0.5 * cosineWave(phase * 2));
  swishTail(pose, phase, gait.tailSwish * 0.4);
}

function gallop(pose: Pose, phase: number, context: AnimalClipContext): void {
  const { gait } = context;

  stepLegs(pose, phase, gait.runSwing, gait.lowerFlex * 1.4, GALLOP_PHASES);
  bendTrunkBone(pose, QuadrupedBone.Pelvis, degrees(6) * wave(phase, 0.1));
  bendTrunkBone(pose, QuadrupedBone.Spine, -degrees(8) * wave(phase));
  bendTrunkBone(pose, QuadrupedBone.Chest, degrees(5) * wave(phase, 0.2));
  bendTrunkBone(pose, QuadrupedBone.Neck, degrees(10) + degrees(8) * wave(phase, 0.3));
  bendTrunkBone(pose, QuadrupedBone.Tail, -degrees(30));
  pose.height = 0.16 * Math.max(0, wave(phase, -0.62));
}

function amble(pose: Pose, phase: number, context: AnimalClipContext): void {
  const { gait } = context;

  stepLegs(pose, phase, gait.runSwing, gait.lowerFlex * 1.25, WALK_PHASES);
  bendTrunkBone(pose, QuadrupedBone.Pelvis, degrees(2), degrees(2.5) * wave(phase), degrees(3) * wave(phase));
  bendTrunkBone(pose, QuadrupedBone.Neck, degrees(4) + gait.headBob * 1.5 * cosineWave(phase * 2));
  swishTail(pose, phase, gait.tailSwish);
}

function run(pose: Pose, phase: number, context: AnimalClipContext): void {
  if (context.gait.runKind === "gallop") {
    gallop(pose, phase, context);

    return;
  }

  amble(pose, phase, context);
}

function graze(pose: Pose, phase: number, context: AnimalClipContext): void {
  const { gait, variation } = context;

  const alert = keyframes(phase + variation, [
    [0, 0],
    [0.55, 0],
    [0.62, 1],
    [0.78, 1],
    [0.85, 0],
  ]);

  const chew = wave(phase * 9) * (1 - alert);

  bendTrunkBone(pose, QuadrupedBone.Neck, gait.grazeReach * (1 - alert) - degrees(8) * alert, 0, degrees(18) * alert);
  bendTrunkBone(
    pose,
    QuadrupedBone.Head,
    degrees(20) * (1 - alert) + degrees(3) * chew,
    0,
    degrees(10) * alert * wave(phase * 3)
  );
  bendTrunkBone(pose, QuadrupedBone.Chest, degrees(4) * (1 - alert));

  for (const end of LEG_ENDS) {
    for (const side of LEG_SIDES) {
      moveLeg(pose, end, side, { fold: 0, outward: degrees(1.5), swing: GRAZING_STANCE[end] });
    }
  }

  swishTail(pose, phase * 2, gait.tailSwish);
}

function dead(pose: Pose, _phase: number, context: AnimalClipContext): void {
  pose.grounding = "body";
  bendTrunkBone(pose, QuadrupedBone.Pelvis, 0, degrees(88));
  bendTrunkBone(pose, QuadrupedBone.Neck, degrees(30), degrees(10));
  bendTrunkBone(pose, QuadrupedBone.Head, degrees(15), context.gait.deadHeadRoll);

  for (const end of LEG_ENDS) {
    for (const side of LEG_SIDES) {
      moveLeg(pose, end, side, { fold: degrees(12), outward: LYING_SPREAD[sideName(side)], swing: LYING_SWING[end] });
    }
  }
}

export const QUADRUPED_CLIPS: Readonly<Record<AnimalPose, AnimalClip>> = {
  dead: { apply: dead, timing: { cycleSeconds: 10, kind: "seconds" } },
  graze: { apply: graze, timing: { cycleSeconds: 9, kind: "seconds" } },
  run: { apply: run, timing: { kind: "stride" } },
  walk: { apply: walk, timing: { kind: "stride" } },
  ...QUADRUPED_FIGHT_CLIPS,
};

export function applyAnimalClip(
  pose: Pose,
  clip: AnimalPose,
  phase: number,
  context: AnimalClipContext,
  extra: ExtraMotion | null
): void {
  pose.reset();
  QUADRUPED_CLIPS[clip].apply(pose, phase, context);

  if (extra !== null) {
    extra(pose, clip, phase);
  }
}

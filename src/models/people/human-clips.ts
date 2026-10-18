import type { AgeGroup } from "../../content/life-stages.ts";
import type { CarriedItem, PersonPose } from "../../world/agent-poses.ts";
import { arc, cosineWave, degrees, type Keyframe, keyframes, pulse, wave } from "../rig/curves.ts";
import type { Pose } from "../rig/pose.ts";
import type { MotionStyle } from "./appearance.ts";
import { bendAnkle, bendElbow, bendKnee, bendTrunk, bendWrist, moveBody, swingArm, swingLeg } from "./human-joints.ts";
import { HumanBone, otherSide, SIDES, type Side } from "./human-skeleton.ts";

type HumanTool = "axe" | "basket" | "diggingStick" | "hammerStone" | "spear";

export interface HumanClipContext {
  readonly ageGroup: AgeGroup;
  readonly carried: CarriedItem;
  readonly motion: MotionStyle;
}

type ClipTiming = { readonly kind: "seconds"; readonly cycleSeconds: number } | { readonly kind: "stride" };

interface HumanClip {
  readonly apply: (pose: Pose, phase: number, context: HumanClipContext) => void;
  readonly timing: ClipTiming;
  readonly tool: HumanTool | null;
}

const STRIDE_TIMING: ClipTiming = { kind: "stride" };

function seconds(cycleSeconds: number): ClipTiming {
  return { cycleSeconds, kind: "seconds" };
}

function legPhase(phase: number, side: Side): number {
  return side === 1 ? phase : phase + 0.5;
}

function strideScale(context: HumanClipContext): number {
  if (context.ageGroup === "elder") {
    return context.motion.stride * 0.78;
  }

  return context.motion.stride;
}

function stoop(pose: Pose, context: HumanClipContext): void {
  const { posture } = context.motion;

  bendTrunk(pose, HumanBone.Spine, { forward: posture * 0.5 });
  bendTrunk(pose, HumanBone.Chest, { forward: posture * 0.35 });
  bendTrunk(pose, HumanBone.Neck, { forward: -posture * 0.45 });
}

function relaxedArms(pose: Pose, swing: number): void {
  for (const side of SIDES) {
    swingArm(pose, side, { forward: degrees(3), outward: degrees(7 + swing) });
    bendElbow(pose, side, degrees(12));
  }
}

function walkingLegs(pose: Pose, phase: number, stride: number): void {
  for (const side of SIDES) {
    const step = legPhase(phase, side);

    swingLeg(pose, side, { forward: degrees(5) + degrees(25) * stride * cosineWave(step), outward: degrees(2) });
    bendKnee(pose, side, degrees(5 + 15 * pulse(step, 0.1, 0.07) + 62 * stride * pulse(step, 0.7, 0.13)));
    bendAnkle(
      pose,
      side,
      degrees(8 * pulse(step, 0, 0.08) - 16 * pulse(step, 0.56, 0.07) + 10 * pulse(step, 0.76, 0.1))
    );
  }
}

function walkingTrunk(pose: Pose, phase: number): void {
  const swing = cosineWave(phase);

  moveBody(pose, { toLeft: degrees(2.5) * wave(phase), turnLeft: -degrees(4) * swing });
  bendTrunk(pose, HumanBone.Spine, { forward: degrees(3), turnLeft: degrees(4) * swing });
  bendTrunk(pose, HumanBone.Chest, { forward: degrees(2), turnLeft: degrees(4) * swing });
  bendTrunk(pose, HumanBone.Head, { forward: degrees(2) * cosineWave(phase * 2) });
}

function walkingArm(pose: Pose, phase: number, side: Side, amplitude: number): void {
  const swing = -side * cosineWave(phase) * amplitude;

  swingArm(pose, side, { forward: degrees(3) + degrees(20) * swing, outward: degrees(7) });
  bendElbow(pose, side, degrees(12) + degrees(16) * Math.max(0, swing));
}

function carryingArms(pose: Pose, phase: number, context: HumanClipContext): void {
  const swing = context.motion.armSwing * 0.6;

  switch (context.carried) {
    case "wood":
    case "meat": {
      const carryingSide: Side = context.carried === "wood" ? -1 : 1;

      swingArm(pose, carryingSide, { forward: degrees(25), outward: degrees(32) });
      bendElbow(pose, carryingSide, degrees(138));
      walkingArm(pose, phase, otherSide(carryingSide), swing);

      return;
    }

    case "stone":
    case "crops": {
      for (const side of SIDES) {
        swingArm(pose, side, { forward: degrees(38), outward: -degrees(4) });
        bendElbow(pose, side, degrees(82));
      }

      bendTrunk(pose, HumanBone.Spine, { forward: -degrees(5) });

      return;
    }

    case "berries": {
      swingArm(pose, 1, { forward: degrees(14), outward: degrees(14) });
      bendElbow(pose, 1, degrees(55));
      walkingArm(pose, phase, -1, swing);

      return;
    }

    default: {
      walkingArm(pose, phase, 1, swing);
      walkingArm(pose, phase, -1, swing);
    }
  }
}

function walk(pose: Pose, phase: number, context: HumanClipContext): void {
  walkingLegs(pose, phase, strideScale(context));
  walkingTrunk(pose, phase);
  walkingArm(pose, phase, 1, context.motion.armSwing);
  walkingArm(pose, phase, -1, context.motion.armSwing);
  stoop(pose, context);
}

function carry(pose: Pose, phase: number, context: HumanClipContext): void {
  walkingLegs(pose, phase, strideScale(context) * 0.9);
  walkingTrunk(pose, phase);
  carryingArms(pose, phase, context);
  stoop(pose, context);
}

function run(pose: Pose, phase: number, context: HumanClipContext): void {
  const stride = strideScale(context);

  for (const side of SIDES) {
    const step = legPhase(phase, side);
    const armSwing = -side * cosineWave(phase) * context.motion.armSwing;

    swingLeg(pose, side, { forward: degrees(14) + degrees(44) * stride * cosineWave(step), outward: degrees(2) });
    bendKnee(pose, side, degrees(18 + 22 * pulse(step, 0.1, 0.08) + 92 * stride * pulse(step, 0.66, 0.15)));
    bendAnkle(
      pose,
      side,
      degrees(10 * pulse(step, 0, 0.08) - 26 * pulse(step, 0.5, 0.08) + 14 * pulse(step, 0.76, 0.1))
    );
    swingArm(pose, side, { forward: degrees(8) + degrees(42) * armSwing, outward: degrees(10) });
    bendElbow(pose, side, degrees(88) + degrees(14) * armSwing);
  }

  moveBody(pose, { forward: degrees(7), turnLeft: -degrees(6) * cosineWave(phase) });
  bendTrunk(pose, HumanBone.Spine, { forward: degrees(5), turnLeft: degrees(6) * cosineWave(phase) });
  bendTrunk(pose, HumanBone.Chest, { forward: degrees(4), turnLeft: degrees(5) * cosineWave(phase) });
  bendTrunk(pose, HumanBone.Head, { forward: -degrees(6) });
  pose.height = 0.05 * Math.max(0, wave(phase * 2, -0.05));
}

function idle(pose: Pose, phase: number, context: HumanClipContext): void {
  const breath = wave(phase * 3);
  const sway = wave(phase);

  moveBody(pose, { toLeft: degrees(2) * sway });
  bendTrunk(pose, HumanBone.Chest, { forward: degrees(1.2) * breath, toLeft: -degrees(1.5) * sway });
  bendTrunk(pose, HumanBone.Head, {
    forward: degrees(4) * wave(phase * 2, 0.3),
    turnLeft: degrees(20) * wave(phase, 0.2),
  });

  for (const side of SIDES) {
    const isResting = side * sway > 0;

    swingLeg(pose, side, { forward: degrees(1), outward: degrees(4) - side * degrees(2) * sway });
    bendKnee(pose, side, degrees(isResting ? 9 : 3));
  }

  relaxedArms(pose, breath);
  stoop(pose, context);
}

function gather(pose: Pose, phase: number, context: HumanClipContext): void {
  const reach = wave(phase);

  moveBody(pose, { forward: degrees(22) });
  bendTrunk(pose, HumanBone.Spine, { forward: degrees(16) });
  bendTrunk(pose, HumanBone.Chest, { forward: degrees(10), turnLeft: degrees(6) * reach });
  bendTrunk(pose, HumanBone.Head, { forward: degrees(12) });

  for (const side of SIDES) {
    swingLeg(pose, side, { forward: degrees(44), outward: degrees(8) });
    bendKnee(pose, side, degrees(48));
    bendAnkle(pose, side, degrees(14));
  }

  swingArm(pose, -1, { forward: degrees(72) + degrees(18) * reach, outward: degrees(6) });
  bendElbow(pose, -1, degrees(26) - degrees(16) * reach);
  bendWrist(pose, -1, degrees(20) * reach);
  swingArm(pose, 1, { forward: degrees(34), outward: degrees(10) });
  bendElbow(pose, 1, degrees(70));
  stoop(pose, context);
}

const CHOP_SHOULDER: readonly Keyframe[] = [
  [0, 160],
  [0.34, 168],
  [0.5, 38],
  [0.62, 22],
  [0.8, 90],
];

const CHOP_ELBOW: readonly Keyframe[] = [
  [0, 52],
  [0.34, 58],
  [0.5, 12],
  [0.62, 16],
  [0.8, 40],
];

const CHOP_BEND: readonly Keyframe[] = [
  [0, -8],
  [0.34, -10],
  [0.5, 18],
  [0.62, 24],
  [0.8, 6],
];

function chop(pose: Pose, phase: number): void {
  const shoulder = degrees(keyframes(phase, CHOP_SHOULDER));
  const elbow = degrees(keyframes(phase, CHOP_ELBOW));
  const bend = degrees(keyframes(phase, CHOP_BEND));

  moveBody(pose, { forward: bend * 0.4, turnLeft: degrees(10) });
  bendTrunk(pose, HumanBone.Spine, { forward: bend * 0.4 });
  bendTrunk(pose, HumanBone.Chest, { forward: bend * 0.4, turnLeft: -degrees(14) + bend * 0.5 });
  bendTrunk(pose, HumanBone.Head, { forward: degrees(8) });

  swingArm(pose, -1, { forward: shoulder, outward: -degrees(4) });
  bendElbow(pose, -1, elbow);
  swingArm(pose, 1, { forward: shoulder * 0.94, outward: -degrees(16) });
  bendElbow(pose, 1, elbow + degrees(10));

  swingLeg(pose, 1, { forward: degrees(18) - bend * 0.4, outward: degrees(9) });
  bendKnee(pose, 1, degrees(16));
  swingLeg(pose, -1, { forward: -degrees(10) - bend * 0.4, outward: degrees(9) });
  bendKnee(pose, -1, degrees(10));
}

function dig(pose: Pose, phase: number): void {
  const thrust = keyframes(phase, [
    [0, 0],
    [0.4, 0.15],
    [0.55, 1],
    [0.7, 0.85],
  ]);

  moveBody(pose, { forward: degrees(18) });
  bendTrunk(pose, HumanBone.Spine, { forward: degrees(10) + degrees(8) * thrust });
  bendTrunk(pose, HumanBone.Chest, { forward: degrees(8) });
  bendTrunk(pose, HumanBone.Head, { forward: degrees(10) });

  for (const side of SIDES) {
    swingArm(pose, side, { forward: degrees(78) - degrees(42) * thrust, outward: -degrees(10) });
    bendElbow(pose, side, degrees(52) - degrees(24) * thrust);
  }

  swingLeg(pose, 1, { forward: degrees(34), outward: degrees(7) });
  bendKnee(pose, 1, degrees(34));
  swingLeg(pose, -1, { forward: degrees(8), outward: degrees(7) });
  bendKnee(pose, -1, degrees(26));
}

function fish(pose: Pose, phase: number): void {
  const strike = keyframes(phase, [
    [0, 0],
    [0.6, 0.05],
    [0.72, 1],
    [0.82, 0.9],
  ]);

  moveBody(pose, { forward: degrees(10) });
  bendTrunk(pose, HumanBone.Spine, { forward: degrees(6) + degrees(10) * strike });
  bendTrunk(pose, HumanBone.Head, { forward: degrees(22) });
  swingArm(pose, -1, { forward: degrees(150) - degrees(62) * strike, outward: degrees(12) });
  bendElbow(pose, -1, degrees(84) - degrees(70) * strike);
  swingArm(pose, 1, { forward: degrees(46), outward: degrees(16) });
  bendElbow(pose, 1, degrees(30));

  for (const side of SIDES) {
    swingLeg(pose, side, { forward: degrees(22), outward: degrees(11) });
    bendKnee(pose, side, degrees(24));
  }
}

function build(pose: Pose, phase: number): void {
  const hammer = keyframes(phase, [
    [0, 0.1],
    [0.5, 1],
    [0.64, 0],
  ]);

  moveBody(pose, { forward: degrees(16) });
  bendTrunk(pose, HumanBone.Spine, { forward: degrees(14) });
  bendTrunk(pose, HumanBone.Chest, { forward: degrees(8) });
  bendTrunk(pose, HumanBone.Head, { forward: degrees(16) });

  for (const side of SIDES) {
    swingLeg(pose, side, { forward: degrees(80), outward: degrees(14) });
    bendKnee(pose, side, degrees(112));
    bendAnkle(pose, side, degrees(24));
  }

  swingArm(pose, -1, { forward: degrees(48) + degrees(52) * hammer, outward: degrees(4) });
  bendElbow(pose, -1, degrees(30) + degrees(58) * hammer);
  swingArm(pose, 1, { forward: degrees(52), outward: -degrees(8) });
  bendElbow(pose, 1, degrees(58));
}

function throwSpear(pose: Pose, phase: number): void {
  const windUp = keyframes(phase, [
    [0, 0.2],
    [0.38, 1],
    [0.52, -0.6],
    [0.7, -0.8],
  ]);

  moveBody(pose, { forward: -degrees(6) * windUp, turnLeft: degrees(28) * windUp });
  bendTrunk(pose, HumanBone.Chest, { forward: -degrees(8) * windUp, turnLeft: degrees(18) * windUp });
  bendTrunk(pose, HumanBone.Head, { turnLeft: -degrees(40) * windUp });
  swingArm(pose, -1, { forward: degrees(118) + degrees(36) * windUp, outward: degrees(34), twist: degrees(20) });
  bendElbow(pose, -1, degrees(70) + degrees(25) * windUp);
  swingArm(pose, 1, { forward: degrees(80), outward: degrees(14) });
  bendElbow(pose, 1, degrees(18));
  swingLeg(pose, 1, { forward: degrees(26), outward: degrees(6) });
  bendKnee(pose, 1, degrees(14));
  swingLeg(pose, -1, { forward: -degrees(16), outward: degrees(6) });
  bendKnee(pose, -1, degrees(22));
}

function sitting(pose: Pose): void {
  pose.grounding = "body";
  moveBody(pose, { forward: -degrees(18) });
  bendTrunk(pose, HumanBone.Spine, { forward: degrees(8) });
  bendTrunk(pose, HumanBone.Chest, { forward: degrees(12) });

  for (const side of SIDES) {
    swingLeg(pose, side, { forward: degrees(120), outward: degrees(18) });
    bendKnee(pose, side, degrees(112));
    bendAnkle(pose, side, degrees(20));
  }
}

function sit(pose: Pose, phase: number): void {
  sitting(pose);
  bendTrunk(pose, HumanBone.Head, { forward: degrees(4) * wave(phase * 2), turnLeft: degrees(24) * wave(phase, 0.1) });
  bendTrunk(pose, HumanBone.Chest, { forward: degrees(1.2) * wave(phase * 4) });

  for (const side of SIDES) {
    swingArm(pose, side, { forward: degrees(44), outward: degrees(6) });
    bendElbow(pose, side, degrees(34));
  }
}

function eat(pose: Pose, phase: number): void {
  const bite = keyframes(phase, [
    [0, 0],
    [0.3, 0],
    [0.45, 1],
    [0.62, 1],
    [0.78, 0],
  ]);

  sitting(pose);
  bendTrunk(pose, HumanBone.Head, { forward: degrees(10) - degrees(8) * bite });
  swingArm(pose, -1, { forward: degrees(40) + degrees(22) * bite, outward: degrees(4) });
  bendElbow(pose, -1, degrees(50) + degrees(84) * bite);
  swingArm(pose, 1, { forward: degrees(42), outward: degrees(6) });
  bendElbow(pose, 1, degrees(48));
}

function sleep(pose: Pose, phase: number): void {
  pose.grounding = "body";
  moveBody(pose, { forward: degrees(8), toLeft: degrees(90) });
  bendTrunk(pose, HumanBone.Chest, { forward: degrees(1) * wave(phase * 2) });
  bendTrunk(pose, HumanBone.Head, { forward: degrees(18) });

  for (const side of SIDES) {
    swingLeg(pose, side, { forward: degrees(58) + side * degrees(6), outward: degrees(2) });
    bendKnee(pose, side, degrees(78));
    swingArm(pose, side, { forward: degrees(76), outward: -degrees(4) });
    bendElbow(pose, side, degrees(108));
  }
}

function pray(pose: Pose, phase: number): void {
  const bow = keyframes(phase, [
    [0, 0],
    [0.35, 1],
    [0.6, 1],
    [0.85, 0],
  ]);

  pose.grounding = "body";
  bendTrunk(pose, HumanBone.Spine, { forward: degrees(6) + degrees(22) * bow });
  bendTrunk(pose, HumanBone.Chest, { forward: degrees(6) + degrees(12) * bow });
  bendTrunk(pose, HumanBone.Head, { forward: -degrees(14) + degrees(26) * bow });

  for (const side of SIDES) {
    swingLeg(pose, side, { forward: degrees(4), outward: degrees(5) });
    bendKnee(pose, side, degrees(96));
    bendAnkle(pose, side, -degrees(38));
    swingArm(pose, side, { forward: degrees(146) - degrees(50) * bow, outward: degrees(18) });
    bendElbow(pose, side, degrees(14));
  }
}

function play(pose: Pose, phase: number): void {
  const crouch = keyframes(phase, [
    [0, 1],
    [0.22, 0.9],
    [0.32, 0],
    [0.62, 0],
    [0.76, 0.8],
  ]);

  pose.height = 0.24 * arc(phase, 0.3, 0.36);
  moveBody(pose, { forward: degrees(18) * crouch });

  for (const side of SIDES) {
    swingLeg(pose, side, { forward: degrees(46) * crouch, outward: degrees(6) });
    bendKnee(pose, side, degrees(8) + degrees(64) * crouch);
    bendAnkle(pose, side, degrees(20) * crouch - degrees(22) * (1 - crouch));
    swingArm(pose, side, { forward: -degrees(30) * crouch + degrees(150) * (1 - crouch), outward: degrees(14) });
    bendElbow(pose, side, degrees(30));
  }

  bendTrunk(pose, HumanBone.Head, { forward: -degrees(10) * (1 - crouch) });
}

function dead(pose: Pose): void {
  pose.grounding = "body";
  moveBody(pose, { forward: -degrees(90) });
  bendTrunk(pose, HumanBone.Head, { turnLeft: degrees(28) });

  for (const side of SIDES) {
    swingArm(pose, side, { forward: degrees(10), outward: degrees(52) });
    bendElbow(pose, side, degrees(22));
    swingLeg(pose, side, { outward: degrees(11) });
    bendKnee(pose, side, degrees(10));
    bendAnkle(pose, side, -degrees(30));
  }
}

export const HUMAN_CLIPS: Readonly<Record<PersonPose, HumanClip>> = {
  build: { apply: build, timing: seconds(0.9), tool: "hammerStone" },
  carry: { apply: carry, timing: STRIDE_TIMING, tool: null },
  chop: { apply: chop, timing: seconds(1.45), tool: "axe" },
  dead: { apply: dead, timing: seconds(10), tool: null },
  dig: { apply: dig, timing: seconds(1.6), tool: "diggingStick" },
  eat: { apply: eat, timing: seconds(2.6), tool: null },
  fish: { apply: fish, timing: seconds(3.4), tool: "spear" },
  gather: { apply: gather, timing: seconds(2.2), tool: "basket" },
  idle: { apply: idle, timing: seconds(5.5), tool: null },
  play: { apply: play, timing: seconds(0.95), tool: null },
  pray: { apply: pray, timing: seconds(4.8), tool: null },
  run: { apply: run, timing: STRIDE_TIMING, tool: null },
  sit: { apply: sit, timing: seconds(7), tool: null },
  sleep: { apply: sleep, timing: seconds(6), tool: null },
  throw: { apply: throwSpear, timing: seconds(1.7), tool: "spear" },
  walk: { apply: walk, timing: STRIDE_TIMING, tool: null },
};

export function applyHumanClip(pose: Pose, clipPose: PersonPose, phase: number, context: HumanClipContext): void {
  pose.reset();
  HUMAN_CLIPS[clipPose].apply(pose, phase, context);
}

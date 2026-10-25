import { cosineWave, degrees, pulse } from "../rig/curves.ts";
import type { Pose } from "../rig/pose.ts";
import { LEG_ENDS, LEG_SIDES, type LegEnd, type LegSide, legBones } from "./quadruped-skeleton.ts";

type SideName = "left" | "right";

export type LegPhases = Readonly<Record<LegEnd, Readonly<Record<SideName, number>>>>;

export const WALK_PHASES: LegPhases = {
  front: { left: 0.25, right: 0.75 },
  hind: { left: 0, right: 0.5 },
};

export const GALLOP_PHASES: LegPhases = {
  front: { left: 0.42, right: 0.52 },
  hind: { left: 0, right: 0.09 },
};

export const LYING_SWING: Readonly<Record<LegEnd, number>> = { front: degrees(18), hind: -degrees(22) };

export const LYING_SPREAD: Readonly<Record<SideName, number>> = { left: degrees(4), right: -degrees(10) };

export function sideName(side: LegSide): SideName {
  return side === 1 ? "left" : "right";
}

export function bendBone(pose: Pose, bone: number, forward: number, toLeft = 0, turnLeft = 0): void {
  pose.rotate(bone, forward, -toLeft, turnLeft);
}

export function moveLeg(pose: Pose, end: LegEnd, side: LegSide, swing: number, fold: number, outward = 0): void {
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

export function stepLegs(pose: Pose, phase: number, swing: number, fold: number, offsets: LegPhases): void {
  for (const end of LEG_ENDS) {
    for (const side of LEG_SIDES) {
      const legPhase = phase + offsets[end][sideName(side)];

      moveLeg(pose, end, side, swing * cosineWave(legPhase), fold * pulse(legPhase, 0.78, 0.11));
    }
  }
}

import { degrees } from "../rig/curves.ts";
import type { Pose } from "../rig/pose.ts";
import type { LegEnd, LegSide } from "./quadruped-skeleton.ts";

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

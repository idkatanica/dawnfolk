import { cosineWave, degrees, pulse } from "../rig/curves.ts";
import type { Pose } from "../rig/pose.ts";
import { bendAnkle, bendKnee, swingLeg } from "./human-joints.ts";
import { SIDES } from "./human-skeleton.ts";

interface LegCycle {
  readonly knee: number;
  readonly lean: number;
  readonly lift: number;
  readonly outward: number;
  readonly reach: number;
  readonly swing: number;
}

export const WALKING: LegCycle = { knee: 5, lean: 5, lift: 15, outward: 2, reach: 62, swing: 25 };
export const MARCHING: LegCycle = { knee: 8, lean: 6, lift: 18, outward: 3, reach: 66, swing: 27 };
export const RUNNING: LegCycle = { knee: 18, lean: 14, lift: 22, outward: 2, reach: 92, swing: 44 };
export const CHARGING: LegCycle = { knee: 20, lean: 16, lift: 22, outward: 3, reach: 92, swing: 44 };

export function walkingLegs(pose: Pose, phase: number, stride: number, cycle: LegCycle): void {
  const { knee, lean, lift, outward, reach, swing } = cycle;

  for (const side of SIDES) {
    const step = side === 1 ? phase : phase + 0.5;
    const forward = degrees(lean) + degrees(swing) * stride * cosineWave(step);
    const toesUp = degrees(8 * pulse(step, 0, 0.08) - 16 * pulse(step, 0.56, 0.07) + 10 * pulse(step, 0.76, 0.1));

    swingLeg(pose, side, { forward, outward: degrees(outward) });
    bendKnee(pose, side, degrees(knee + lift * pulse(step, 0.1, 0.07) + reach * stride * pulse(step, 0.7, 0.13)));
    bendAnkle(pose, side, toesUp);
  }
}

export function runningLegs(pose: Pose, phase: number, stride: number, cycle: LegCycle): void {
  const { knee, lean, lift, outward, reach, swing } = cycle;

  for (const side of SIDES) {
    const step = side === 1 ? phase : phase + 0.5;
    const forward = degrees(lean) + degrees(swing) * stride * cosineWave(step);
    const toesUp = degrees(10 * pulse(step, 0, 0.08) - 26 * pulse(step, 0.5, 0.08) + 14 * pulse(step, 0.76, 0.1));

    swingLeg(pose, side, { forward, outward: degrees(outward) });
    bendKnee(pose, side, degrees(knee + lift * pulse(step, 0.1, 0.08) + reach * stride * pulse(step, 0.66, 0.15)));
    bendAnkle(pose, side, toesUp);
  }
}

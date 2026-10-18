import type { Grounding } from "./skeleton.ts";

export const ANGLES_PER_BONE = 3;

export const RotationAxis = {
  Pitch: 0,
  Roll: 1,
  Yaw: 2,
} as const;

export class Pose {
  readonly angles: Float32Array;
  grounding: Grounding = "feet";
  height = 0;

  constructor(boneCount: number) {
    this.angles = new Float32Array(boneCount * ANGLES_PER_BONE);
  }

  reset(): void {
    this.angles.fill(0);
    this.grounding = "feet";
    this.height = 0;
  }

  rotate(bone: number, pitch: number, roll: number, yaw: number): void {
    const offset = bone * ANGLES_PER_BONE;

    this.angles[offset + RotationAxis.Pitch] += pitch;
    this.angles[offset + RotationAxis.Roll] += roll;
    this.angles[offset + RotationAxis.Yaw] += yaw;
  }

  blendBetween(from: Pose, to: Pose, amount: number): void {
    for (let index = 0; index < this.angles.length; index += 1) {
      this.angles[index] = from.angles[index] + (to.angles[index] - from.angles[index]) * amount;
    }

    this.height = from.height + (to.height - from.height) * amount;
    this.grounding = blendedGrounding(from.grounding, to.grounding);
  }
}

function blendedGrounding(from: Grounding, to: Grounding): Grounding {
  if (from === "body" || to === "body") {
    return "body";
  }

  return "feet";
}

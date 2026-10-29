import type { PersonAppearance } from "../../models/people/appearance.ts";
import { applyHumanClip, HUMAN_CLIPS } from "../../models/people/human-clips.ts";
import { humanBoneScales } from "../../models/people/human-proportions.ts";
import { HUMAN_SKELETON } from "../../models/people/human-skeleton.ts";
import { Pose } from "../../models/rig/pose.ts";
import { SkeletonPoser } from "../../models/rig/skeleton-poser.ts";
import { measureStride } from "../../models/rig/stride.ts";
import { PERSON_POSES, type PersonPose } from "../../world/agent-poses.ts";

const REFERENCE_BODY = { build: 1, headSize: 1, height: 1, hipWidth: 1, legLength: 1, shoulderWidth: 1 } as const;
const REFERENCE_MOTION = { armSwing: 1, posture: 0, stride: 1 } as const;
const ELDER_STRIDE = 0.78;
const SHORTEST_STRIDE = 0.3;

function measureReferenceStride(clip: PersonPose): number {
  const pose = new Pose(HUMAN_SKELETON.bones.length);

  return measureStride({
    pose,
    poser: new SkeletonPoser(HUMAN_SKELETON),
    sample: (target, phase) => {
      applyHumanClip(target, clip, phase, { ageGroup: "adult", carried: "nothing", motion: REFERENCE_MOTION });
    },
    scales: humanBoneScales(REFERENCE_BODY),
    skeleton: HUMAN_SKELETON,
  });
}

function strideScale(appearance: PersonAppearance): number {
  const { body, motion } = appearance;

  const ageFactor = appearance.ageGroup === "elder" ? ELDER_STRIDE : 1;

  return body.height * body.legLength * motion.stride * ageFactor;
}

export class HumanStrides {
  readonly #reference = new Map<PersonPose, number>();

  constructor() {
    for (const clip of PERSON_POSES) {
      if (HUMAN_CLIPS[clip].timing.kind === "stride") {
        this.#reference.set(clip, Math.max(SHORTEST_STRIDE, measureReferenceStride(clip)));
      }
    }
  }

  cyclesPerSecond(clip: PersonPose, speed: number, appearance: PersonAppearance): number {
    const { timing } = HUMAN_CLIPS[clip];

    if (timing.kind !== "stride") {
      return 1 / timing.cycleSeconds;
    }

    const reference = this.#reference.get(clip);

    if (reference === undefined) {
      return 0;
    }

    return speed / (reference * strideScale(appearance));
  }
}

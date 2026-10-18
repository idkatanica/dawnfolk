import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { CARRIED_ITEMS, PERSON_POSES, type PersonPose } from "../../world/agent-poses.ts";
import { Pose } from "../rig/pose.ts";
import { uniformScales } from "../rig/skeleton.ts";
import { SkeletonPoser } from "../rig/skeleton-poser.ts";
import { measureStride } from "../rig/stride.ts";
import type { MotionStyle } from "./appearance.ts";
import { applyHumanClip, type HumanClipContext } from "./human-clips.ts";
import { HUMAN_SKELETON, HumanBone } from "./human-skeleton.ts";

const MOTION: MotionStyle = { armSwing: 1, posture: 0, stride: 1 };

const ADULT: HumanClipContext = { ageGroup: "adult", carried: "nothing", motion: MOTION };

function posed(clip: PersonPose, phase: number, context: HumanClipContext = ADULT): SkeletonPoser {
  const poser = new SkeletonPoser(HUMAN_SKELETON);
  const pose = new Pose(HUMAN_SKELETON.bones.length);

  applyHumanClip(pose, clip, phase, context);
  poser.pose(pose, uniformScales(HUMAN_SKELETON));

  return poser;
}

function jointOf(poser: SkeletonPoser, bone: number): Vector3 {
  return poser.jointPosition(bone, new Vector3());
}

function strideOf(clip: PersonPose, context: HumanClipContext): number {
  return measureStride({
    pose: new Pose(HUMAN_SKELETON.bones.length),
    poser: new SkeletonPoser(HUMAN_SKELETON),
    sample: (pose, phase) => applyHumanClip(pose, clip, phase, context),
    scales: uniformScales(HUMAN_SKELETON),
    skeleton: HUMAN_SKELETON,
  });
}

describe("human clips", () => {
  it("produces a finite pose for every activity, item and moment", () => {
    const pose = new Pose(HUMAN_SKELETON.bones.length);

    for (const clip of PERSON_POSES) {
      for (const carried of CARRIED_ITEMS) {
        for (const phase of [0, 0.13, 0.5, 0.77, 3.2]) {
          applyHumanClip(pose, clip, phase, { ...ADULT, carried });

          expect([...pose.angles].every((angle) => Number.isFinite(angle))).toBe(true);
          expect(Number.isFinite(pose.height)).toBe(true);
        }
      }
    }
  });

  it("alternates the leading foot while walking", () => {
    const start = posed("walk", 0);
    const half = posed("walk", 0.5);

    expect(jointOf(start, HumanBone.FootLeft).z).toBeGreaterThan(jointOf(start, HumanBone.FootRight).z);
    expect(jointOf(half, HumanBone.FootRight).z).toBeGreaterThan(jointOf(half, HumanBone.FootLeft).z);
  });

  it("covers more ground per stride when running", () => {
    const walking = strideOf("walk", ADULT);
    const running = strideOf("run", ADULT);
    const elderly = strideOf("walk", { ...ADULT, ageGroup: "elder" });

    expect(walking).toBeGreaterThan(1.2);
    expect(walking).toBeLessThan(2);
    expect(running).toBeGreaterThan(walking * 1.3);
    expect(elderly).toBeLessThan(walking);
  });

  it("swings the axe from above the head down to the waist", () => {
    const windUp = posed("chop", 0.2);
    const strike = posed("chop", 0.55);

    expect(jointOf(windUp, HumanBone.HandRight).y).toBeGreaterThan(jointOf(windUp, HumanBone.Head).y);
    expect(jointOf(strike, HumanBone.HandRight).y).toBeLessThan(jointOf(strike, HumanBone.Chest).y);
  });

  it("brings the body down to the ground when resting", () => {
    for (const clip of ["sleep", "dead", "sit", "pray"] as const) {
      expect(jointOf(posed(clip, 0.3), HumanBone.Pelvis).y).toBeLessThan(0.6);
    }

    expect(jointOf(posed("idle", 0.3), HumanBone.Pelvis).y).toBeGreaterThan(0.85);
  });

  it("leaves the ground in the middle of a jump", () => {
    const poser = posed("play", 0.48);
    const point = new Vector3();

    const lowest = Math.min(
      ...HUMAN_SKELETON.footContacts.map(
        (contact) => poser.skinPoint(contact.bone, point.set(...contact.position), point).y
      )
    );

    expect(lowest).toBeGreaterThan(0.15);
  });
});

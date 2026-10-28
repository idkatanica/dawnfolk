import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { HUMAN_SKELETON, HumanBone } from "../people/human-skeleton.ts";
import { uniformScales } from "../testing/uniform-scales.ts";
import { degrees } from "./curves.ts";
import { Pose } from "./pose.ts";
import { NO_PARENT } from "./skeleton.ts";
import { PALETTE_FLOATS_PER_BONE, SkeletonPoser } from "./skeleton-poser.ts";

const IDENTITY_ROWS = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

function lowestFoot(poser: SkeletonPoser): number {
  const point = new Vector3();

  return Math.min(
    ...HUMAN_SKELETON.footContacts.map(
      (contact) => poser.skinPoint(contact.bone, point.set(...contact.position), point).y
    )
  );
}

function scaledTo(factor: number): Float32Array {
  return uniformScales(HUMAN_SKELETON).map((scale) => scale * factor);
}

describe("skeleton poser", () => {
  it("leaves the rest pose untouched", () => {
    const poser = new SkeletonPoser(HUMAN_SKELETON);
    const palette = new Float32Array(HUMAN_SKELETON.bones.length * PALETTE_FLOATS_PER_BONE);

    poser.pose(new Pose(HUMAN_SKELETON.bones.length), uniformScales(HUMAN_SKELETON));
    poser.writePalette(palette, 0);

    for (let bone = 0; bone < HUMAN_SKELETON.bones.length; bone += 1) {
      const rows = palette.subarray(bone * PALETTE_FLOATS_PER_BONE, (bone + 1) * PALETTE_FLOATS_PER_BONE);

      expect([...rows].map((value) => Math.round(value * 1e5) / 1e5 + 0)).toEqual(IDENTITY_ROWS);
    }
  });

  it("keeps every child joint attached to its parent", () => {
    const poser = new SkeletonPoser(HUMAN_SKELETON);
    const pose = new Pose(HUMAN_SKELETON.bones.length);
    const scales = scaledTo(1.2);

    for (let bone = 0; bone < HUMAN_SKELETON.bones.length; bone += 1) {
      pose.rotate(bone, degrees(13 * ((bone % 3) - 1)), degrees(7 * ((bone % 4) - 1.5)), degrees(5 * (bone % 2)));
    }

    poser.pose(pose, scales);

    for (const [bone, definition] of HUMAN_SKELETON.bones.entries()) {
      if (definition.parent === NO_PARENT) {
        continue;
      }

      const joint = poser.jointPosition(bone, new Vector3());
      const attached = poser.skinPoint(definition.parent, new Vector3(...definition.joint), new Vector3());

      expect(joint.distanceTo(attached)).toBeLessThan(1e-5);
    }
  });

  it("stands on the ground whatever the size of the body", () => {
    const poser = new SkeletonPoser(HUMAN_SKELETON);
    const pose = new Pose(HUMAN_SKELETON.bones.length);
    const top = new Vector3();

    for (const factor of [0.5, 1, 1.3]) {
      poser.pose(pose, scaledTo(factor));
      poser.skinPoint(HumanBone.Head, new Vector3(0, 1.75, 0), top);

      expect(lowestFoot(poser)).toBeCloseTo(0, 5);
      expect(top.y).toBeCloseTo(1.75 * factor, 2);
    }
  });

  it("lifts the body above the ground by the pose height", () => {
    const poser = new SkeletonPoser(HUMAN_SKELETON);
    const pose = new Pose(HUMAN_SKELETON.bones.length);

    pose.height = 0.3;
    poser.pose(pose, uniformScales(HUMAN_SKELETON));

    expect(lowestFoot(poser)).toBeCloseTo(0.3, 5);
  });

  it("bends limbs away from the midline whatever their swing", () => {
    const poser = new SkeletonPoser(HUMAN_SKELETON);
    const pose = new Pose(HUMAN_SKELETON.bones.length);
    const hand = new Vector3();

    pose.rotate(HumanBone.UpperArmLeft, -degrees(170), -degrees(20), 0);
    poser.pose(pose, uniformScales(HUMAN_SKELETON));
    poser.jointPosition(HumanBone.HandLeft, hand);

    expect(hand.y).toBeGreaterThan(1.9);
    expect(hand.x).toBeLessThan(0.19);
  });
});

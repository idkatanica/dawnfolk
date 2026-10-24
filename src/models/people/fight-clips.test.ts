import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import type { FightPose } from "../../world/agent-poses.ts";
import { mergeMeshes } from "../mesh/mesh-data.ts";
import { Pose } from "../rig/pose.ts";
import { SkeletonPoser } from "../rig/skeleton-poser.ts";
import { loosePieces, type MeshPiece, TOUCHING } from "../testing/mesh-connectivity.ts";
import { posedMesh } from "../testing/moved-mesh.ts";
import { uniformScales } from "../testing/uniform-scales.ts";
import { personAppearance } from "./appearance.ts";
import { applyHumanClip, HUMAN_CLIPS, type HumanClipContext } from "./human-clips.ts";
import { HUMAN_DETAILS } from "./human-detail.ts";
import { buildHumanParts, type HumanPart, humanPartIndex } from "./human-model.ts";
import { humanBoneScales } from "./human-proportions.ts";
import { HUMAN_SKELETON, HumanBone } from "./human-skeleton.ts";

const ADULT: HumanClipContext = {
  ageGroup: "adult",
  carried: "nothing",
  motion: { armSwing: 1, posture: 0, stride: 1 },
};
const RIGHT_FIST = new Vector3(-0.217, 0.832, 0.018);
const LEFT_FIST = new Vector3(0.217, 0.832, 0.018);
const SPEAR_TIP = new Vector3(-0.217, 0.832, 1.13);
const TRIBE = { accent: 0x33_66_99, fur: 0x55_44_33, id: 2 };
const parts = buildHumanParts(HUMAN_DETAILS.high);

function posed(clip: FightPose, phase: number): SkeletonPoser {
  const poser = new SkeletonPoser(HUMAN_SKELETON);
  const pose = new Pose(HUMAN_SKELETON.bones.length);

  applyHumanClip(pose, clip, phase, ADULT);
  poser.pose(pose, uniformScales(HUMAN_SKELETON));

  return poser;
}

function isTorso(piece: MeshPiece): boolean {
  return piece.vertices.includes(0);
}

function pointOf(poser: SkeletonPoser, bone: number, rest: Vector3): Vector3 {
  return poser.skinPoint(bone, rest, new Vector3());
}

function jointOf(poser: SkeletonPoser, bone: number): Vector3 {
  return poser.jointPosition(bone, new Vector3());
}

describe("fight clips", () => {
  it("raise the spear above the head on the march", () => {
    const marching = posed("march", 0.3);

    expect(pointOf(marching, HumanBone.HandRight, SPEAR_TIP).y).toBeGreaterThan(jointOf(marching, HumanBone.Head).y);
  });

  it("drive the spear point forward and level in a thrust", () => {
    const guard = posed("thrust", 0.1);
    const lunge = posed("thrust", 0.6);

    const guardTip = pointOf(guard, HumanBone.HandRight, SPEAR_TIP);
    const lungeTip = pointOf(lunge, HumanBone.HandRight, SPEAR_TIP);
    const lungeFist = pointOf(lunge, HumanBone.HandRight, RIGHT_FIST);

    expect(lungeTip.z).toBeGreaterThan(guardTip.z + 0.25);
    expect(lungeTip.z).toBeGreaterThan(1.2);
    expect(Math.abs(lungeTip.y - lungeFist.y)).toBeLessThan(0.35);
  });

  it("raise the guard to parry a blow", () => {
    const parry = posed("block", 0.2);

    expect(pointOf(parry, HumanBone.HandLeft, LEFT_FIST).y).toBeGreaterThan(1.3);
    expect(pointOf(parry, HumanBone.HandRight, RIGHT_FIST).y).toBeGreaterThan(1.3);
  });

  it("jerk the head back when struck and settle again", () => {
    const struck = posed("flinch", 0.2);
    const settled = posed("flinch", 0.99);

    expect(jointOf(struck, HumanBone.Head).z).toBeLessThan(jointOf(settled, HumanBone.Head).z - 0.05);
  });

  it("fall to the ground and end lying like the dead", () => {
    const toppling = posed("fall", 0.3);
    const fallen = posed("fall", 0.95);
    const dead = new SkeletonPoser(HUMAN_SKELETON);
    const pose = new Pose(HUMAN_SKELETON.bones.length);

    applyHumanClip(pose, "dead", 0, ADULT);
    dead.pose(pose, uniformScales(HUMAN_SKELETON));

    expect(jointOf(toppling, HumanBone.Pelvis).y).toBeGreaterThan(0.4);
    expect(jointOf(fallen, HumanBone.Pelvis).y).toBeLessThan(0.3);
    expect(jointOf(fallen, HumanBone.Head).distanceTo(jointOf(dead, HumanBone.Head))).toBeLessThan(0.15);
  });

  it("play the fall and the flinch once instead of looping", () => {
    expect(HUMAN_CLIPS.fall.timing.kind).toBe("once");
    expect(HUMAN_CLIPS.flinch.timing.kind).toBe("once");
    expect(HUMAN_CLIPS.thrust.timing.kind).toBe("seconds");
  });

  it("keep the weapons in the hands through every fight", () => {
    const appearance = personAppearance({ age: 30, isFemale: false, seed: 0.37, tribe: TRIBE });
    const weapons: readonly HumanPart[] = ["spear", "bow", "quiver", "warPaint"];
    const poser = new SkeletonPoser(HUMAN_SKELETON);
    const pose = new Pose(HUMAN_SKELETON.bones.length);

    for (const clip of ["march", "charge", "thrust", "block", "flinch"] as const) {
      for (const phase of [0.1, 0.45, 0.8]) {
        applyHumanClip(pose, clip, phase, ADULT);
        poser.pose(pose, humanBoneScales(appearance.body));

        const names: HumanPart[] = ["bodyMale", ...weapons];
        const mesh = posedMesh(mergeMeshes(names.map((name) => parts[humanPartIndex(name)])), poser);

        expect(loosePieces(mesh, TOUCHING, isTorso), `${clip} ${phase}`).toEqual([]);
      }
    }
  });
});

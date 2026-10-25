import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { CARRIED_ITEMS, PERSON_POSES, type PersonPose } from "../../world/agent-poses.ts";
import { mergeMeshes } from "../mesh/mesh-data.ts";
import { Pose } from "../rig/pose.ts";
import type { ContactPoint } from "../rig/skeleton.ts";
import { SkeletonPoser } from "../rig/skeleton-poser.ts";
import { measureStride } from "../rig/stride.ts";
import { loosePieces, type MeshPiece, TOUCHING } from "../testing/mesh-connectivity.ts";
import { posedMesh } from "../testing/moved-mesh.ts";
import { uniformScales } from "../testing/uniform-scales.ts";
import { type MotionStyle, personAppearance } from "./appearance.ts";
import { applyHumanClip, HUMAN_CLIPS, type HumanClipContext } from "./human-clips.ts";
import { HUMAN_DETAILS } from "./human-detail.ts";
import { buildHumanParts, type HumanPart, humanPartIndex } from "./human-model.ts";
import { humanBoneScales } from "./human-proportions.ts";
import { HUMAN_SKELETON, HumanBone } from "./human-skeleton.ts";

const MOTION: MotionStyle = { armSwing: 1, posture: 0, stride: 1 };

const ADULT: HumanClipContext = { ageGroup: "adult", carried: "nothing", motion: MOTION };
const RIGHT_FIST = new Vector3(-0.217, 0.832, 0.018);
const LEFT_FIST = new Vector3(0.217, 0.832, 0.018);
const SPEAR_TIP = new Vector3(-0.217, 0.832, 1.13);
const STICK_TIP = new Vector3(-0.217, 0.122, 0.038);
const PLANTED = 0.02;
const STANDING_WORK: readonly PersonPose[] = [
  "gather",
  "chop",
  "dig",
  "fish",
  "throw",
  "mine",
  "shoot",
  "thrust",
  "brawl",
  "block",
  "flinch",
];
const KNEE_CONTACT = HUMAN_SKELETON.allContacts.find(
  (contact) => contact.bone === HumanBone.ShinRight && contact.position[1] > 0.4
);
const TRIBE = { accent: 0x33_66_99, fur: 0x55_44_33, id: 2 };
const parts = buildHumanParts(HUMAN_DETAILS.high);

function posed(clip: PersonPose, phase: number): SkeletonPoser {
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

function footHeights(poser: SkeletonPoser): number[] {
  const point = new Vector3();

  return HUMAN_SKELETON.footContacts.map(
    (contact) => poser.skinPoint(contact.bone, point.set(...contact.position), point).y
  );
}

function lowestFoot(poser: SkeletonPoser): number {
  return Math.min(...footHeights(poser));
}

function contactHeight(poser: SkeletonPoser, contact: ContactPoint): number {
  return poser.skinPoint(contact.bone, new Vector3(...contact.position), new Vector3()).y;
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

  it("draws the bow string back to the face while holding the bow out towards the target", () => {
    const anchored = posed("shoot", 0.5);

    const head = jointOf(anchored, HumanBone.Head);
    const drawHand = jointOf(anchored, HumanBone.HandRight);
    const bowHand = jointOf(anchored, HumanBone.HandLeft);

    expect(drawHand.distanceTo(head)).toBeLessThan(0.2);
    expect(bowHand.z - drawHand.z).toBeGreaterThan(0.5);
    expect(Math.abs(bowHand.y - drawHand.y)).toBeLessThan(0.12);
  });

  it("swings the pickaxe from over the head down to the ground", () => {
    const windUp = posed("mine", 0.2);
    const strike = posed("mine", 0.62);

    expect(jointOf(windUp, HumanBone.HandRight).y).toBeGreaterThan(jointOf(windUp, HumanBone.Head).y);
    expect(jointOf(strike, HumanBone.HandRight).y).toBeLessThan(1);
  });

  it("keeps both feet on the ground through standing work and fights", () => {
    for (const clip of STANDING_WORK) {
      for (let phase = 0; phase < 1; phase += 0.05) {
        const [leftHeel, leftToe, rightHeel, rightToe] = footHeights(posed(clip, phase));

        expect(Math.min(leftHeel, leftToe), `${clip} ${phase} left`).toBeLessThan(PLANTED);
        expect(Math.min(rightHeel, rightToe), `${clip} ${phase} right`).toBeLessThan(PLANTED);
        expect(Math.abs(leftHeel - leftToe), `${clip} ${phase} leading foot flat`).toBeLessThan(PLANTED);
      }
    }
  });

  it("kneels on one knee to build, with the hammer stone coming down to the ground", () => {
    if (KNEE_CONTACT === undefined) {
      throw new Error("The skeleton needs a knee contact");
    }

    for (let phase = 0; phase < 1; phase += 0.05) {
      const poser = posed("build", phase);
      const [leftHeel, leftToe] = footHeights(poser);

      expect(contactHeight(poser, KNEE_CONTACT), `${phase} knee`).toBeLessThan(PLANTED);
      expect(Math.max(leftHeel, leftToe), `${phase} standing foot`).toBeLessThan(PLANTED);
    }

    expect(jointOf(posed("build", 0.5), HumanBone.HandRight).y).toBeGreaterThan(1);
    expect(pointOf(posed("build", 0.64), HumanBone.HandRight, RIGHT_FIST).y).toBeLessThan(0.35);
  });

  it("drives the digging stick down into the ground", () => {
    const raised = posed("dig", 0.2);
    const thrust = posed("dig", 0.55);

    expect(pointOf(raised, HumanBone.HandRight, STICK_TIP).y).toBeGreaterThan(0.25);
    expect(pointOf(thrust, HumanBone.HandRight, STICK_TIP).y).toBeLessThan(0.05);
    expect(pointOf(raised, HumanBone.HandRight, STICK_TIP).y).toBeLessThan(
      pointOf(raised, HumanBone.HandRight, RIGHT_FIST).y - 0.5
    );
  });

  it("is in the air at the widest stride of a leap and lands as the legs pass", () => {
    expect(lowestFoot(posed("leap", 0))).toBeGreaterThan(0.15);
    expect(lowestFoot(posed("leap", 0.5))).toBeGreaterThan(0.15);
    expect(lowestFoot(posed("leap", 0.25))).toBeLessThan(PLANTED);
    expect(lowestFoot(posed("leap", 0.75))).toBeLessThan(PLANTED);
  });

  it("leaves the ground in the middle of a jump", () => {
    expect(lowestFoot(posed("play", 0.48))).toBeGreaterThan(0.15);
  });
});

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
    const dead = posed("dead", 0);

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

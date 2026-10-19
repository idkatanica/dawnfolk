import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { ANIMAL_KINDS, type AnimalKind } from "../../content/animals.ts";
import type { AnimalPose } from "../../world/agent-poses.ts";
import { Pose } from "../rig/pose.ts";
import { SkeletonPoser } from "../rig/skeleton-poser.ts";
import { animalAppearance } from "./animal-appearance.ts";
import { ANIMAL_SPECIES, poseAnimal } from "./animal-models.ts";
import { QUADRUPED_CLIPS } from "./quadruped-clips.ts";
import { QuadrupedBone } from "./quadruped-skeleton.ts";

const MUZZLE_REACH = 0.3;

function posed(kind: AnimalKind, clip: AnimalPose, phase: number): SkeletonPoser {
  const species = ANIMAL_SPECIES[kind];

  const poser = new SkeletonPoser(species.skeleton);
  const pose = new Pose(species.skeleton.bones.length);

  poseAnimal(kind, pose, clip, phase, { variation: 0.3 });
  poser.pose(pose, species.boneScales(animalAppearance({ kind, seed: 0.31, youth: 0 })));

  return poser;
}

function head(poser: SkeletonPoser): Vector3 {
  return poser.jointPosition(QuadrupedBone.Head, new Vector3());
}

function muzzle(kind: AnimalKind, poser: SkeletonPoser): Vector3 {
  const [x, y, z] = ANIMAL_SPECIES[kind].skeleton.bones[QuadrupedBone.Head].joint;

  return poser.skinPoint(QuadrupedBone.Head, new Vector3(x, y, z + MUZZLE_REACH), new Vector3());
}

describe.each(ANIMAL_KINDS)("%s fight clips", (kind) => {
  it("throws the head into the strike", () => {
    const gathering = posed(kind, "attack", 0.3);
    const striking = posed(kind, "attack", 0.5);

    expect(muzzle(kind, striking).distanceTo(muzzle(kind, gathering))).toBeGreaterThan(0.08);
  });

  it("lowers the head to charge", () => {
    const running = posed(kind, "run", 0.3);
    const charging = posed(kind, "charge", 0.3);

    expect(head(charging).y).toBeLessThan(head(running).y);
  });

  it("collapses into the pose of the dead", () => {
    const fallen = posed(kind, "fall", 0.95);
    const dead = posed(kind, "dead", 0);

    expect(head(fallen).distanceTo(head(dead))).toBeLessThan(0.15 * (kind === "mammoth" ? 3 : 1));
  });
});

describe("a wolf's attack", () => {
  it("lunges the head forward at its prey", () => {
    expect(head(posed("wolf", "attack", 0.5)).z).toBeGreaterThan(head(posed("wolf", "attack", 0.3)).z);
  });
});

describe("quadruped fight clip timing", () => {
  it("plays the fall and the flinch once", () => {
    expect(QUADRUPED_CLIPS.fall.timing.kind).toBe("once");
    expect(QUADRUPED_CLIPS.flinch.timing.kind).toBe("once");
    expect(QUADRUPED_CLIPS.charge.timing.kind).toBe("stride");
  });
});

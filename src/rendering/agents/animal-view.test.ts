import { describe, expect, it } from "vitest";
import { ANIMAL_KINDS, type AnimalKind } from "../../content/animals.ts";
import { type AnimalAppearance, animalAppearance } from "../../models/animals/animal-appearance.ts";
import { ANIMAL_SPECIES, animalBoneScales, buildAnimalParts, poseAnimal } from "../../models/animals/animal-models.ts";
import { mergeMeshes, vertexCount } from "../../models/mesh/mesh-data.ts";
import { Pose } from "../../models/rig/pose.ts";
import { SkeletonPoser } from "../../models/rig/skeleton-poser.ts";
import { posedMesh } from "../../models/testing/moved-mesh.ts";
import { ANIMAL_POSES } from "../../world/agent-poses.ts";
import { ANIMAL_BOUNDING_LIFT, ANIMAL_BOUNDING_RADIUS } from "./animal-view.ts";

const SAMPLED_SEEDS = 200;
const PHASES = Array.from({ length: 20 }, (_, index) => index / 20);
const VARIATIONS = [0, 0.5, 1];

function largestAdult(kind: AnimalKind): AnimalAppearance {
  let largest = animalAppearance({ kind, seed: 0, youth: 0 });

  for (let index = 1; index < SAMPLED_SEEDS; index += 1) {
    const appearance = animalAppearance({ kind, seed: index / SAMPLED_SEEDS, youth: 0 });

    if (appearance.size > largest.size) {
      largest = appearance;
    }
  }

  return largest;
}

function farthestReach(kind: AnimalKind): number {
  const species = ANIMAL_SPECIES[kind];
  const poser = new SkeletonPoser(species.skeleton);
  const pose = new Pose(species.skeleton.bones.length);
  const scales = animalBoneScales(kind, largestAdult(kind));
  const mesh = mergeMeshes(buildAnimalParts(kind, "high"));

  let farthest = 0;

  for (const clip of ANIMAL_POSES) {
    for (const phase of PHASES) {
      for (const variation of VARIATIONS) {
        poseAnimal(kind, pose, clip, phase, { variation });
        poser.pose(pose, scales);

        const { positions } = posedMesh(mesh, poser);

        for (let vertex = 0; vertex < vertexCount(mesh); vertex += 1) {
          const reach = Math.hypot(
            positions[vertex * 3],
            positions[vertex * 3 + 1] - ANIMAL_BOUNDING_LIFT,
            positions[vertex * 3 + 2]
          );

          farthest = Math.max(farthest, reach);
        }
      }
    }
  }

  return farthest;
}

describe("AnimalView culling", () => {
  it.each(ANIMAL_KINDS)("keeps the largest %s inside its cull sphere through every clip", (kind) => {
    expect(farthestReach(kind)).toBeLessThanOrEqual(ANIMAL_BOUNDING_RADIUS);
  });
});

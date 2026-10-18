import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { ANIMAL_KINDS } from "../../content/animals.ts";
import { ANIMAL_POSES } from "../../world/agent-poses.ts";
import { mergeMeshes } from "../mesh/mesh-data.ts";
import { hasPart } from "../part-mask.ts";
import { Pose } from "../rig/pose.ts";
import { SkeletonPoser } from "../rig/skeleton-poser.ts";
import { measureStride } from "../rig/stride.ts";
import { meshProblems, openEdgeCount, thinnestPiece } from "../testing/mesh-checks.ts";
import { describePiece, detachedPieces, type MeshPiece, meshPieces } from "../testing/mesh-connectivity.ts";
import { posedMesh } from "../testing/moved-mesh.ts";
import { animalAppearance } from "./animal-appearance.ts";
import { ANIMAL_SPECIES, animalPartMask, buildAnimalParts, poseAnimal } from "./animal-models.ts";
import { QuadrupedBone } from "./quadruped-skeleton.ts";

const ADULT = { seed: 0.31, youth: 0 };

const TOUCHING = 0.01;
const THINNEST = 0.001;
const PHASES = [0, 0.25, 0.5, 0.75];

function isTorso(piece: MeshPiece): boolean {
  return piece.vertices.includes(0);
}

function posedAnimal(kind: (typeof ANIMAL_KINDS)[number], clip: (typeof ANIMAL_POSES)[number], phase: number) {
  const species = ANIMAL_SPECIES[kind];

  const poser = new SkeletonPoser(species.skeleton);
  const pose = new Pose(species.skeleton.bones.length);

  poseAnimal(kind, pose, clip, phase, { variation: 0 });
  poser.pose(pose, species.boneScales(animalAppearance({ kind, ...ADULT })));

  return poser;
}

function joint(poser: SkeletonPoser, bone: number): Vector3 {
  return poser.jointPosition(bone, new Vector3());
}

describe.each(ANIMAL_KINDS)("%s model", (kind) => {
  const species = ANIMAL_SPECIES[kind];

  it("builds clean geometry bound to real bones", () => {
    for (const [index, mesh] of buildAnimalParts(kind, "high").entries()) {
      expect(meshProblems(mesh)).toEqual([]);
      expect(new Set(mesh.channels.part)).toEqual(new Set([index]));
      expect(mesh.channels.boneA.every((bone) => bone < species.skeleton.bones.length)).toBe(true);
      expect(mesh.channels.boneB.every((bone) => bone < species.skeleton.bones.length)).toBe(true);
    }
  });

  it("stands every part on the body and the body on the ground", () => {
    for (const level of ["high", "low"] as const) {
      const [body, ...extras] = buildAnimalParts(kind, level);

      for (const [index, extra] of extras.entries()) {
        const mesh = mergeMeshes([body, extra]);

        const detached = detachedPieces(mesh, 0.01).map((piece) => describePiece(mesh, piece));

        expect(detached, `${level} ${species.parts[index + 1].name}`).toEqual([]);
      }
    }
  });

  it("leaves no holes in any part at either level of detail", () => {
    for (const level of ["high", "low"] as const) {
      for (const [index, mesh] of buildAnimalParts(kind, level).entries()) {
        expect(openEdgeCount(mesh), `${level} ${species.parts[index].name}`).toBe(0);
      }
    }
  });

  it("keeps every part on the body through every clip at both levels of detail", () => {
    const scales = species.boneScales(animalAppearance({ kind, ...ADULT }));
    const poser = new SkeletonPoser(species.skeleton);
    const pose = new Pose(species.skeleton.bones.length);

    for (const level of ["high", "low"] as const) {
      const mesh = mergeMeshes(buildAnimalParts(kind, level));

      for (const clip of ANIMAL_POSES) {
        for (const phase of PHASES) {
          poseAnimal(kind, pose, clip, phase, { variation: 0.3 });
          poser.pose(pose, scales);

          const posed = posedMesh(mesh, poser);

          const loose = detachedPieces(posed, TOUCHING, isTorso).map((piece) => describePiece(posed, piece));

          expect(loose, `${level} ${clip} ${phase}`).toEqual([]);
        }
      }
    }
  });

  it("builds every part from solid shapes, never paper-thin cards", () => {
    for (const level of ["high", "low"] as const) {
      for (const [index, mesh] of buildAnimalParts(kind, level).entries()) {
        expect(thinnestPiece(mesh, meshPieces(mesh)), `${level} ${species.parts[index].name}`).toBeGreaterThan(
          THINNEST
        );
      }
    }
  });

  it("uses fewer triangles at the low level of detail", () => {
    function count(level: "high" | "low"): number {
      return buildAnimalParts(kind, level).reduce((sum, mesh) => sum + mesh.indices.length, 0);
    }

    expect(count("low")).toBeLessThan(count("high"));
  });

  it("keeps every pose finite", () => {
    const pose = new Pose(species.skeleton.bones.length);

    for (const clip of ANIMAL_POSES) {
      for (const phase of [0, 0.3, 0.71]) {
        poseAnimal(kind, pose, clip, phase, { variation: 0.4 });

        expect([...pose.angles].every((angle) => Number.isFinite(angle))).toBe(true);
      }
    }
  });

  it("swaps the leading front hoof every half stride", () => {
    const start = posedAnimal(kind, "walk", 0.25);
    const later = posedAnimal(kind, "walk", 0.75);

    function leftLeads(poser: SkeletonPoser): boolean {
      return joint(poser, QuadrupedBone.HoofFrontLeft).z > joint(poser, QuadrupedBone.HoofFrontRight).z;
    }

    expect(leftLeads(start)).not.toBe(leftLeads(later));
  });

  it("lowers the head to graze and the body when dead", () => {
    const standing = posedAnimal(kind, "walk", 0);
    const grazing = posedAnimal(kind, "graze", 0.1);
    const dead = posedAnimal(kind, "dead", 0);

    expect(joint(grazing, QuadrupedBone.Head).y).toBeLessThan(joint(standing, QuadrupedBone.Head).y);
    expect(joint(dead, QuadrupedBone.Chest).y).toBeLessThan(joint(standing, QuadrupedBone.Chest).y * 0.6);
  });

  it("keeps antlers, tusks and horns out of the ground when lying dead", () => {
    const parts = buildAnimalParts(kind, "high");

    const lying = posedMesh(mergeMeshes(parts), posedAnimal(kind, "dead", 0));

    expect(lying.bounds.minimum[1]).toBeGreaterThan(-0.1);
  });

  it("covers ground with every stride", () => {
    const appearance = animalAppearance({ kind, ...ADULT });

    const stride = measureStride({
      pose: new Pose(species.skeleton.bones.length),
      poser: new SkeletonPoser(species.skeleton),
      sample: (pose, phase) => poseAnimal(kind, pose, "walk", phase, { variation: 0 }),
      scales: species.boneScales(appearance),
      skeleton: species.skeleton,
    });

    expect(stride).toBeGreaterThan(0.5);
  });
});

describe("animal appearance", () => {
  it.each(ANIMAL_KINDS)("is the same for the same %s", (kind) => {
    expect(animalAppearance({ kind, seed: 0.5, youth: 0.2 })).toEqual(
      animalAppearance({ kind, seed: 0.5, youth: 0.2 })
    );
  });

  it.each(ANIMAL_KINDS)("varies the coat and size of every %s", (kind) => {
    const herd = Array.from({ length: 12 }, (_, index) => animalAppearance({ kind, seed: index / 12, youth: 0 }));

    expect(new Set(herd.map((animal) => animal.coat)).size).toBeGreaterThan(6);
    expect(Math.max(...herd.map((animal) => animal.size))).toBeGreaterThan(
      Math.min(...herd.map((animal) => animal.size))
    );
  });

  it("gives ibex bucks long curved horns, does short ones and kids none", () => {
    const adults = Array.from({ length: 40 }, (_, index) =>
      animalAppearance({ kind: "ibex", seed: index / 40, youth: 0 })
    );
    const kid = animalAppearance({ kind: "ibex", seed: 0.3, youth: 1 });

    const masks = adults.map((ibex) => animalPartMask("ibex", ibex));

    expect(masks.filter((mask) => hasPart(mask, 2)).length).toBeGreaterThan(5);
    expect(masks.filter((mask) => hasPart(mask, 1)).length).toBeGreaterThan(5);
    expect(hasPart(animalPartMask("ibex", kid), 1)).toBe(false);
  });

  it("gives grown wolves a thick ruff now and then but never a pup", () => {
    const adults = Array.from({ length: 40 }, (_, index) =>
      animalAppearance({ kind: "wolf", seed: index / 40, youth: 0 })
    );
    const pups = Array.from({ length: 10 }, (_, index) =>
      animalAppearance({ kind: "wolf", seed: index / 10, youth: 0.8 })
    );

    expect(adults.filter((wolf) => wolf.hasRuff).length).toBeGreaterThan(10);
    expect(pups.some((wolf) => wolf.hasRuff)).toBe(false);
  });

  it("gives fawns spots and no antlers", () => {
    for (let index = 0; index < 20; index += 1) {
      const fawn = animalAppearance({ kind: "deer", seed: index / 20, youth: 0.9 });

      const mask = animalPartMask("deer", fawn);

      expect(fawn.hasAntlers).toBe(false);
      expect(hasPart(mask, 3)).toBe(true);
      expect(fawn.size).toBeLessThan(0.6);
    }
  });

  it("grows antlers on some adult deer only", () => {
    const adults = Array.from({ length: 40 }, (_, index) =>
      animalAppearance({ kind: "deer", seed: index / 40, youth: 0 })
    );

    const stags = adults.filter((deer) => deer.hasAntlers).length;

    expect(stags).toBeGreaterThan(5);
    expect(stags).toBeLessThan(35);
  });

  it("gives mammoth calves short tusks or none", () => {
    const calf = animalAppearance({ kind: "mammoth", seed: 0.4, youth: 1 });

    expect(calf.tuskLength).toBeLessThan(0.3);
    expect(hasPart(animalPartMask("mammoth", calf), 2)).toBe(false);
  });
});

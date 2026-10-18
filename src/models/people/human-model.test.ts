import { describe, expect, it } from "vitest";
import { CARRIED_ITEMS } from "../../world/agent-poses.ts";
import { type MeshData, mergeMeshes, triangleCount, VERTEX_CHANNELS } from "../mesh/mesh-data.ts";
import { MAXIMUM_PARTS } from "../part-mask.ts";
import { Pose } from "../rig/pose.ts";
import { SkeletonPoser } from "../rig/skeleton-poser.ts";
import { meshProblems } from "../testing/mesh-checks.ts";
import {
  describePiece,
  detachedPieces,
  holdsPart,
  type MeshPiece,
  meshPieces,
  piecesTouch,
} from "../testing/mesh-connectivity.ts";
import { posedMesh } from "../testing/moved-mesh.ts";
import { personAppearance } from "./appearance.ts";
import { applyHumanClip } from "./human-clips.ts";
import { HUMAN_DETAILS } from "./human-detail.ts";
import {
  activityParts,
  appearanceParts,
  buildHumanAtlas,
  buildHumanParts,
  HUMAN_PARTS,
  type HumanPart,
  humanPartIndex,
  humanPartMask,
} from "./human-model.ts";
import { humanBoneScales } from "./human-proportions.ts";
import { HUMAN_BONE_COUNT, HUMAN_SKELETON, HumanBone } from "./human-skeleton.ts";

const highParts = buildHumanParts(HUMAN_DETAILS.high);
const lowParts = buildHumanParts(HUMAN_DETAILS.low);

const TOUCHING = 0.01;
const TORSOS = ["torsoChild", "torsoFemale", "torsoMale"] as const satisfies readonly HumanPart[];

function isWorn(part: HumanPart): boolean {
  return part !== "body" && !part.startsWith("torso") && !part.startsWith("carried");
}

function wornWith(part: HumanPart): HumanPart[] {
  return part === "feather" ? ["headband", part] : [part];
}

const ARM_BONES: ReadonlySet<number> = new Set([
  HumanBone.ForearmLeft,
  HumanBone.ForearmRight,
  HumanBone.HandLeft,
  HumanBone.HandRight,
]);

function isArm(mesh: MeshData, piece: MeshPiece): boolean {
  const bound = piece.vertices.filter(
    (vertex) => ARM_BONES.has(mesh.channels.boneA[vertex]) || ARM_BONES.has(mesh.channels.boneB[vertex])
  );

  return bound.length * 2 > piece.vertices.length;
}

function looseParts(parts: readonly MeshData[], names: readonly HumanPart[]): string[] {
  const mesh = mergeMeshes(names.map((name) => parts[humanPartIndex(name)]));

  return detachedPieces(mesh, TOUCHING).map((piece) => describePiece(mesh, piece));
}

function torsoIn(parts: readonly HumanPart[]): number {
  const torso = parts.find((part) => part.startsWith("torso"));

  if (torso === undefined) {
    throw new Error("Every person wears a torso");
  }

  return humanPartIndex(torso);
}

describe("human model", () => {
  it("fits every part into a part mask", () => {
    expect(HUMAN_PARTS.length).toBeLessThanOrEqual(MAXIMUM_PARTS);
  });

  it("builds clean geometry for every part", () => {
    for (const [index, mesh] of highParts.entries()) {
      expect(meshProblems(mesh), HUMAN_PARTS[index]).toEqual([]);
      expect(triangleCount(mesh), HUMAN_PARTS[index]).toBeGreaterThan(0);
      expect(new Set(mesh.channels.part)).toEqual(new Set([index]));
    }
  });

  it("binds every vertex to real bones with a valid weight", () => {
    const atlas = buildHumanAtlas(HUMAN_DETAILS.high);

    for (const channel of ["boneA", "boneB"] as const) {
      expect(
        atlas.channels[channel].every((bone) => Number.isInteger(bone) && bone >= 0 && bone < HUMAN_BONE_COUNT)
      ).toBe(true);
    }

    expect(atlas.channels.boneWeight.every((weight) => weight >= 0 && weight <= 1)).toBe(true);
    expect(VERTEX_CHANNELS.every((channel) => atlas.channels[channel].length === atlas.positions.length / 3)).toBe(
      true
    );
  });

  it("stands a body about as tall as a person", () => {
    const [body] = highParts;

    expect(body.bounds.minimum[1]).toBeCloseTo(0, 1);
    expect(body.bounds.maximum[1]).toBeGreaterThan(1.7);
    expect(body.bounds.maximum[1]).toBeLessThan(1.8);
  });

  it("saves triangles at the low level of detail", () => {
    const highTriangles = highParts.reduce((sum, mesh) => sum + triangleCount(mesh), 0);
    const lowTriangles = lowParts.reduce((sum, mesh) => sum + triangleCount(mesh), 0);

    expect(lowTriangles).toBeLessThan(highTriangles * 0.75);
  });
});

describe("attached parts", () => {
  it.each([
    ["high", highParts],
    ["low", lowParts],
  ] as const)("keeps every worn part and tool on the %s body standing on the ground", (_level, parts) => {
    for (const torso of TORSOS) {
      for (const part of HUMAN_PARTS.filter(isWorn)) {
        expect(looseParts(parts, ["body", torso, ...wornWith(part)]), `${torso} ${part}`).toEqual([]);
      }
    }
  });

  it("holds every carried load in the arms that carry it", () => {
    const tribe = { accent: 0x33_66_99, fur: 0x55_44_33, id: 2 };
    const poser = new SkeletonPoser(HUMAN_SKELETON);
    const pose = new Pose(HUMAN_SKELETON.bones.length);

    const people = [
      personAppearance({ age: 30, isFemale: false, seed: 0.37, tribe }),
      personAppearance({ age: 34, isFemale: true, seed: 0.6, tribe }),
      personAppearance({ age: 11, isFemale: false, seed: 0.4, tribe }),
    ];

    for (const appearance of people) {
      const body = appearanceParts(appearance).filter((part) => part === "body" || part.startsWith("torso"));

      for (const carried of CARRIED_ITEMS.filter((item) => item !== "nothing")) {
        applyHumanClip(pose, "carry", 0.3, { ageGroup: appearance.ageGroup, carried, motion: appearance.motion });
        poser.pose(pose, humanBoneScales(appearance.body));

        const load = activityParts("carry", carried);

        const mesh = posedMesh(mergeMeshes([...body, ...load].map((name) => highParts[humanPartIndex(name)])), poser);
        const loadParts = new Set(load.map((name) => humanPartIndex(name)));

        const pieces = meshPieces(mesh);
        const loose = detachedPieces(mesh, TOUCHING, holdsPart(mesh, torsoIn(body))).map((piece) =>
          describePiece(mesh, piece)
        );

        const arms = pieces.filter((piece) => isArm(mesh, piece));
        const loads = pieces.filter((piece) => loadParts.has(mesh.channels.part[piece.vertices[0]]));

        const isHeld = loads.some((piece) => arms.some((arm) => piecesTouch(mesh, piece, arm, TOUCHING)));

        expect(loose, `${appearance.ageGroup} carrying ${carried}`).toEqual([]);
        expect(isHeld, `${appearance.ageGroup} carrying ${carried}`).toBe(true);
      }
    }
  });
});

describe("visible parts", () => {
  const tribe = { accent: 0x33_66_99, fur: 0x55_44_33, id: 2 };

  it("dresses everyone with a body, a torso and an outfit", () => {
    for (let index = 0; index < 40; index += 1) {
      const appearance = personAppearance({ age: 8 + index, isFemale: index % 2 === 0, seed: index / 40, tribe });

      const parts = appearanceParts(appearance);

      expect(parts).toContain("body");
      expect(parts.filter((part) => part.startsWith("torso"))).toHaveLength(1);
      expect(parts.some((part) => ["dress", "loincloth", "tunic", "wrap"].includes(part))).toBe(true);
    }
  });

  it("shows the tool of the task and the load only while carrying", () => {
    expect(activityParts("chop", "nothing")).toEqual(["axe"]);
    expect(activityParts("carry", "wood")).toEqual(["carriedWood"]);
    expect(activityParts("walk", "wood")).toEqual([]);
    expect(activityParts("fish", "fish")).toEqual(["spear"]);
  });

  it("packs visible parts into the instance mask", () => {
    expect(humanPartMask(["body"])).toEqual([1, 0]);
    expect(humanPartMask(["body", "carriedCrops"])).toEqual([1, 2 ** (HUMAN_PARTS.indexOf("carriedCrops") - 24)]);
  });
});

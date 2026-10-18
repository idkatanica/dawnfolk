import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { WEAPON_KINDS } from "../../content/weapons.ts";
import { CARRIED_ITEMS, PERSON_POSES } from "../../world/agent-poses.ts";
import { MaterialSlot } from "../materials.ts";
import { type MeshData, mergeMeshes, triangleCount, VERTEX_CHANNELS } from "../mesh/mesh-data.ts";
import { MAXIMUM_PARTS } from "../part-mask.ts";
import { Pose } from "../rig/pose.ts";
import { SkeletonPoser } from "../rig/skeleton-poser.ts";
import { meshProblems, openEdgeCount, thinnestPiece } from "../testing/mesh-checks.ts";
import {
  describePiece,
  detachedPieces,
  holdsPart,
  type MeshPiece,
  meshPieces,
  piecesTouch,
} from "../testing/mesh-connectivity.ts";
import { posedMesh } from "../testing/moved-mesh.ts";
import { type PersonAppearance, personAppearance } from "./appearance.ts";
import { applyHumanClip } from "./human-clips.ts";
import { HUMAN_DETAILS } from "./human-detail.ts";
import {
  activityParts,
  appearanceParts,
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
const farParts = buildHumanParts(HUMAN_DETAILS.far);

const TOUCHING = 0.01;
const TRIBE = { accent: 0x33_66_99, fur: 0x55_44_33, id: 2 };
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

function bodyPartsOf(appearance: PersonAppearance): HumanPart[] {
  return appearanceParts(appearance).filter((part) => part === "body" || part.startsWith("torso"));
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
    const atlas = mergeMeshes(highParts);

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

  it("closes the body so no hole opens at a shoulder or a joint", () => {
    expect(openEdgeCount(highParts[humanPartIndex("body")])).toBe(0);
    expect(openEdgeCount(lowParts[humanPartIndex("body")])).toBe(0);
    expect(openEdgeCount(farParts[humanPartIndex("body")])).toBe(0);
  });

  it("saves triangles at every lower level of detail", () => {
    const highTriangles = highParts.reduce((sum, mesh) => sum + triangleCount(mesh), 0);
    const lowTriangles = lowParts.reduce((sum, mesh) => sum + triangleCount(mesh), 0);
    const farTriangles = farParts.reduce((sum, mesh) => sum + triangleCount(mesh), 0);

    expect(lowTriangles).toBeLessThan(highTriangles * 0.75);
    expect(farTriangles).toBeLessThan(lowTriangles * 0.5);
  });
});

describe("attached parts", () => {
  it.each([
    ["high", highParts],
    ["low", lowParts],
    ["far", farParts],
  ] as const)("keeps every worn part and tool on the %s body standing on the ground", (_level, parts) => {
    for (const torso of TORSOS) {
      for (const part of HUMAN_PARTS.filter(isWorn)) {
        expect(looseParts(parts, ["body", torso, ...wornWith(part)]), `${torso} ${part}`).toEqual([]);
      }
    }
  });

  it("holds every carried load in the arms that carry it", () => {
    const poser = new SkeletonPoser(HUMAN_SKELETON);
    const pose = new Pose(HUMAN_SKELETON.bones.length);
    const people = [
      personAppearance({ age: 30, isFemale: false, seed: 0.37, tribe: TRIBE }),
      personAppearance({ age: 34, isFemale: true, seed: 0.6, tribe: TRIBE }),
      personAppearance({ age: 11, isFemale: false, seed: 0.4, tribe: TRIBE }),
    ];

    for (const appearance of people) {
      const body = bodyPartsOf(appearance);

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

const OUTFITS: readonly (readonly HumanPart[])[] = [
  ["hairLong", "beardFull", "tunic", "cape", "boots", "headband", "feather", "necklace", "armband"],
  ["hairBraids", "hairBun", "dress", "cloak", "paint"],
  ["hairPonytail", "hairWild", "beardShort", "wrap", "loincloth"],
  ["hairShort", "hairFringe"],
  ["hairShort", "tunic", "cape", "boots", "torc", "brooch", "buckle", "helmet"],
];

describe("moving parts", () => {
  const people = (
    [
      [30, false],
      [28, true],
      [9, false],
    ] as const
  ).map(([age, isFemale]) => personAppearance({ age, isFemale, seed: 0.37, tribe: TRIBE }));

  describe.each([
    ["high", highParts],
    ["low", lowParts],
    ["far", farParts],
  ] as const)("on the %s body", (_level, parts) => {
    it.each(PERSON_POSES)("keeps every limb, garment and tool on the body to %s", (clip) => {
      const poser = new SkeletonPoser(HUMAN_SKELETON);
      const pose = new Pose(HUMAN_SKELETON.bones.length);
      const carried = clip === "carry" ? "wood" : "nothing";

      for (const appearance of people) {
        const body = bodyPartsOf(appearance);

        for (const phase of [0.15, 0.4, 0.7]) {
          applyHumanClip(pose, clip, phase, { ageGroup: appearance.ageGroup, carried, motion: appearance.motion });
          poser.pose(pose, humanBoneScales(appearance.body));

          for (const outfit of OUTFITS) {
            const names = [...body, ...outfit, ...activityParts(clip, carried)];
            const mesh = posedMesh(mergeMeshes(names.map((name) => parts[humanPartIndex(name)])), poser);
            const loose = detachedPieces(mesh, TOUCHING, holdsPart(mesh, torsoIn(body))).map((piece) =>
              describePiece(mesh, piece)
            );

            expect(loose, `${appearance.ageGroup} ${phase} ${outfit.join(" ")}`).toEqual([]);
          }
        }
      }
    });
  });

  it("builds every part from solid shapes, never paper-thin cards", () => {
    for (const parts of [highParts, lowParts, farParts]) {
      for (const [index, mesh] of parts.entries()) {
        expect(thinnestPiece(mesh, meshPieces(mesh)), HUMAN_PARTS[index]).toBeGreaterThan(0.001);
      }
    }
  });
});

describe("resting poses", () => {
  it.each(["sit", "eat"] as const)("seats a person on the ground, not in the air, to %s", (clip) => {
    const poser = new SkeletonPoser(HUMAN_SKELETON);
    const pose = new Pose(HUMAN_SKELETON.bones.length);

    for (const age of [9, 30, 70]) {
      const appearance = personAppearance({ age, isFemale: age > 20, seed: 0.42, tribe: TRIBE });

      applyHumanClip(pose, clip, 0.3, { ageGroup: appearance.ageGroup, carried: "nothing", motion: appearance.motion });
      poser.pose(pose, humanBoneScales(appearance.body));

      const body = bodyPartsOf(appearance);
      const mesh = posedMesh(mergeMeshes(body.map((name) => highParts[humanPartIndex(name)])), poser);
      const seat = Array.from({ length: mesh.positions.length / 3 }, (_, vertex) => vertex).filter(
        (vertex) => mesh.channels.boneA[vertex] === HumanBone.Pelvis && mesh.channels.boneWeight[vertex] === 0
      );
      const lowestSeat = Math.min(...seat.map((vertex) => mesh.positions[vertex * 3 + 1]));

      expect(lowestSeat, `${appearance.ageGroup}`).toBeLessThan(0.08);
      expect(lowestSeat, `${appearance.ageGroup}`).toBeGreaterThan(-0.08);
    }
  });
});

describe("visible parts", () => {
  it("dresses everyone with a body, a torso and an outfit", () => {
    for (let index = 0; index < 40; index += 1) {
      const appearance = personAppearance({
        age: 8 + index,
        isFemale: index % 2 === 0,
        seed: index / 40,
        tribe: TRIBE,
      });
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
    expect(activityParts("mine", "nothing")).toEqual(["pickaxe"]);
    expect(activityParts("carry", "ore")).toEqual(["carriedOre"]);
  });

  it("arms hunters with the weapon they carry", () => {
    expect(activityParts("walk", "nothing", "bow")).toEqual(["bow", "quiver"]);
    expect(activityParts("run", "nothing", "spear")).toEqual(["spear"]);
    expect(activityParts("shoot", "nothing", "bow")).toEqual(["drawnBow", "quiver"]);
    expect(activityParts("throw", "nothing", "spear")).toEqual(["spear"]);
    expect(activityParts("eat", "nothing", "bow")).toEqual([]);
  });

  it("packs visible parts into the instance mask", () => {
    expect(humanPartMask(["body"])).toEqual([1, 0]);
    expect(humanPartMask(["body", "carriedCrops"])).toEqual([1, 2 ** (HUMAN_PARTS.indexOf("carriedCrops") - 24)]);
  });
});

describe("weapons in hand", () => {
  const hunter = personAppearance({ age: 30, era: 5, isFemale: false, seed: 0.37, tribe: TRIBE });
  const poser = new SkeletonPoser(HUMAN_SKELETON);
  const pose = new Pose(HUMAN_SKELETON.bones.length);

  function posedParts(clip: (typeof PERSON_POSES)[number], phase: number, names: readonly HumanPart[]): MeshData {
    applyHumanClip(pose, clip, phase, { ageGroup: hunter.ageGroup, carried: "nothing", motion: hunter.motion });
    poser.pose(pose, humanBoneScales(hunter.body));

    return posedMesh(mergeMeshes(names.map((name) => highParts[humanPartIndex(name)])), poser);
  }

  it.each(["walk", "run", "idle"] as const)("keeps the bow, the quiver and the spear on a hunter to %s", (clip) => {
    const body = bodyPartsOf(hunter);

    for (const weapon of WEAPON_KINDS) {
      for (const phase of [0.1, 0.45, 0.8]) {
        const names = [...body, ...activityParts(clip, "nothing", weapon)];
        const mesh = posedParts(clip, phase, names);
        const loose = detachedPieces(mesh, TOUCHING, holdsPart(mesh, torsoIn(body))).map((piece) =>
          describePiece(mesh, piece)
        );

        expect(loose, `${weapon} ${phase}`).toEqual([]);
      }
    }
  });

  it("points the nocked arrow past the bow towards the target at full draw", () => {
    const mesh = posedParts("shoot", 0.5, ["drawnBow"]);
    const bowHand = poser.jointPosition(HumanBone.HandLeft, new Vector3());
    const arrowhead = Array.from({ length: mesh.positions.length / 3 }, (_, vertex) => vertex).filter(
      (vertex) => mesh.channels.slot[vertex] === MaterialSlot.Metal
    );
    const farthest = Math.max(...arrowhead.map((vertex) => mesh.positions[vertex * 3 + 2]));

    expect(arrowhead.length).toBeGreaterThan(0);
    expect(farthest).toBeGreaterThan(bowHand.z + 0.05);
  });

  it("stretches the bow string from the bow tips to the drawing hand", () => {
    const mesh = posedParts("shoot", 0.5, ["drawnBow"]);
    const drawHand = poser.jointPosition(HumanBone.HandRight, new Vector3());
    const string = Array.from({ length: mesh.positions.length / 3 }, (_, vertex) => vertex).filter(
      (vertex) => mesh.channels.slot[vertex] === MaterialSlot.Rope && mesh.channels.boneWeight[vertex] === 1
    );
    const nearest = Math.min(
      ...string.map((vertex) => new Vector3().fromArray(mesh.positions, vertex * 3).distanceTo(drawHand))
    );

    expect(string.length).toBeGreaterThan(0);
    expect(nearest).toBeLessThan(0.15);
  });
});

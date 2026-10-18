import type { AnimalKind } from "../../content/animals.ts";
import type { AnimalPose } from "../../world/agent-poses.ts";
import { MeshBuilder } from "../mesh/mesh-builder.ts";
import type { MeshData } from "../mesh/mesh-data.ts";
import { maskOf, type PartMask } from "../part-mask.ts";
import type { Pose } from "../rig/pose.ts";
import type { Skeleton } from "../rig/skeleton.ts";
import type { AnimalAppearance } from "./animal-appearance.ts";
import { addDeerBody, addFawnSpots, addLargeAntlers, addSmallAntlers, DEER_FRAME, DEER_GAIT } from "./deer-model.ts";
import {
  addLongTusks,
  addMammothBody,
  addShortTusks,
  MAMMOTH_FRAME,
  MAMMOTH_GAIT,
  mammothTrunkMotion,
} from "./mammoth-model.ts";
import { type AnimalClipContext, applyAnimalClip, type ExtraMotion, type GaitStyle } from "./quadruped-clips.ts";
import { createQuadrupedSkeleton, LEG_ENDS, LEG_SIDES, legBones, QuadrupedBone } from "./quadruped-skeleton.ts";

type AnimalDetailLevel = "high" | "low";

const ANIMAL_SEGMENTS: Readonly<Record<AnimalDetailLevel, number>> = { high: 10, low: 6 };

type PartBuilder = (builder: MeshBuilder, segments: number) => void;

interface PartDefinition {
  readonly build: PartBuilder;
  readonly name: string;
}

interface AnimalSpecies {
  readonly boneScales: (appearance: AnimalAppearance) => Float32Array;
  readonly extraMotion: ExtraMotion | null;
  readonly gait: GaitStyle;
  readonly parts: readonly PartDefinition[];
  readonly skeleton: Skeleton;
  readonly visibleParts: (appearance: AnimalAppearance) => readonly string[];
}

function uniformBoneScales(skeleton: Skeleton, appearance: AnimalAppearance): Float32Array {
  const scales = new Float32Array(skeleton.bones.length * 3).fill(appearance.size);
  const head = appearance.size * appearance.headScale;

  scales.fill(head, QuadrupedBone.Head * 3, QuadrupedBone.Head * 3 + 3);

  for (const end of LEG_ENDS) {
    for (const side of LEG_SIDES) {
      const bones = legBones(end, side);

      for (const bone of [bones.upper, bones.lower, bones.hoof]) {
        scales[bone * 3 + 1] = appearance.size * appearance.legScale;
      }
    }
  }

  return scales;
}

const DEER_SKELETON = createQuadrupedSkeleton(DEER_FRAME);
const MAMMOTH_SKELETON = createQuadrupedSkeleton(MAMMOTH_FRAME);

function deerParts(appearance: AnimalAppearance): string[] {
  const parts = ["body"];

  if (appearance.hasAntlers) {
    parts.push(appearance.antlerSize > 0.95 ? "antlersLarge" : "antlersSmall");
  }

  if (appearance.hasSpots) {
    parts.push("spots");
  }

  return parts;
}

function mammothParts(appearance: AnimalAppearance): string[] {
  if (appearance.tuskLength > 0.8) {
    return ["body", "tusksLong"];
  }

  if (appearance.tuskLength > 0.3) {
    return ["body", "tusksShort"];
  }

  return ["body"];
}

export const ANIMAL_SPECIES: Readonly<Record<AnimalKind, AnimalSpecies>> = {
  deer: {
    boneScales: (appearance) => uniformBoneScales(DEER_SKELETON, appearance),
    extraMotion: null,
    gait: DEER_GAIT,
    parts: [
      { build: addDeerBody, name: "body" },
      { build: addSmallAntlers, name: "antlersSmall" },
      { build: addLargeAntlers, name: "antlersLarge" },
      { build: addFawnSpots, name: "spots" },
    ],
    skeleton: DEER_SKELETON,
    visibleParts: deerParts,
  },
  mammoth: {
    boneScales: (appearance) => uniformBoneScales(MAMMOTH_SKELETON, appearance),
    extraMotion: mammothTrunkMotion,
    gait: MAMMOTH_GAIT,
    parts: [
      { build: addMammothBody, name: "body" },
      { build: addShortTusks, name: "tusksShort" },
      { build: addLongTusks, name: "tusksLong" },
    ],
    skeleton: MAMMOTH_SKELETON,
    visibleParts: mammothParts,
  },
};

export function buildAnimalParts(kind: AnimalKind, level: AnimalDetailLevel): MeshData[] {
  return ANIMAL_SPECIES[kind].parts.map((part, index) => {
    const builder = new MeshBuilder({ part: index });

    part.build(builder, ANIMAL_SEGMENTS[level]);

    return builder.build();
  });
}

export function animalPartMask(kind: AnimalKind, appearance: AnimalAppearance): PartMask {
  const species = ANIMAL_SPECIES[kind];

  const names = species.parts.map((part) => part.name);

  return maskOf(species.visibleParts(appearance).map((name) => names.indexOf(name)));
}

export function poseAnimal(
  kind: AnimalKind,
  pose: Pose,
  clip: AnimalPose,
  phase: number,
  context: Omit<AnimalClipContext, "gait">
): void {
  const species = ANIMAL_SPECIES[kind];

  applyAnimalClip(pose, clip, phase, { ...context, gait: species.gait }, species.extraMotion);
}

import type { AnimalKind } from "../../content/animals.ts";
import type { AnimalPose } from "../../world/agent-poses.ts";
import { MeshBuilder } from "../mesh/mesh-builder.ts";
import type { MeshData } from "../mesh/mesh-data.ts";
import type { Pose } from "../rig/pose.ts";
import type { Skeleton } from "../rig/skeleton.ts";
import type { AnimalAppearance } from "./animal-appearance.ts";
import { ANIMAL_DETAILS, type AnimalDetail, type AnimalDetailLevel } from "./animal-detail.ts";
import { addDeerBody, addFawnSpots, addLargeAntlers, addSmallAntlers, DEER_FRAME, DEER_GAIT } from "./deer-model.ts";
import { addHareBody, HARE_FRAME, HARE_GAIT, hareEarMotion } from "./hare-model.ts";
import { addIbexBody, addLongHorns, addShortHorns, IBEX_FRAME, IBEX_GAIT } from "./ibex-model.ts";
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
import { addRuff, addWolfBody, WOLF_FRAME, WOLF_GAIT } from "./wolf-model.ts";

type PartBuilder = (builder: MeshBuilder, detail: AnimalDetail) => void;

interface PartDefinition {
  readonly build: PartBuilder;
  readonly isShown: (appearance: AnimalAppearance) => boolean;
  readonly name: string;
}

interface AnimalSpecies {
  readonly extraMotion: ExtraMotion | null;
  readonly gait: GaitStyle;
  readonly parts: readonly PartDefinition[];
  readonly skeleton: Skeleton;
}

const always = () => true;

export const ANIMAL_SPECIES: Readonly<Record<AnimalKind, AnimalSpecies>> = {
  deer: {
    extraMotion: null,
    gait: DEER_GAIT,
    parts: [
      { build: addDeerBody, isShown: always, name: "body" },
      {
        build: addSmallAntlers,
        isShown: (appearance) => appearance.hasAntlers && appearance.antlerSize <= 0.95,
        name: "antlersSmall",
      },
      {
        build: addLargeAntlers,
        isShown: (appearance) => appearance.hasAntlers && appearance.antlerSize > 0.95,
        name: "antlersLarge",
      },
      { build: addFawnSpots, isShown: (appearance) => appearance.hasSpots, name: "spots" },
    ],
    skeleton: createQuadrupedSkeleton(DEER_FRAME),
  },
  hare: {
    extraMotion: hareEarMotion,
    gait: HARE_GAIT,
    parts: [{ build: addHareBody, isShown: always, name: "body" }],
    skeleton: createQuadrupedSkeleton(HARE_FRAME),
  },
  ibex: {
    extraMotion: null,
    gait: IBEX_GAIT,
    parts: [
      { build: addIbexBody, isShown: always, name: "body" },
      {
        build: addShortHorns,
        isShown: (appearance) => appearance.hornLength > 0.2 && appearance.hornLength <= 0.8,
        name: "hornsShort",
      },
      { build: addLongHorns, isShown: (appearance) => appearance.hornLength > 0.8, name: "hornsLong" },
    ],
    skeleton: createQuadrupedSkeleton(IBEX_FRAME),
  },
  mammoth: {
    extraMotion: mammothTrunkMotion,
    gait: MAMMOTH_GAIT,
    parts: [
      { build: addMammothBody, isShown: always, name: "body" },
      {
        build: addShortTusks,
        isShown: (appearance) => appearance.tuskLength > 0.3 && appearance.tuskLength <= 0.8,
        name: "tusksShort",
      },
      { build: addLongTusks, isShown: (appearance) => appearance.tuskLength > 0.8, name: "tusksLong" },
    ],
    skeleton: createQuadrupedSkeleton(MAMMOTH_FRAME),
  },
  wolf: {
    extraMotion: null,
    gait: WOLF_GAIT,
    parts: [
      { build: addWolfBody, isShown: always, name: "body" },
      { build: addRuff, isShown: (appearance) => appearance.hasRuff, name: "ruff" },
    ],
    skeleton: createQuadrupedSkeleton(WOLF_FRAME),
  },
};

export function animalBoneScales(kind: AnimalKind, appearance: AnimalAppearance): Float32Array {
  const scales = new Float32Array(ANIMAL_SPECIES[kind].skeleton.bones.length * 3).fill(appearance.size);
  const head = appearance.size * appearance.headScale;
  const legHeight = appearance.size * appearance.legScale;

  scales.fill(head, QuadrupedBone.Head * 3, QuadrupedBone.Head * 3 + 3);

  for (const end of LEG_ENDS) {
    for (const side of LEG_SIDES) {
      const bones = legBones(end, side);

      for (const bone of [bones.upper, bones.lower, bones.hoof]) {
        scales[bone * 3 + 1] = legHeight;
      }
    }
  }

  return scales;
}

export function buildAnimalParts(kind: AnimalKind, level: AnimalDetailLevel): MeshData[] {
  return ANIMAL_SPECIES[kind].parts.map((part, index) => {
    const builder = new MeshBuilder({ part: index });

    part.build(builder, ANIMAL_DETAILS[level]);

    return builder.build();
  });
}

export function visibleAnimalParts(kind: AnimalKind, appearance: AnimalAppearance): number[] {
  return ANIMAL_SPECIES[kind].parts.flatMap((part, index) => (part.isShown(appearance) ? [index] : []));
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

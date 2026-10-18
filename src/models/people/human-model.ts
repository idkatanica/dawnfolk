import type { CarriedItem, PersonPose } from "../../world/agent-poses.ts";
import { MeshBuilder } from "../mesh/mesh-builder.ts";
import { type MeshData, mergeMeshes } from "../mesh/mesh-data.ts";
import { maskOf, type PartMask } from "../part-mask.ts";
import type { HairStyle, Outfit, PersonAppearance } from "./appearance.ts";
import { addBody, addChildTorso, addFemaleTorso, addMaleTorso } from "./human-anatomy.ts";
import { HUMAN_CLIPS, type HumanTool } from "./human-clips.ts";
import { addBoots, addCape, addCloak, addDress, addLoincloth, addTunic, addWrap } from "./human-clothing.ts";
import type { HumanDetail } from "./human-detail.ts";
import {
  addBraids,
  addBun,
  addFringeHair,
  addFullBeard,
  addLongHair,
  addPonytail,
  addShortBeard,
  addShortHair,
  addWildHair,
} from "./human-hair.ts";
import {
  addArmband,
  addAxe,
  addCarriedBerries,
  addCarriedCrops,
  addCarriedFish,
  addCarriedMeat,
  addCarriedStone,
  addCarriedWood,
  addDiggingStick,
  addFeather,
  addHammerStone,
  addHeadband,
  addNecklace,
  addPaint,
  addSpear,
  addToolBasket,
} from "./human-props.ts";

export const HUMAN_PARTS = [
  "body",
  "torsoMale",
  "torsoFemale",
  "torsoChild",
  "hairShort",
  "hairLong",
  "hairBraids",
  "hairBun",
  "hairPonytail",
  "hairWild",
  "hairFringe",
  "beardShort",
  "beardFull",
  "tunic",
  "dress",
  "loincloth",
  "wrap",
  "cape",
  "cloak",
  "boots",
  "headband",
  "feather",
  "necklace",
  "paint",
  "armband",
  "axe",
  "spear",
  "diggingStick",
  "hammerStone",
  "basket",
  "carriedWood",
  "carriedStone",
  "carriedBerries",
  "carriedMeat",
  "carriedFish",
  "carriedCrops",
] as const;

export type HumanPart = (typeof HUMAN_PARTS)[number];

type PartBuilder = (builder: MeshBuilder, detail: HumanDetail) => void;

const PART_BUILDERS: Readonly<Record<HumanPart, PartBuilder>> = {
  armband: addArmband,
  axe: addAxe,
  basket: addToolBasket,
  beardFull: addFullBeard,
  beardShort: addShortBeard,
  body: addBody,
  boots: addBoots,
  cape: addCape,
  carriedBerries: addCarriedBerries,
  carriedCrops: addCarriedCrops,
  carriedFish: addCarriedFish,
  carriedMeat: addCarriedMeat,
  carriedStone: addCarriedStone,
  carriedWood: addCarriedWood,
  cloak: addCloak,
  diggingStick: addDiggingStick,
  dress: addDress,
  feather: addFeather,
  hairBraids: addBraids,
  hairBun: addBun,
  hairFringe: addFringeHair,
  hairLong: addLongHair,
  hairPonytail: addPonytail,
  hairShort: addShortHair,
  hairWild: addWildHair,
  hammerStone: addHammerStone,
  headband: addHeadband,
  loincloth: addLoincloth,
  necklace: addNecklace,
  paint: addPaint,
  spear: addSpear,
  torsoChild: addChildTorso,
  torsoFemale: addFemaleTorso,
  torsoMale: addMaleTorso,
  tunic: addTunic,
  wrap: addWrap,
};

export function humanPartIndex(part: HumanPart): number {
  return HUMAN_PARTS.indexOf(part);
}

export function buildHumanParts(detail: HumanDetail): MeshData[] {
  return HUMAN_PARTS.map((part, index) => {
    const builder = new MeshBuilder({ part: index });

    PART_BUILDERS[part](builder, detail);

    return builder.build();
  });
}

export function buildHumanAtlas(detail: HumanDetail): MeshData {
  return mergeMeshes(buildHumanParts(detail));
}

const HAIR_PARTS: Readonly<Record<HairStyle, HumanPart | null>> = {
  bald: null,
  braids: "hairBraids",
  bun: "hairBun",
  fringe: "hairFringe",
  long: "hairLong",
  ponytail: "hairPonytail",
  short: "hairShort",
  wild: "hairWild",
};

const OUTFIT_PARTS: Readonly<Record<Outfit, HumanPart>> = {
  dress: "dress",
  loincloth: "loincloth",
  tunic: "tunic",
  wrap: "wrap",
};

const TOOL_PARTS: Readonly<Record<HumanTool, HumanPart>> = {
  axe: "axe",
  basket: "basket",
  diggingStick: "diggingStick",
  hammerStone: "hammerStone",
  spear: "spear",
};

const CARRIED_PARTS: Readonly<Record<CarriedItem, HumanPart | null>> = {
  berries: "carriedBerries",
  crops: "carriedCrops",
  fish: "carriedFish",
  meat: "carriedMeat",
  nothing: null,
  stone: "carriedStone",
  wood: "carriedWood",
};

function torsoPart(appearance: PersonAppearance): HumanPart {
  if (appearance.ageGroup === "child") {
    return "torsoChild";
  }

  return appearance.isFemale ? "torsoFemale" : "torsoMale";
}

function beardPart(appearance: PersonAppearance): HumanPart | null {
  if (appearance.beard === "none") {
    return null;
  }

  return appearance.beard === "full" ? "beardFull" : "beardShort";
}

export function appearanceParts(appearance: PersonAppearance): HumanPart[] {
  const parts: (HumanPart | null)[] = [
    "body",
    torsoPart(appearance),
    HAIR_PARTS[appearance.hair],
    beardPart(appearance),
    OUTFIT_PARTS[appearance.outfit],
    ...appearance.accessories,
  ];

  if (appearance.hasCape) {
    parts.push("cape");
  }

  if (appearance.hasCloak) {
    parts.push("cloak");
  }

  if (appearance.hasBoots) {
    parts.push("boots");
  }

  return parts.filter((part) => part !== null);
}

export function activityParts(pose: PersonPose, carried: CarriedItem): HumanPart[] {
  const { tool } = HUMAN_CLIPS[pose];
  const parts: HumanPart[] = [];

  if (tool !== null) {
    parts.push(TOOL_PARTS[tool]);
  }

  const carriedPart = CARRIED_PARTS[carried];

  if (pose === "carry" && carriedPart !== null) {
    parts.push(carriedPart);
  }

  return parts;
}

export function humanPartMask(parts: readonly HumanPart[]): PartMask {
  return maskOf(parts.map((part) => humanPartIndex(part)));
}

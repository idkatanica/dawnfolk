import type { WeaponKind } from "../../content/weapons.ts";
import type { CarriedItem, PersonPose } from "../../world/agent-poses.ts";
import { MeshBuilder } from "../mesh/mesh-builder.ts";
import type { MeshData } from "../mesh/mesh-data.ts";
import type { HairStyle, PersonAppearance } from "./appearance.ts";
import { addCarriedClay, addCarriedFruit, addCarriedOre } from "./carried-props.ts";
import { addBrooch, addBuckle, addHelmet, addTorc } from "./era-props.ts";
import { addBody, addChildTorso, addFemaleTorso, addMaleTorso } from "./human-anatomy.ts";
import { HUMAN_CLIPS } from "./human-clips.ts";
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
import { addWarPaint } from "./war-props.ts";
import { addBow, addDrawnBow, addPickaxe, addQuiver } from "./weapon-props.ts";

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
  "bow",
  "drawnBow",
  "quiver",
  "pickaxe",
  "carriedOre",
  "carriedClay",
  "carriedFruit",
  "torc",
  "helmet",
  "brooch",
  "buckle",
  "warPaint",
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
  bow: addBow,
  brooch: addBrooch,
  buckle: addBuckle,
  cape: addCape,
  carriedBerries: addCarriedBerries,
  carriedClay: addCarriedClay,
  carriedCrops: addCarriedCrops,
  carriedFish: addCarriedFish,
  carriedFruit: addCarriedFruit,
  carriedMeat: addCarriedMeat,
  carriedOre: addCarriedOre,
  carriedStone: addCarriedStone,
  carriedWood: addCarriedWood,
  cloak: addCloak,
  diggingStick: addDiggingStick,
  drawnBow: addDrawnBow,
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
  helmet: addHelmet,
  loincloth: addLoincloth,
  necklace: addNecklace,
  paint: addPaint,
  pickaxe: addPickaxe,
  quiver: addQuiver,
  spear: addSpear,
  torc: addTorc,
  torsoChild: addChildTorso,
  torsoFemale: addFemaleTorso,
  torsoMale: addMaleTorso,
  tunic: addTunic,
  warPaint: addWarPaint,
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

const CARRIED_PARTS: Readonly<Record<CarriedItem, HumanPart | null>> = {
  berries: "carriedBerries",
  clay: "carriedClay",
  crops: "carriedCrops",
  fish: "carriedFish",
  fruit: "carriedFruit",
  meat: "carriedMeat",
  nothing: null,
  ore: "carriedOre",
  stone: "carriedStone",
  wood: "carriedWood",
};

const ARMED_POSES: ReadonlySet<PersonPose> = new Set([
  "block",
  "brawl",
  "charge",
  "fall",
  "flinch",
  "idle",
  "march",
  "run",
  "thrust",
  "walk",
]);

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
    appearance.outfit,
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

function weaponParts(pose: PersonPose, weapon: WeaponKind | null): HumanPart[] {
  if (pose === "shoot") {
    return ["quiver"];
  }

  if (weapon === null || !ARMED_POSES.has(pose)) {
    return [];
  }

  if (weapon === "bow") {
    return ["bow", "quiver"];
  }

  return ["spear"];
}

export function activityParts(pose: PersonPose, carried: CarriedItem, weapon: WeaponKind | null = null): HumanPart[] {
  const { tool } = HUMAN_CLIPS[pose];

  const carriedPart = CARRIED_PARTS[carried];
  const parts: HumanPart[] = [];

  if (tool !== null) {
    parts.push(tool);
  }

  if (pose === "carry" && carriedPart !== null) {
    parts.push(carriedPart);
  }

  parts.push(...weaponParts(pose, weapon));

  return parts;
}

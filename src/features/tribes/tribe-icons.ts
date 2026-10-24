import type { BuildingKind } from "../../content/buildings.ts";
import type { ResourceKind } from "../../content/resources.ts";
import type { GameIconName } from "../../design/game-icon-sources.ts";

export const RESOURCE_ICONS: Readonly<Record<ResourceKind, GameIconName>> = {
  arrows: "arrows",
  berries: "berries",
  bows: "bows",
  bronze: "bronze",
  clay: "clay",
  copper: "copper",
  copperOre: "copper-ore",
  fish: "fish",
  fruit: "fruit",
  grain: "grain",
  iron: "iron",
  ironOre: "iron-ore",
  linen: "linen",
  meat: "meat",
  pottery: "pottery",
  spears: "spears",
  stone: "stone",
  tinOre: "tin-ore",
  vegetables: "vegetables",
  wood: "wood",
};

export const BUILDING_ICONS: Readonly<Record<BuildingKind, GameIconName>> = {
  campfire: "campfire",
  forge: "forge",
  granary: "granary",
  hut: "hut",
  kiln: "kiln",
  longhouse: "longhouse",
  mine: "mine",
  palisade: "palisade",
  smelter: "smelter",
  stoneHouse: "stone-house",
  stoneWall: "stone-wall",
  storehouse: "storehouse",
  tent: "tent",
  totem: "totem",
  workshop: "workshop",
};

import type { MaterialKind } from "./resources.ts";
import type { TechnologyId } from "./technologies.ts";

export const BUILDING_KINDS = [
  "campfire",
  "tent",
  "hut",
  "storehouse",
  "totem",
  "granary",
  "kiln",
  "workshop",
  "longhouse",
  "mine",
  "smelter",
  "palisade",
  "stoneHouse",
  "forge",
  "stoneWall",
] as const;

export type BuildingKind = (typeof BUILDING_KINDS)[number];

type BuildingCost = Readonly<Partial<Record<MaterialKind, number>>>;

export type BuildingRole = "craft" | "dwelling" | "enclosure" | "fire" | "mine" | "shrine" | "store";

export interface BuildingDefinition {
  burnTime: number;
  capacity: number;
  cost: BuildingCost;
  footprint: number;
  health: number;
  name: string;
  role: BuildingRole;
  steepestSlope: number;
  storage: number;
  technology: TechnologyId;
  work: number;
}

export const BUILDINGS: Readonly<Record<BuildingKind, BuildingDefinition>> = {
  campfire: {
    burnTime: 0,
    capacity: 0,
    cost: { wood: 3 },
    footprint: 1.4,
    health: 40,
    name: "Campfire",
    role: "fire",
    steepestSlope: 0.45,
    storage: 0,
    technology: "fire",
    work: 4,
  },
  forge: {
    burnTime: 30,
    capacity: 0,
    cost: { bronze: 2, stone: 14, wood: 10 },
    footprint: 4,
    health: 140,
    name: "Forge",
    role: "craft",
    steepestSlope: 0.45,
    storage: 0,
    technology: "iron",
    work: 36,
  },
  granary: {
    burnTime: 40,
    capacity: 0,
    cost: { clay: 4, pottery: 2, wood: 12 },
    footprint: 3.3,
    health: 60,
    name: "Granary",
    role: "store",
    steepestSlope: 0.45,
    storage: 120,
    technology: "farming",
    work: 24,
  },
  hut: {
    burnTime: 45,
    capacity: 5,
    cost: { stone: 4, wood: 12 },
    footprint: 4.3,
    health: 70,
    name: "Hut",
    role: "dwelling",
    steepestSlope: 0.45,
    storage: 0,
    technology: "huts",
    work: 22,
  },
  kiln: {
    burnTime: 0,
    capacity: 0,
    cost: { clay: 6, stone: 4 },
    footprint: 2.6,
    health: 90,
    name: "Kiln",
    role: "craft",
    steepestSlope: 0.45,
    storage: 0,
    technology: "pottery",
    work: 18,
  },
  longhouse: {
    burnTime: 60,
    capacity: 10,
    cost: { stone: 6, wood: 30 },
    footprint: 7.6,
    health: 110,
    name: "Longhouse",
    role: "dwelling",
    steepestSlope: 0.4,
    storage: 0,
    technology: "copper",
    work: 50,
  },
  mine: {
    burnTime: 50,
    capacity: 0,
    cost: { stone: 4, wood: 14 },
    footprint: 6,
    health: 120,
    name: "Mine",
    role: "mine",
    steepestSlope: 0.7,
    storage: 0,
    technology: "mining",
    work: 30,
  },
  palisade: {
    burnTime: 70,
    capacity: 0,
    cost: { wood: 60 },
    footprint: 0,
    health: 200,
    name: "Palisade",
    role: "enclosure",
    steepestSlope: 0.6,
    storage: 0,
    technology: "bronze",
    work: 90,
  },
  smelter: {
    burnTime: 0,
    capacity: 0,
    cost: { clay: 8, stone: 8 },
    footprint: 3,
    health: 100,
    name: "Smelter",
    role: "craft",
    steepestSlope: 0.45,
    storage: 0,
    technology: "copper",
    work: 26,
  },
  stoneHouse: {
    burnTime: 30,
    capacity: 8,
    cost: { stone: 24, wood: 10 },
    footprint: 5.2,
    health: 200,
    name: "Stone house",
    role: "dwelling",
    steepestSlope: 0.4,
    storage: 0,
    technology: "masonry",
    work: 60,
  },
  stoneWall: {
    burnTime: 0,
    capacity: 0,
    cost: { stone: 60 },
    footprint: 0,
    health: 400,
    name: "Stone wall",
    role: "enclosure",
    steepestSlope: 0.6,
    storage: 0,
    technology: "masonry",
    work: 140,
  },
  storehouse: {
    burnTime: 35,
    capacity: 0,
    cost: { wood: 8 },
    footprint: 3,
    health: 50,
    name: "Storehouse",
    role: "store",
    steepestSlope: 0.45,
    storage: 60,
    technology: "storage",
    work: 12,
  },
  tent: {
    burnTime: 25,
    capacity: 3,
    cost: { wood: 6 },
    footprint: 2.8,
    health: 30,
    name: "Shelter",
    role: "dwelling",
    steepestSlope: 0.45,
    storage: 0,
    technology: "shelter",
    work: 10,
  },
  totem: {
    burnTime: 40,
    capacity: 0,
    cost: { stone: 2, wood: 10 },
    footprint: 1.6,
    health: 60,
    name: "Totem",
    role: "shrine",
    steepestSlope: 0.45,
    storage: 0,
    technology: "totem",
    work: 18,
  },
  workshop: {
    burnTime: 45,
    capacity: 0,
    cost: { bronze: 2, stone: 4, wood: 16 },
    footprint: 3.8,
    health: 70,
    name: "Workshop",
    role: "craft",
    steepestSlope: 0.45,
    storage: 0,
    technology: "bronze",
    work: 26,
  },
};

export function isEnclosure(kind: BuildingKind): boolean {
  return BUILDINGS[kind].role === "enclosure";
}

export function isFlammable(kind: BuildingKind): boolean {
  return BUILDINGS[kind].burnTime > 0;
}

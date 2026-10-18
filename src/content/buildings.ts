export const BUILDING_KINDS = ["campfire", "tent", "hut", "storehouse", "totem"] as const;

export type BuildingKind = (typeof BUILDING_KINDS)[number];

interface BuildingDefinition {
  burnTime: number;
  capacity: number;
  health: number;
  name: string;
  steepestSlope: number;
  stone: number;
  wood: number;
  work: number;
}

export const BUILDINGS: Readonly<Record<BuildingKind, BuildingDefinition>> = {
  campfire: { burnTime: 0, capacity: 0, health: 40, name: "Campfire", steepestSlope: 0.45, stone: 0, wood: 3, work: 4 },
  hut: { burnTime: 45, capacity: 5, health: 70, name: "Hut", steepestSlope: 0.45, stone: 4, wood: 12, work: 22 },
  storehouse: {
    burnTime: 35,
    capacity: 0,
    health: 50,
    name: "Storehouse",
    steepestSlope: 0.45,
    stone: 0,
    wood: 8,
    work: 12,
  },
  tent: { burnTime: 25, capacity: 3, health: 30, name: "Shelter", steepestSlope: 0.45, stone: 0, wood: 6, work: 10 },
  totem: { burnTime: 40, capacity: 0, health: 60, name: "Totem", steepestSlope: 0.45, stone: 2, wood: 10, work: 18 },
};

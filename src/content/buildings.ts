export const BUILDING_KINDS = ["campfire", "tent", "hut", "storehouse", "totem"] as const;

export type BuildingKind = (typeof BUILDING_KINDS)[number];

export interface BuildingDefinition {
  burnTime: number;
  capacity: number;
  health: number;
  kind: BuildingKind;
  name: string;
  stone: number;
  wood: number;
  work: number;
}

export const BUILDINGS: Readonly<Record<BuildingKind, BuildingDefinition>> = {
  campfire: { burnTime: 0, capacity: 0, health: 40, kind: "campfire", name: "Campfire", stone: 0, wood: 3, work: 4 },
  hut: { burnTime: 45, capacity: 5, health: 70, kind: "hut", name: "Hut", stone: 4, wood: 12, work: 22 },
  storehouse: {
    burnTime: 35,
    capacity: 0,
    health: 50,
    kind: "storehouse",
    name: "Storehouse",
    stone: 0,
    wood: 8,
    work: 12,
  },
  tent: { burnTime: 25, capacity: 3, health: 30, kind: "tent", name: "Shelter", stone: 0, wood: 6, work: 10 },
  totem: { burnTime: 40, capacity: 0, health: 60, kind: "totem", name: "Totem", stone: 2, wood: 10, work: 18 },
};

import {
  type BuildingDefinition,
  CAMP_BUILDING_KINDS,
  CAMP_BUILDINGS,
  ERA_BUILDING_KINDS,
  ERA_BUILDINGS,
} from "./era-buildings.ts";

export const BUILDING_KINDS = [...CAMP_BUILDING_KINDS, ...ERA_BUILDING_KINDS] as const;

export type BuildingKind = (typeof BUILDING_KINDS)[number];

export const BUILDINGS: Readonly<Record<BuildingKind, BuildingDefinition>> = { ...CAMP_BUILDINGS, ...ERA_BUILDINGS };

export function isEnclosure(kind: BuildingKind): boolean {
  return BUILDINGS[kind].role === "enclosure";
}

export function isFlammable(kind: BuildingKind): boolean {
  return BUILDINGS[kind].burnTime > 0;
}

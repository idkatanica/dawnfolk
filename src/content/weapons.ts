import type { MaterialKind } from "./resources.ts";
import type { TechnologyId } from "./technologies.ts";

export const WEAPON_KINDS = ["spear", "bow"] as const;

export type WeaponKind = (typeof WEAPON_KINDS)[number];

export const TOOL_MATERIALS = ["wood", "stone", "copper", "bronze", "iron"] as const;

export type ToolMaterial = (typeof TOOL_MATERIALS)[number];

interface ToolMaterialDefinition {
  hitBonus: number;
  metal: MaterialKind | null;
  name: string;
  technology: TechnologyId | null;
  workSpeed: number;
}

export const TOOL_MATERIAL_DEFINITIONS: Readonly<Record<ToolMaterial, ToolMaterialDefinition>> = {
  bronze: { hitBonus: 0.1, metal: "bronze", name: "Bronze", technology: "bronze", workSpeed: 1.5 },
  copper: { hitBonus: 0.06, metal: "copper", name: "Copper", technology: "copper", workSpeed: 1.25 },
  iron: { hitBonus: 0.14, metal: "iron", name: "Iron", technology: "iron", workSpeed: 1.8 },
  stone: { hitBonus: 0.03, metal: null, name: "Flint", technology: null, workSpeed: 1 },
  wood: { hitBonus: 0, metal: null, name: "Wood", technology: null, workSpeed: 0.9 },
};

export const METAL_TOOL_MATERIALS: readonly ToolMaterial[] = ["copper", "bronze", "iron"];

export function toolMaterialRank(material: ToolMaterial): number {
  return TOOL_MATERIALS.indexOf(material);
}

export function isBetterMaterial(candidate: ToolMaterial, current: ToolMaterial): boolean {
  return toolMaterialRank(candidate) > toolMaterialRank(current);
}

export const WEAPON_NAMES: Readonly<Record<WeaponKind, string>> = { bow: "Bow", spear: "Spear" };

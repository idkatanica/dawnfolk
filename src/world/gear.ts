import { TOOL_MATERIALS, type ToolMaterial, WEAPON_KINDS, type WeaponKind } from "../content/weapons.ts";

export const NO_WEAPON_CODE = 0;

export function weaponCode(kind: WeaponKind): number {
  return WEAPON_KINDS.indexOf(kind) + 1;
}

export function gearCode(material: ToolMaterial): number {
  return TOOL_MATERIALS.indexOf(material);
}

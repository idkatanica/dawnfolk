import { TOOL_MATERIALS, type ToolMaterial, WEAPON_KINDS, type WeaponKind } from "../content/weapons.ts";

export const NO_WEAPON_CODE = 0;

export function weaponCode(kind: WeaponKind | null): number {
  if (kind === null) {
    return NO_WEAPON_CODE;
  }

  return WEAPON_KINDS.indexOf(kind) + 1;
}

export function weaponOfCode(code: number): WeaponKind | null {
  const kind = WEAPON_KINDS[Math.round(code) - 1];

  if (kind === undefined) {
    return null;
  }

  return kind;
}

export function gearCode(material: ToolMaterial): number {
  return TOOL_MATERIALS.indexOf(material);
}

export function gearOfCode(code: number): ToolMaterial {
  const material = TOOL_MATERIALS[Math.round(code)];

  if (material === undefined) {
    return "stone";
  }

  return material;
}

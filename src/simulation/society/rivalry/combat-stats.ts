import { TOOL_MATERIAL_DEFINITIONS } from "../../../content/weapons.ts";
import type { CarriedWeapon } from "../weapons.ts";

export type WeaponKind = CarriedWeapon["kind"];

interface WeaponStats {
  readonly accuracy: number;
  readonly damage: number;
  readonly reach: number;
  readonly strikeSeconds: number;
}

export const BARE_HANDS: CarriedWeapon = { kind: "none" };

export const WEAPON_STATS: Readonly<Record<WeaponKind, WeaponStats>> = {
  bow: { accuracy: 0.62, damage: 0.2, reach: 26, strikeSeconds: 2.4 },
  none: { accuracy: 0.6, damage: 0.07, reach: 1.3, strikeSeconds: 0.9 },
  spear: { accuracy: 0.6, damage: 0.26, reach: 2.4, strikeSeconds: 1.1 },
};

const EDGE_PER_HIT_BONUS = 4;

export function weaponDamage(weapon: CarriedWeapon): number {
  const { damage } = WEAPON_STATS[weapon.kind];

  if (weapon.kind === "none") {
    return damage;
  }

  return damage * (1 + TOOL_MATERIAL_DEFINITIONS[weapon.material].hitBonus * EDGE_PER_HIT_BONUS);
}

export function isRanged(weapon: CarriedWeapon): boolean {
  return weapon.kind === "bow";
}

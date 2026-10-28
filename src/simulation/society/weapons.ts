import {
  isBetterMaterial,
  TOOL_MATERIAL_DEFINITIONS,
  type ToolMaterial,
  type WeaponKind,
} from "../../content/weapons.ts";
import type { Person, Weapon } from "./person.ts";
import { knows, type Tribe } from "./tribe.ts";

export const METALS_BY_STRENGTH: readonly ToolMaterial[] = ["iron", "bronze", "copper"];

const ARROWS_TO_HUNT = 3;
const BOW_HIT_BONUS = 0.08;

export type CarriedWeapon = { readonly kind: "none" } | { readonly kind: WeaponKind; readonly material: ToolMaterial };

export function carriedWeapon(person: Person): CarriedWeapon {
  const { weapon } = person;

  if (weapon === null) {
    return { kind: "none" };
  }

  return { kind: weapon.kind, material: weapon.material };
}

export function weaponHitBonus(weapon: Weapon): number {
  const bowBonus = weapon.kind === "bow" ? BOW_HIT_BONUS : 0;

  return TOOL_MATERIAL_DEFINITIONS[weapon.material].hitBonus + bowBonus;
}

export function headMaterial(tribe: Tribe): ToolMaterial {
  for (const material of METALS_BY_STRENGTH) {
    const { metal, technology } = TOOL_MATERIAL_DEFINITIONS[material];

    if (metal !== null && technology !== null && knows(tribe, technology) && tribe.stock[metal] >= 1) {
      return material;
    }
  }

  return "stone";
}

export function canShoot(tribe: Tribe): boolean {
  return tribe.stock.arrows >= 1;
}

function canTakeBow(tribe: Tribe): boolean {
  return knows(tribe, "archery") && tribe.stock.bows >= 1 && tribe.stock.arrows >= ARROWS_TO_HUNT;
}

export function hasWeaponsToHunt(tribe: Tribe): boolean {
  return canTakeBow(tribe) || tribe.stock.spears >= 1;
}

function isUsable(weapon: Weapon, tribe: Tribe): boolean {
  return weapon.kind === "spear" || canShoot(tribe);
}

function isOutdated(weapon: Weapon, tribe: Tribe): boolean {
  if (!isBetterMaterial(tribe.armory, weapon.material)) {
    return false;
  }

  return weapon.kind === "bow" ? canTakeBow(tribe) : tribe.stock.spears >= 1;
}

export function armForHunt(person: Person, tribe: Tribe): Weapon | null {
  const current = person.weapon;

  if (current !== null && isUsable(current, tribe) && !isOutdated(current, tribe)) {
    return current;
  }

  if (canTakeBow(tribe)) {
    tribe.stock.bows -= 1;
    person.weapon = { kind: "bow", material: tribe.armory };

    return person.weapon;
  }

  if (tribe.stock.spears >= 1) {
    tribe.stock.spears -= 1;
    person.weapon = { kind: "spear", material: tribe.armory };

    return person.weapon;
  }

  return current !== null && isUsable(current, tribe) ? current : null;
}

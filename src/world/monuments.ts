import type { MonumentKind } from "../content/monuments.ts";

export const MonumentDamage = {
  Fallen: 2,
  Leaning: 1,
  Rubble: 3,
  Standing: 0,
} as const;

export type MonumentDamageLevel = (typeof MonumentDamage)[keyof typeof MonumentDamage];

export interface MonumentCondition {
  damage: MonumentDamageLevel;
  isDrowned: boolean;
}

export interface Monument {
  readonly cells: readonly number[];
  readonly id: number;
  readonly kind: MonumentKind;
  readonly name: string;
  readonly x: number;
  readonly z: number;
}

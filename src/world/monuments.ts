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

export function monumentGround(cellCount: number, monuments: readonly Monument[]): Uint8Array {
  const ground = new Uint8Array(cellCount);

  for (const monument of monuments) {
    for (const cell of monument.cells) {
      ground[cell] = 1;
    }
  }

  return ground;
}

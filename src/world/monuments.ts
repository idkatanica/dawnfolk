import type { MonumentKind } from "../content/monuments.ts";

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

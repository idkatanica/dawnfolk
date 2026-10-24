import type { Animal } from "./fauna.ts";

export const CALM_FEAR = 0.1;

export function startleAnimal(animal: Animal, fromX: number, fromZ: number, strength: number): void {
  animal.fear = Math.max(animal.fear, strength);
  animal.fleeFromX = fromX;
  animal.fleeFromZ = fromZ;
}

import type { AnimalKind } from "../../../content/animals.ts";
import type { Mover } from "../../agents/movement.ts";
import type { Animal } from "../../fauna/fauna.ts";
import type { Person } from "../person.ts";

const PERSON_GIRTH = 0.3;
const ANIMAL_GIRTH: Readonly<Record<AnimalKind, number>> = {
  deer: 0.5,
  hare: 0.2,
  ibex: 0.4,
  mammoth: 2.2,
  wolf: 0.45,
};

export type Foe =
  | { readonly animal: Animal; readonly kind: "animal" }
  | { readonly kind: "person"; readonly person: Person };

export function personFoe(person: Person): Foe {
  return { kind: "person", person };
}

export function animalFoe(animal: Animal): Foe {
  return { animal, kind: "animal" };
}

export function foeMover(foe: Foe): Mover {
  if (foe.kind === "person") {
    return foe.person.mover;
  }

  return foe.animal.mover;
}

export function foeGirth(foe: Foe): number {
  if (foe.kind === "person") {
    return PERSON_GIRTH;
  }

  return ANIMAL_GIRTH[foe.animal.kind];
}

export function isFoeAlive(foe: Foe): boolean {
  if (foe.kind === "person") {
    return foe.person.isAlive;
  }

  return foe.animal.isAlive;
}

export function distanceTo(mover: Mover, foe: Foe): number {
  const other = foeMover(foe);

  return Math.hypot(other.x - mover.x, other.z - mover.z);
}

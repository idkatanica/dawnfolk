import { plantSpeciesDefinition } from "../../content/plants.ts";
import { ignore } from "../../shared/ignore.ts";
import { hasRoomFromCoast } from "../../world/coast.ts";
import { placeMover } from "../agents/movement.ts";
import type { Waypoint } from "../agents/navigation.ts";
import type { SocietyContext } from "../society/society-context.ts";
import { type GrabbableKind, isGrabbablePlant } from "./grab-target.ts";

interface GrabHandler {
  readonly canPlace: (context: SocietyContext, id: number, x: number, z: number) => boolean;
  readonly carry: (context: SocietyContext, id: number, x: number, z: number) => void;
  readonly lift: (context: SocietyContext, id: number) => Waypoint | null;
  readonly place: (context: SocietyContext, id: number, x: number, z: number) => void;
}

type GrabHandlers = { readonly [Kind in GrabbableKind]: GrabHandler };

const personGrab: GrabHandler = {
  canPlace: canPersonStand,
  carry: (context, id, x, z) => {
    const person = context.people.findPerson(id);

    if (person === null) {
      return;
    }

    placeMover(person.mover, x, z);
  },
  lift: (context, id) => {
    const person = context.people.findPerson(id);

    if (person === null || !person.isAlive) {
      return null;
    }

    context.people.hold(person);

    return { x: person.mover.x, z: person.mover.z };
  },
  place: (context, id, x, z) => {
    const person = context.people.findPerson(id);

    if (person === null) {
      return;
    }

    context.people.setDown(person, x, z);
  },
};

const animalGrab: GrabHandler = {
  canPlace: (context, id, x, z) => {
    const animal = context.fauna.findAnimal(id);

    if (animal === null) {
      return false;
    }

    return context.fauna.canStand(animal.kind, x, z);
  },
  carry: (context, id, x, z) => {
    const animal = context.fauna.findAnimal(id);

    if (animal === null) {
      return;
    }

    placeMover(animal.mover, x, z);
  },
  lift: (context, id) => {
    const animal = context.fauna.findAnimal(id);

    if (animal === null || !animal.isAlive) {
      return null;
    }

    context.fauna.hold(animal);

    return { x: animal.mover.x, z: animal.mover.z };
  },
  place: (context, id, x, z) => {
    const animal = context.fauna.findAnimal(id);

    if (animal === null) {
      return;
    }

    context.fauna.setDown(animal, x, z);
  },
};

const plantGrab: GrabHandler = {
  canPlace: ({ world }, id, x, z) => {
    const cell = world.grid.cellAt(x, z);

    if (cell < 0 || world.vegetation.hasPlantsInCell(cell)) {
      return false;
    }

    const { steepestSlope } = plantSpeciesDefinition(world.vegetation.species[id]);

    return world.canPlace(cell, steepestSlope) && hasRoomFromCoast(world.terrain.coastDistance, world.grid, x, z);
  },
  carry: ignore,
  lift: ({ world }, id) => {
    const { vegetation } = world;

    if (id >= vegetation.count || !vegetation.isAlive(id) || !isGrabbablePlant(vegetation.species[id])) {
      return null;
    }

    world.liftPlant(id);

    return { x: vegetation.x[id], z: vegetation.z[id] };
  },
  place: ({ world }, id, x, z) => {
    world.setPlantDown(id, x, z);
  },
};

export const GRAB_HANDLERS: GrabHandlers = {
  animal: animalGrab,
  person: personGrab,
  plant: plantGrab,
};

function canPersonStand(context: SocietyContext, _id: number, x: number, z: number): boolean {
  return context.world.isWalkableAt(x, z);
}

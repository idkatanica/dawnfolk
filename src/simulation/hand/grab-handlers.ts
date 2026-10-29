import { plantSpeciesDefinition } from "../../content/plants.ts";
import { ignore } from "../../shared/ignore.ts";
import { hasRoomFromCoast } from "../../world/coast.ts";
import { type Mover, placeMover } from "../agents/movement.ts";
import type { Waypoint } from "../agents/navigation.ts";
import { nearestSpotWhere } from "../agents/walkable-ground.ts";
import type { Animal } from "../fauna/fauna.ts";
import type { Person } from "../society/person.ts";
import type { SocietyContext } from "../society/society-context.ts";
import { type GrabbableKind, isGrabbablePlant } from "./grab-target.ts";

const PUT_BACK_RADIUS = 60;

interface GrabHandler {
  readonly canPlace: (context: SocietyContext, id: number, x: number, z: number) => boolean;
  readonly carry: (context: SocietyContext, id: number, x: number, z: number) => void;
  readonly lift: (context: SocietyContext, id: number) => Waypoint | null;
  readonly place: (context: SocietyContext, id: number, x: number, z: number) => void;
  readonly putBack: (context: SocietyContext, id: number, origin: Waypoint) => void;
}

type GrabHandlers = { readonly [Kind in GrabbableKind]: GrabHandler };

interface HeldAgent {
  readonly isAlive: boolean;
  readonly mover: Mover;
}

interface AgentKeeper<Agent extends HeldAgent> {
  readonly canStand: (context: SocietyContext, agent: Agent, x: number, z: number) => boolean;
  readonly find: (context: SocietyContext, id: number) => Agent | null;
  readonly hold: (context: SocietyContext, agent: Agent) => void;
  readonly setDown: (context: SocietyContext, agent: Agent, x: number, z: number) => void;
}

function agentGrab<Agent extends HeldAgent>(keeper: AgentKeeper<Agent>): GrabHandler {
  function standingSpot(context: SocietyContext, agent: Agent, origin: Waypoint): Waypoint {
    if (keeper.canStand(context, agent, origin.x, origin.z)) {
      return origin;
    }

    const spot = nearestSpotWhere(context.world, origin, PUT_BACK_RADIUS, ({ grid }, cell) =>
      keeper.canStand(context, agent, grid.cellCenterX(cell), grid.cellCenterZ(cell))
    );

    return spot === null ? origin : spot;
  }

  return {
    canPlace: (context, id, x, z) => {
      const agent = keeper.find(context, id);

      return agent !== null && keeper.canStand(context, agent, x, z);
    },
    carry: (context, id, x, z) => {
      const agent = keeper.find(context, id);

      if (agent === null) {
        return;
      }

      placeMover(agent.mover, x, z);
    },
    lift: (context, id) => {
      const agent = keeper.find(context, id);

      if (agent === null || !agent.isAlive) {
        return null;
      }

      keeper.hold(context, agent);

      return { x: agent.mover.x, z: agent.mover.z };
    },
    place: (context, id, x, z) => {
      const agent = keeper.find(context, id);

      if (agent === null) {
        return;
      }

      keeper.setDown(context, agent, x, z);
    },
    putBack: (context, id, origin) => {
      const agent = keeper.find(context, id);

      if (agent === null) {
        return;
      }

      const spot = standingSpot(context, agent, origin);

      keeper.setDown(context, agent, spot.x, spot.z);
    },
  };
}

const personGrab = agentGrab<Person>({
  canStand: ({ world }, _person, x, z) => world.isWalkableAt(x, z),
  find: ({ people }, id) => people.findPerson(id),
  hold: ({ people }, person) => people.hold(person),
  setDown: ({ people }, person, x, z) => people.setDown(person, x, z),
});

const animalGrab = agentGrab<Animal>({
  canStand: ({ fauna }, animal, x, z) => fauna.canStand(animal.kind, x, z),
  find: ({ fauna }, id) => fauna.findAnimal(id),
  hold: ({ fauna }, animal) => fauna.hold(animal),
  setDown: ({ fauna }, animal, x, z) => fauna.setDown(animal, x, z),
});

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
  lift: ({ people, world }, id) => {
    const { vegetation } = world;

    if (id >= vegetation.count || !vegetation.isAlive(id) || !isGrabbablePlant(vegetation.species[id])) {
      return null;
    }

    people.releasePlant(id);
    world.liftPlant(id);

    return { x: vegetation.x[id], z: vegetation.z[id] };
  },
  place: ({ world }, id, x, z) => {
    world.setPlantDown(id, x, z);
  },
  putBack: ({ world }, id, origin) => {
    const cell = world.grid.cellAt(origin.x, origin.z);

    const { steepestSlope } = plantSpeciesDefinition(world.vegetation.species[id]);

    if (cell < 0 || !world.canPlace(cell, steepestSlope)) {
      world.removePlant(id);

      return;
    }

    world.setPlantDown(id, origin.x, origin.z);
  },
};

export const GRAB_HANDLERS: GrabHandlers = {
  animal: animalGrab,
  person: personGrab,
  plant: plantGrab,
};

import { plantSpeciesDefinition } from "../../../content/plants.ts";
import type { Waypoint } from "../../agents/navigation.ts";
import { nearestPlant, nearestQuarry } from "../resources.ts";
import type { PersonTick } from "../society-context.ts";
import { learn, markScarce } from "../tribe.ts";
import { DeliverJob } from "./deliver-job.ts";
import { Errand, headTo, type Job } from "./job.ts";

const QUARRYING_SECONDS = 9;
const STONE_PER_TRIP = 3;
const BOULDER_SEARCH_RADIUS = 420;
const CLIFF_SEARCH_RADIUS = 520;
const TRIPS_PER_BOULDER = 3;

export function findStone(tick: PersonTick): Job | null {
  const { person, tribe } = tick;
  const { world } = tick.context;

  const boulder = nearestPlant(world, {
    accepts: (plant) => {
      const isBoulder = plantSpeciesDefinition(world.vegetation.species[plant]).form === "stone";

      return isBoulder && world.vegetation.isAlive(plant) && !tribe.claimedPlants.has(plant);
    },
    radius: BOULDER_SEARCH_RADIUS,
    x: person.mover.x,
    z: person.mover.z,
  });

  if (boulder !== null) {
    return new BoulderJob(tick, boulder);
  }

  const cliff = nearestQuarry(world, tribe.campX, tribe.campZ, CLIFF_SEARCH_RADIUS);

  if (cliff === null) {
    markScarce(tribe, "stone", tick.context.environment.day);

    return null;
  }

  return new QuarryJob(tick, cliff);
}

function previousUses(quarryUses: ReadonlyMap<number, number>, boulder: number): number {
  const uses = quarryUses.get(boulder);

  if (uses === undefined) {
    return 0;
  }

  return uses;
}

export class BoulderJob implements Job {
  readonly claimedPlant: number;
  readonly kind = "quarry";
  readonly #errand = new Errand(QUARRYING_SECONDS, "dig");

  constructor(tick: PersonTick, boulder: number) {
    const { vegetation } = tick.context.world;

    this.claimedPlant = boulder;
    tick.tribe.claimedPlants.add(boulder);
    headTo(tick.person, { x: vegetation.x[boulder] + 2.5, z: vegetation.z[boulder] + 2.5 }, tick.context);
  }

  update(tick: PersonTick): Job | null {
    if (this.#errand.update(tick) !== "finished") {
      return this;
    }

    const { people, world } = tick.context;
    const boulder = this.claimedPlant;

    const uses = previousUses(people.quarryUses, boulder) + 1;

    tick.tribe.claimedPlants.delete(boulder);
    tick.person.carrying.stone += STONE_PER_TRIP;
    people.quarryUses.set(boulder, uses);
    learn(tick.tribe, 0.4, tick.context.rules);

    if (uses >= TRIPS_PER_BOULDER && world.vegetation.isAlive(boulder)) {
      people.quarryUses.delete(boulder);
      world.removePlant(boulder);
    }

    return new DeliverJob(tick);
  }
}

export class QuarryJob implements Job {
  readonly kind = "quarry";
  readonly #errand = new Errand(QUARRYING_SECONDS, "dig");

  constructor(tick: PersonTick, cliff: Waypoint) {
    headTo(tick.person, { x: cliff.x + 2.5, z: cliff.z + 2.5 }, tick.context);
  }

  update(tick: PersonTick): Job | null {
    if (this.#errand.update(tick) !== "finished") {
      return this;
    }

    tick.person.carrying.stone += STONE_PER_TRIP;
    learn(tick.tribe, 0.4, tick.context.rules);

    return new DeliverJob(tick);
  }
}

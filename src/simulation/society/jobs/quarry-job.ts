import { isRockSpecies } from "../../../content/plants.ts";
import type { Waypoint } from "../../agents/navigation.ts";
import { pickUp } from "../person.ts";
import { nearestPlant, nearestQuarry } from "../resources.ts";
import type { PersonTick } from "../society-context.ts";
import { workSeconds } from "../tools.ts";
import { learn, markScarce } from "../tribe.ts";
import { DeliverJob } from "./deliver-job.ts";
import { canWorkAt, Errand, headToWork, type Job, plantTarget, type WorkTarget } from "./job.ts";

const QUARRYING_SECONDS = 9;
const STONE_PER_TRIP = 5;
const BOULDER_SEARCH_RADIUS = 420;
const CLIFF_SEARCH_RADIUS = 520;
const TRIPS_PER_BOULDER = 3;
const PICK_REACH = 0.6;
const CLIFF_FACE_RADIUS = 0.5;

export function findStone(tick: PersonTick): Job | null {
  const { person, tribe } = tick;
  const { navigation, world } = tick.context;

  const boulder = nearestPlant(world, {
    accepts: (plant) => {
      const isBoulder = isRockSpecies(world.vegetation.species[plant]);
      const target = plantTarget(world.vegetation, plant, PICK_REACH);

      return (
        isBoulder &&
        world.vegetation.isAlive(plant) &&
        !tribe.claimedPlants.has(plant) &&
        canWorkAt(world, target, person.mover) &&
        navigation.isWithinWalk(person.mover, target)
      );
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

class BoulderJob implements Job {
  readonly claimedPlant: number;
  readonly kind = "quarry";
  readonly #errand: Errand;

  constructor(tick: PersonTick, boulder: number) {
    const target = plantTarget(tick.context.world.vegetation, boulder, PICK_REACH);

    this.claimedPlant = boulder;
    this.#errand = new Errand(workSeconds(tick.tribe, QUARRYING_SECONDS), "mine", target);
    tick.tribe.claimedPlants.add(boulder);
    headToWork(tick.person, target, tick.context);
  }

  update(tick: PersonTick): Job | null {
    const progress = this.#errand.update(tick);

    if (progress !== "finished") {
      return progress === "abandoned" ? null : this;
    }

    const { world } = tick.context;

    const boulder = this.claimedPlant;
    const wear = world.vegetation.wearDown(boulder);

    pickUp(tick.person, "stone", STONE_PER_TRIP, "stone");
    learn(tick.tribe, 0.4, tick.context.rules);

    if (wear >= TRIPS_PER_BOULDER) {
      world.removePlant(boulder);
    }

    return new DeliverJob(tick);
  }
}

class QuarryJob implements Job {
  readonly kind = "quarry";
  readonly #errand: Errand;

  constructor(tick: PersonTick, cliff: Waypoint) {
    const target: WorkTarget = { radius: CLIFF_FACE_RADIUS, reach: PICK_REACH, x: cliff.x, z: cliff.z };

    this.#errand = new Errand(workSeconds(tick.tribe, QUARRYING_SECONDS), "mine", target);
    headToWork(tick.person, target, tick.context);
  }

  update(tick: PersonTick): Job | null {
    const progress = this.#errand.update(tick);

    if (progress !== "finished") {
      return progress === "abandoned" ? null : this;
    }

    pickUp(tick.person, "stone", STONE_PER_TRIP, "stone");
    learn(tick.tribe, 0.4, tick.context.rules);

    return new DeliverJob(tick);
  }
}

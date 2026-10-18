import { isTreeSpecies, plantSpeciesDefinition } from "../../../content/plants.ts";
import { nearestPlant } from "../resources.ts";
import type { PersonTick } from "../society-context.ts";
import { learn, markScarce } from "../tribe.ts";
import { DeliverJob } from "./deliver-job.ts";
import { Errand, headToWork, type Job, plantTarget } from "./job.ts";

const CHOPPING_SECONDS = 7;
const AXE_REACH = 0.75;
const SEARCH_RADIUS = 320;

export function findTree(tick: PersonTick): ChopJob | null {
  const { person, tribe } = tick;
  const { vegetation } = tick.context.world;

  const tree = nearestPlant(tick.context.world, {
    accepts: (plant) =>
      vegetation.isAlive(plant) && isTreeSpecies(vegetation.species[plant]) && !tribe.claimedPlants.has(plant),
    radius: SEARCH_RADIUS,
    x: (tribe.campX + person.mover.x) / 2,
    z: (tribe.campZ + person.mover.z) / 2,
  });

  if (tree === null) {
    markScarce(tribe, "wood", tick.context.environment.day);

    return null;
  }

  return new ChopJob(tick, tree);
}

class ChopJob implements Job {
  readonly claimedPlant: number;
  readonly kind = "chop";
  readonly #errand: Errand;

  constructor(tick: PersonTick, tree: number) {
    const target = plantTarget(tick.context.world.vegetation, tree, AXE_REACH);

    this.claimedPlant = tree;
    this.#errand = new Errand(CHOPPING_SECONDS, "chop", target);
    tick.tribe.claimedPlants.add(tree);
    headToWork(tick.person, target, tick.context);
  }

  update(tick: PersonTick): Job | null {
    const { world } = tick.context;

    const tree = this.claimedPlant;

    if (!world.vegetation.isAlive(tree)) {
      tick.tribe.claimedPlants.delete(tree);

      return null;
    }

    if (this.#errand.update(tick) !== "finished") {
      return this;
    }

    tick.tribe.claimedPlants.delete(tree);
    tick.person.carrying.wood += plantSpeciesDefinition(world.vegetation.species[tree]).wood;
    world.removePlant(tree);
    learn(tick.tribe, 0.4, tick.context.rules);

    return new DeliverJob(tick);
  }
}

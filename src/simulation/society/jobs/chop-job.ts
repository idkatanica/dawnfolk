import { isTreeSpecies, plantSpeciesDefinition } from "../../../content/plants.ts";
import { pickUp } from "../person.ts";
import { isProtectedPlant } from "../plots.ts";
import { nearestPlant } from "../resources.ts";
import type { PersonTick } from "../society-context.ts";
import { workSeconds } from "../tools.ts";
import { learn, markScarce } from "../tribe.ts";
import { DeliverJob } from "./deliver-job.ts";
import { canWorkAt, Errand, headToWork, type Job, plantTarget } from "./job.ts";

const CHOPPING_SECONDS = 7;
const FELLING_YIELD = 2;
const AXE_REACH = 0.75;
const SEARCH_RADIUS = 320;

export function findTree(tick: PersonTick): ChopJob | null {
  const { person, tribe } = tick;
  const { navigation, world } = tick.context;
  const { vegetation } = world;
  const { day } = tick.context.environment;

  function isReachable(plant: number): boolean {
    const target = plantTarget(vegetation, plant, AXE_REACH);

    return canWorkAt(world, target, person.mover) && navigation.isWithinWalk(person.mover, target);
  }

  const tree = nearestPlant(world, {
    accepts: (plant) =>
      vegetation.isAlive(plant) &&
      isTreeSpecies(vegetation.species[plant]) &&
      !tribe.claimedPlants.has(plant) &&
      !isProtectedPlant(tribe, plant, vegetation.species[plant], day) &&
      isReachable(plant),
    radius: SEARCH_RADIUS,
    x: (tribe.campX + person.mover.x) / 2,
    z: (tribe.campZ + person.mover.z) / 2,
  });

  if (tree === null) {
    markScarce(tribe, "wood", day);

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
    this.#errand = new Errand(workSeconds(tick.tribe, CHOPPING_SECONDS), "chop", target);
    tick.tribe.claimedPlants.add(tree);
    headToWork(tick.person, target, tick.context);
  }

  update(tick: PersonTick): Job | null {
    const { world } = tick.context;

    const tree = this.claimedPlant;

    if (!world.vegetation.isAlive(tree)) {
      return null;
    }

    const progress = this.#errand.update(tick);

    if (progress !== "finished") {
      return progress === "abandoned" ? null : this;
    }

    pickUp(tick.person, "wood", plantSpeciesDefinition(world.vegetation.species[tree]).wood * FELLING_YIELD, "wood");
    world.removePlant(tree);
    learn(tick.tribe, 0.4, tick.context.rules);

    return new DeliverJob(tick);
  }
}

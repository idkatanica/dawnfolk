import { plantSpeciesDefinition } from "../../../content/plants.ts";
import { carriedFood, isChild, pickUp } from "../person.ts";
import { ripestFruitTree } from "../plots.ts";
import { nearestPlant } from "../resources.ts";
import type { PersonTick } from "../society-context.ts";
import { learn, markScarce } from "../tribe.ts";
import { DeliverJob } from "./deliver-job.ts";
import { canWorkAt, Errand, headToWork, type Job, plantTarget } from "./job.ts";

const GATHERING_SECONDS = 4;
const GATHERING_REACH = 0.35;
const RIPE_BUSH = 0.25;
const PICKABLE_FRUIT = 0.1;
const HANDFUL = 0.5;
const FOOD_PER_FRUIT = 4;
const FULL_BASKET = 5;
const NEXT_BUSH_RADIUS = 70;
const CHILD_SEARCH_RADIUS = 160;
const ADULT_SEARCH_RADIUS = 380;

function isRipeBush(tick: PersonTick): (plant: number) => boolean {
  const { vegetation } = tick.context.world;
  const { claimedPlants } = tick.tribe;

  return (plant) => {
    if (!vegetation.isAlive(plant) || claimedPlants.has(plant)) {
      return false;
    }

    return plantSpeciesDefinition(vegetation.species[plant]).givesBerries && vegetation.fruit[plant] > RIPE_BUSH;
  };
}

interface SearchArea {
  radius: number;
  x: number;
  z: number;
}

function gatheringArea(tick: PersonTick): SearchArea {
  const { person, tribe } = tick;

  if (isChild(person)) {
    return { radius: CHILD_SEARCH_RADIUS, x: tribe.campX, z: tribe.campZ };
  }

  return { radius: ADULT_SEARCH_RADIUS, x: person.mover.x, z: person.mover.z };
}

function nearestReachableBush(tick: PersonTick, area: SearchArea): number | null {
  const { navigation, world } = tick.context;
  const { mover } = tick.person;

  const isRipe = isRipeBush(tick);

  return nearestPlant(world, {
    ...area,
    accepts: (plant) => {
      const target = plantTarget(world.vegetation, plant, GATHERING_REACH);

      return isRipe(plant) && canWorkAt(world, target, mover) && navigation.isWithinWalk(mover, target);
    },
  });
}

export function findBerries(tick: PersonTick): ForageJob | null {
  const bush = nearestReachableBush(tick, gatheringArea(tick));

  if (bush === null) {
    markScarce(tick.tribe, "berries", tick.context.environment.day);

    return null;
  }

  return new ForageJob(tick, bush, "gather");
}

export function findFruit(tick: PersonTick): ForageJob | null {
  const tree = ripestFruitTree(tick.tribe, tick.context.world, tick.tribe.claimedPlants);

  if (tree === null) {
    return null;
  }

  const { navigation, world } = tick.context;

  const target = plantTarget(world.vegetation, tree, GATHERING_REACH);

  if (!(canWorkAt(world, target, tick.person.mover) && navigation.isWithinWalk(tick.person.mover, target))) {
    return null;
  }

  return new ForageJob(tick, tree, "pick");
}

class ForageJob implements Job {
  readonly claimedPlant: number;
  readonly kind: "gather" | "pick";
  readonly #errand: Errand;

  constructor(tick: PersonTick, plant: number, kind: "gather" | "pick") {
    const target = plantTarget(tick.context.world.vegetation, plant, GATHERING_REACH);

    this.claimedPlant = plant;
    this.kind = kind;
    this.#errand = new Errand(GATHERING_SECONDS, "gather", target);
    tick.tribe.claimedPlants.add(plant);
    headToWork(tick.person, target, tick.context);
  }

  update(tick: PersonTick): Job | null {
    const progress = this.#errand.update(tick);

    if (progress !== "finished") {
      return progress === "abandoned" ? null : this;
    }

    const { vegetation } = tick.context.world;

    const plant = this.claimedPlant;

    tick.tribe.claimedPlants.delete(plant);

    if (vegetation.isAlive(plant) && vegetation.fruit[plant] > PICKABLE_FRUIT) {
      const taken = Math.min(HANDFUL, vegetation.fruit[plant]);
      const food = this.kind === "gather" ? "berries" : "fruit";

      vegetation.setFruit(plant, vegetation.fruit[plant] - taken);
      pickUp(tick.person, food, taken * FOOD_PER_FRUIT, food);
      learn(tick.tribe, 0.25, tick.context.rules);
    }

    if (carriedFood(tick.person) >= FULL_BASKET) {
      return new DeliverJob(tick);
    }

    const next = this.#next(tick);

    return next === null ? new DeliverJob(tick) : next;
  }

  #next(tick: PersonTick): ForageJob | null {
    if (this.kind === "pick") {
      return findFruit(tick);
    }

    const { mover } = tick.person;

    const bush = nearestReachableBush(tick, { radius: NEXT_BUSH_RADIUS, x: mover.x, z: mover.z });

    return bush === null ? null : new ForageJob(tick, bush, "gather");
  }
}

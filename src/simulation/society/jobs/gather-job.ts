import { plantSpeciesDefinition } from "../../../content/plants.ts";
import { isChild, pickUpFood } from "../person.ts";
import { nearestPlant } from "../resources.ts";
import type { PersonTick } from "../society-context.ts";
import { learn, markScarce } from "../tribe.ts";
import { DeliverJob } from "./deliver-job.ts";
import { Errand, headTo, type Job } from "./job.ts";

const GATHERING_SECONDS = 4;
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

export function findBerries(tick: PersonTick): GatherJob | null {
  const bush = nearestPlant(tick.context.world, { ...gatheringArea(tick), accepts: isRipeBush(tick) });

  if (bush === null) {
    markScarce(tick.tribe, "berries", tick.context.environment.day);

    return null;
  }

  return new GatherJob(tick, bush);
}

class GatherJob implements Job {
  readonly claimedPlant: number;
  readonly kind = "gather";
  readonly #errand = new Errand(GATHERING_SECONDS, "gather");

  constructor(tick: PersonTick, bush: number) {
    const { vegetation } = tick.context.world;

    this.claimedPlant = bush;
    tick.tribe.claimedPlants.add(bush);
    headTo(tick.person, { x: vegetation.x[bush] + 1.2, z: vegetation.z[bush] + 1.2 }, tick.context);
  }

  update(tick: PersonTick): Job | null {
    if (this.#errand.update(tick) !== "finished") {
      return this;
    }

    tick.tribe.claimedPlants.delete(this.claimedPlant);
    this.#pick(tick);

    return nextStep(tick);
  }

  #pick(tick: PersonTick): void {
    const { vegetation } = tick.context.world;
    const bush = this.claimedPlant;

    if (!vegetation.isAlive(bush) || vegetation.fruit[bush] <= PICKABLE_FRUIT) {
      return;
    }

    const taken = Math.min(HANDFUL, vegetation.fruit[bush]);

    vegetation.setFruit(bush, vegetation.fruit[bush] - taken);
    pickUpFood(tick.person, taken * FOOD_PER_FRUIT, "berries");
    learn(tick.tribe, 0.25, tick.context.rules);
  }
}

function nextStep(tick: PersonTick): Job {
  if (tick.person.carrying.food >= FULL_BASKET) {
    return new DeliverJob(tick);
  }

  const { mover } = tick.person;

  const nextBush = nearestPlant(tick.context.world, {
    accepts: isRipeBush(tick),
    radius: NEXT_BUSH_RADIUS,
    x: mover.x,
    z: mover.z,
  });

  if (nextBush === null) {
    return new DeliverJob(tick);
  }

  return new GatherJob(tick, nextBush);
}

import { faceTowards } from "../../agents/movement.ts";
import { pickUpFood } from "../person.ts";
import { nearestShore, type ShoreSpot } from "../resources.ts";
import type { PersonTick } from "../society-context.ts";
import { learn, markScarce } from "../tribe.ts";
import { campPoint } from "../tribe-places.ts";
import { DeliverJob } from "./deliver-job.ts";
import { Errand, headTo, type Job } from "./job.ts";

const FISHING_SECONDS = 11;
const CATCH_CHANCE = 0.7;
const FISH_PER_CATCH = 3;
const SEARCH_RADIUS = 320;

export function findFishingSpot(tick: PersonTick): FishJob | null {
  const { tribe } = tick;

  const spot = nearestShore(tick.context.world, campPoint(tribe), SEARCH_RADIUS, tick.context.random);

  if (spot === null) {
    markScarce(tribe, "fish", tick.context.environment.day);

    return null;
  }

  return new FishJob(tick, spot);
}

class FishJob implements Job {
  readonly kind = "fish";
  readonly #errand = new Errand(FISHING_SECONDS, "fish");
  readonly #spot: ShoreSpot;

  constructor(tick: PersonTick, spot: ShoreSpot) {
    this.#spot = spot;
    headTo(tick.person, spot, tick.context);
  }

  update(tick: PersonTick): Job | null {
    const progress = this.#errand.update(tick);

    if (progress !== "travelling") {
      faceTowards(tick.person.mover, this.#spot.waterX, this.#spot.waterZ);
    }

    if (progress !== "finished") {
      return this;
    }

    if (tick.context.random.chance(CATCH_CHANCE)) {
      pickUpFood(tick.person, FISH_PER_CATCH, "fish");
    }

    learn(tick.tribe, 0.5, tick.context.rules);

    if (tick.person.carrying.food >= FISH_PER_CATCH) {
      return new DeliverJob(tick);
    }

    this.#errand.restartWork();

    return this;
  }
}

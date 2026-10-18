import { FULL_TURN } from "../../../shared/math.ts";
import type { Building } from "../buildings.ts";
import type { PersonTick } from "../society-context.ts";
import { aroundPoint, Errand, headTo, type Job } from "./job.ts";

const WARMING_SECONDS = 18;
const WARM_ENOUGH = 0.95;
const FIRESIDE_DISTANCE = 5;

export class WarmJob implements Job {
  readonly kind = "warm";
  readonly #errand = new Errand(WARMING_SECONDS, "sit");

  constructor(tick: PersonTick, campfire: Building) {
    const seat = aroundPoint(campfire, FIRESIDE_DISTANCE, tick.context.random.next() * FULL_TURN);

    headTo(tick.person, seat, tick.context);
  }

  update(tick: PersonTick): Job | null {
    const progress = this.#errand.update(tick);

    if (progress === "finished" || tick.person.warmth > WARM_ENOUGH) {
      return null;
    }

    return this;
  }
}

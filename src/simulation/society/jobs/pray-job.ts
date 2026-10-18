import type { Building } from "../buildings.ts";
import type { PersonTick } from "../society-context.ts";
import { Errand, headTo, type Job } from "./job.ts";

const PRAYER_SECONDS = 10;
const FAITH_PER_PRAYER = 0.6;
const MAXIMUM_FAITH = 100;

export class PrayJob implements Job {
  readonly kind = "pray";
  readonly #errand: Errand;

  constructor(tick: PersonTick, totem: Building) {
    const { random } = tick.context;

    this.#errand = new Errand(PRAYER_SECONDS, "pray", totem);
    headTo(tick.person, { x: totem.x + random.signed() * 4, z: totem.z + 5 }, tick.context);
  }

  update(tick: PersonTick): Job | null {
    if (this.#errand.update(tick) !== "finished") {
      return this;
    }

    tick.tribe.faith = Math.min(MAXIMUM_FAITH, tick.tribe.faith + FAITH_PER_PRAYER);

    return null;
  }
}

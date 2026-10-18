import { walkSpeed } from "../person.ts";
import type { PersonTick } from "../society-context.ts";
import { nearCamp } from "../tribe-places.ts";
import { headTo, type Job, walk } from "./job.ts";

const ARRIVAL_SPREAD = 15;

export class MigrateJob implements Job {
  readonly kind = "migrate";

  constructor(tick: PersonTick) {
    headTo(tick.person, nearCamp(tick.tribe, ARRIVAL_SPREAD, tick.context.random), tick.context);
  }

  update(tick: PersonTick): Job | null {
    if (walk(tick, walkSpeed(tick.person))) {
      return null;
    }

    return this;
  }
}

import { walkSpeed } from "../person.ts";
import type { PersonTick } from "../society-context.ts";
import { nearCamp } from "../tribe-places.ts";
import { headTo, type Job, walk } from "./job.ts";

const ARRIVAL_SPREAD = 15;
const ARRIVED_DISTANCE = 60;

export class HomewardJob implements Job {
  readonly kind = "migrate";

  constructor(tick: PersonTick) {
    headTo(tick.person, nearCamp(tick.tribe, ARRIVAL_SPREAD, tick.context.random), tick.context);
  }

  update(tick: PersonTick): Job | null {
    const { person, tribe } = tick;

    if (!walk(tick, walkSpeed(person))) {
      return this;
    }

    if (Math.hypot(person.mover.x - tribe.campX, person.mover.z - tribe.campZ) > ARRIVED_DISTANCE) {
      person.strandedDay = tick.context.environment.day;
    }

    return null;
  }
}

import { walkSpeed } from "../person.ts";
import type { PersonTick } from "../society-context.ts";
import { sleepingSpot } from "../tribe-places.ts";
import { headTo, type Job, standStill, walk } from "./job.ts";

const WAKING_HOUR = 12;

type SleepPhase = "asleep" | "travel";

export class SleepJob implements Job {
  readonly kind = "sleep";
  #phase: SleepPhase = "travel";

  constructor(tick: PersonTick) {
    const { buildings, random } = tick.context;

    headTo(tick.person, sleepingSpot(tick.person, tick.tribe, buildings, random), tick.context);
  }

  update(tick: PersonTick): Job | null {
    if (this.#phase === "travel") {
      this.#travel(tick);

      return this;
    }

    const { environment } = tick.context;

    standStill(tick.person, "sleep");

    if (environment.isNight || environment.hours >= WAKING_HOUR) {
      return this;
    }

    return null;
  }

  #travel(tick: PersonTick): void {
    if (walk(tick, walkSpeed(tick.person))) {
      this.#phase = "asleep";
    }
  }
}

import type { Building } from "../buildings.ts";
import type { PersonTick } from "../society-context.ts";
import { Errand, headTo, type Job } from "./job.ts";

const TENDING_SECONDS = 2.5;
const LOG = 1;
const FUEL_PER_LOG = 0.45;

export class TendJob implements Job {
  readonly kind = "tend";
  readonly #campfireId: number;
  readonly #errand = new Errand(TENDING_SECONDS, "build");

  constructor(tick: PersonTick, campfire: Building) {
    this.#campfireId = campfire.id;
    tick.tribe.stock.wood -= LOG;
    tick.person.carrying.wood += LOG;
    headTo(tick.person, { x: campfire.x + 2.5, z: campfire.z + 2 }, tick.context);
  }

  update(tick: PersonTick): Job | null {
    const campfire = tick.context.buildings.find(this.#campfireId);

    if (campfire === null) {
      tick.tribe.stock.wood += LOG;
      tick.person.carrying.wood = Math.max(0, tick.person.carrying.wood - LOG);

      return null;
    }

    if (this.#errand.update(tick) !== "finished") {
      return this;
    }

    campfire.fuel = Math.min(1, campfire.fuel + FUEL_PER_LOG);
    tick.person.carrying.wood = Math.max(0, tick.person.carrying.wood - LOG);

    return null;
  }
}

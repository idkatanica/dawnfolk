import type { Building } from "../buildings.ts";
import { pickUp, putDown } from "../person.ts";
import type { PersonTick } from "../society-context.ts";
import { Errand, headToWork, type Job, type WorkTarget } from "./job.ts";

const TENDING_SECONDS = 2.5;
const LOG = 1;
const FUEL_PER_LOG = 0.45;
const CAMPFIRE_RADIUS = 0.8;
const TENDING_REACH = 0.5;

export class TendJob implements Job {
  readonly kind = "tend";
  readonly #campfireId: number;
  readonly #errand: Errand;

  constructor(tick: PersonTick, campfire: Building) {
    const target: WorkTarget = { radius: CAMPFIRE_RADIUS, reach: TENDING_REACH, x: campfire.x, z: campfire.z };

    this.#campfireId = campfire.id;
    this.#errand = new Errand(TENDING_SECONDS, "build", target);
    tick.tribe.stock.wood -= LOG;
    pickUp(tick.person, "wood", LOG, "wood");
    headToWork(tick.person, target, tick.context);
  }

  update(tick: PersonTick): Job | null {
    const campfire = tick.context.buildings.find(this.#campfireId);

    if (campfire === null) {
      tick.tribe.stock.wood += LOG;
      putDown(tick.person, LOG);

      return null;
    }

    if (this.#errand.update(tick) !== "finished") {
      return this;
    }

    campfire.fuel = Math.min(1, campfire.fuel + FUEL_PER_LOG);
    putDown(tick.person, LOG);

    return null;
  }
}

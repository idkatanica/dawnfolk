import { pickUpFood } from "../person.ts";
import type { PersonTick } from "../society-context.ts";
import { type Field, learn } from "../tribe.ts";
import { DeliverJob } from "./deliver-job.ts";
import { Errand, headTo, type Job } from "./job.ts";

const FARMING_SECONDS = 9;
const HARVEST_FOOD = 14;
const TENDING_PER_VISIT = 0.5;
const HARVEST_SEASON_START = 1.6;
const HARVEST_SEASON_END = 3;

export function isHarvestTime(field: Field, season: number): boolean {
  return field.growth >= 1 && season >= HARVEST_SEASON_START && season < HARVEST_SEASON_END;
}

export class FarmJob implements Job {
  readonly kind = "farm";
  readonly #errand = new Errand(FARMING_SECONDS, "dig");
  readonly #field: Field;

  constructor(tick: PersonTick, field: Field) {
    const { grid } = tick.context.world;

    this.#field = field;
    headTo(tick.person, { x: grid.cellCenterX(field.cell), z: grid.cellCenterZ(field.cell) }, tick.context);
  }

  update(tick: PersonTick): Job | null {
    if (this.#errand.update(tick) !== "finished") {
      return this;
    }

    const field = this.#field;

    if (!tick.tribe.fields.includes(field)) {
      return null;
    }

    learn(tick.tribe, 0.4, tick.context.rules);

    if (!isHarvestTime(field, tick.context.environment.season)) {
      field.tending = Math.min(1, field.tending + TENDING_PER_VISIT);

      return null;
    }

    field.growth = 0;
    tick.context.world.setCrop(field.cell, 0);
    pickUpFood(tick.person, HARVEST_FOOD, "crops");
    tick.context.chronicle.record({
      category: "food",
      text: `${tick.tribe.name} brought in the harvest`,
      tribeId: tick.tribe.id,
      x: tick.person.mover.x,
      z: tick.person.mover.z,
    });

    return new DeliverJob(tick);
  }
}

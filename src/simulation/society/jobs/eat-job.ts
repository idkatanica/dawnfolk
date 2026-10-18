import type { Waypoint } from "../../agents/navigation.ts";
import type { Person } from "../person.ts";
import type { PersonTick } from "../society-context.ts";
import type { Tribe } from "../tribe.ts";
import { hasLitCampfire } from "../tribe-places.ts";
import { Errand, headTo, type Job } from "./job.ts";

const MEAL_SECONDS = 2.5;
const MEAL_HUNGER_RELIEF = 0.55;
const COOKED_MEAL_BONUS = 0.2;

export class EatJob implements Job {
  readonly kind = "eat";
  readonly #errand = new Errand(MEAL_SECONDS, "eat");

  constructor(tick: PersonTick, place: Waypoint) {
    headTo(tick.person, place, tick.context);
  }

  update(tick: PersonTick): Job | null {
    if (this.#errand.update(tick) !== "finished") {
      return this;
    }

    const isCooked = hasLitCampfire(tick.tribe, tick.context.buildings);

    eatMeal(tick.person, tick.tribe, isCooked);

    return null;
  }
}

function eatMeal(person: Person, tribe: Tribe, isCooked: boolean): void {
  if (!takeFoodPortion(person, tribe)) {
    return;
  }

  const relief = MEAL_HUNGER_RELIEF + (isCooked ? COOKED_MEAL_BONUS : 0);

  person.hunger = Math.max(0, person.hunger - relief);
}

function takeFoodPortion(person: Person, tribe: Tribe): boolean {
  if (person.carrying.food >= 1) {
    person.carrying.food -= 1;

    return true;
  }

  if (tribe.stock.food < 1) {
    return false;
  }

  tribe.stock.food -= 1;

  return true;
}

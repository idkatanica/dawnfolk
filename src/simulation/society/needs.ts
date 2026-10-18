import { clamp } from "../../shared/math.ts";
import { type DeathCause, isChild, NEED_SECONDS, type Person, YEARS_PER_DAY } from "./person.ts";
import type { PersonTick } from "./society-context.ts";
import { completedBuilding, litCampfireOf } from "./tribe-places.ts";

const CHILD_HUNGER_RATE = 0.75;
const ADULT_HUNGER_RATE = 0.95;
const SLEEP_RECOVERY_PER_DAY = 2.8;
const TIREDNESS_PER_DAY = 1;
const COMFORTABLE_TEMPERATURE = 9;
const WET_COLD_FACTOR = 1.4;
const WET_WEATHER = 0.3;
const CHILL_RATE = 0.11;
const FIRESIDE_WARMING = 3;
const NATURAL_WARMING = 1;
const FIRESIDE_RADIUS = 15;
const SHELTER_RADIUS = 6;
const STARVING = 0.95;
const STARVATION_DAMAGE = 0.9;
const FREEZING = 0.06;
const FREEZING_DAMAGE_PER_DAY = 0.8;
const WELL_FED = 0.7;
const WARM_ENOUGH = 0.3;
const HEALING_PER_DAY = 0.5;
const BURNING_GROUND = 0.2;
const BURN_DAMAGE_PER_SECOND = 0.12;
const DEFAULT_TEMPERATURE = 10;

export function updateNeeds(tick: PersonTick, days: number): DeathCause | null {
  const { person } = tick;

  const needSeconds = tick.context.environment.isTimeFrozen ? 0 : tick.seconds;

  const isAsleep = person.pose === "sleep";
  const hungerRate = isChild(person) ? CHILD_HUNGER_RATE : ADULT_HUNGER_RATE;

  const hungerGain = (needSeconds / NEED_SECONDS) * hungerRate * tick.context.rules.life.hungerRate;
  const energyChange = days * (isAsleep ? SLEEP_RECOVERY_PER_DAY : -TIREDNESS_PER_DAY);

  person.hunger = Math.min(1, person.hunger + hungerGain);
  person.energy = clamp(person.energy + energyChange, 0, 1);
  updateWarmth(tick, days, isAsleep);
  updateHealth(person, needSeconds, days);
  sufferFlames(tick);
  person.age += days * YEARS_PER_DAY;

  return causeOfDeath(person);
}

function updateWarmth(tick: PersonTick, days: number, isAsleep: boolean): void {
  const { person } = tick;

  const isComforted = isNearCampfire(tick) || isSleepingAtHome(tick, isAsleep);
  const coldness = coldnessAt(tick);

  if (coldness > 0 && !isComforted) {
    person.warmth = Math.max(0, person.warmth - days * coldness * CHILL_RATE);

    return;
  }

  person.warmth = Math.min(1, person.warmth + days * (isComforted ? FIRESIDE_WARMING : NATURAL_WARMING));
}

function coldnessAt(tick: PersonTick): number {
  const { environment } = tick.context;

  const temperature = temperatureAround(tick);

  const wetness = environment.precipitation > WET_WEATHER ? WET_COLD_FACTOR : 1;

  return Math.max(0, COMFORTABLE_TEMPERATURE - temperature) * wetness;
}

function temperatureAround(tick: PersonTick): number {
  const { environment, world } = tick.context;

  const cell = world.grid.cellAt(tick.person.mover.x, tick.person.mover.z);

  if (cell < 0) {
    return DEFAULT_TEMPERATURE;
  }

  return world.temperature(cell, environment.airTemperatureOffset);
}

function isNearCampfire(tick: PersonTick): boolean {
  const campfire = litCampfireOf(tick.tribe, tick.context.buildings);

  if (campfire === null) {
    return false;
  }

  return Math.hypot(tick.person.mover.x - campfire.x, tick.person.mover.z - campfire.z) < FIRESIDE_RADIUS;
}

function isSleepingAtHome(tick: PersonTick, isAsleep: boolean): boolean {
  const home = completedBuilding(tick.context.buildings, tick.person.homeId);

  if (!isAsleep || home === null) {
    return false;
  }

  return Math.hypot(tick.person.mover.x - home.x, tick.person.mover.z - home.z) < SHELTER_RADIUS;
}

function updateHealth(person: Person, needSeconds: number, days: number): void {
  if (person.hunger > STARVING) {
    person.health -= (needSeconds / NEED_SECONDS) * STARVATION_DAMAGE;
  }

  if (person.warmth < FREEZING) {
    person.health -= days * FREEZING_DAMAGE_PER_DAY;
  }

  if (person.hunger < WELL_FED && person.warmth > WARM_ENOUGH) {
    person.health = Math.min(1, person.health + days * HEALING_PER_DAY);
  }
}

function sufferFlames(tick: PersonTick): void {
  const { person } = tick;
  const { world } = tick.context;

  const cell = world.grid.cellAt(person.mover.x, person.mover.z);

  if (cell < 0 || world.fields.fire[cell] <= BURNING_GROUND) {
    return;
  }

  person.health -= tick.seconds * BURN_DAMAGE_PER_SECOND * (0.5 + world.fields.fire[cell]);
}

export function isStandingInFire(tick: PersonTick): boolean {
  const { world } = tick.context;

  const cell = world.grid.cellAt(tick.person.mover.x, tick.person.mover.z);

  if (cell < 0) {
    return false;
  }

  return world.fields.fire[cell] > BURNING_GROUND;
}

function causeOfDeath(person: Person): DeathCause | null {
  if (person.health <= 0) {
    return weakestNeed(person);
  }

  if (person.age > person.lifespan) {
    return "age";
  }

  return null;
}

function weakestNeed(person: Person): DeathCause {
  if (person.hunger > STARVING) {
    return "hunger";
  }

  if (person.warmth < FREEZING) {
    return "cold";
  }

  return "fire";
}

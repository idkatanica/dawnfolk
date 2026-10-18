import { personName } from "../../content/names.ts";
import { isGrowingSeason, isWinter } from "../../content/seasons.ts";
import type { TechnologyId } from "../../content/technologies.ts";
import { nearestWalkableSpot } from "../agents/walkable-ground.ts";
import { assignHomes, housingCapacity, planConstruction } from "./construction.ts";
import { createPerson, isChild, isElder, type Person } from "./person.ts";
import { considerMoving, considerSplit, type SettlementServices, updateMigration } from "./settlement.ts";
import type { SocietyContext } from "./society-context.ts";
import { knows, learn, type Tribe, upcomingTechnology } from "./tribe.ts";
import { completedBuilding } from "./tribe-places.ts";

const BASE_LEARNING_PER_DAY = 8;
const ADULT_LEARNING = 1.9;
const ELDER_LEARNING = 3;
const FAITH_LEARNING = 0.05;
const DISCOVERY_EFFORT = 0.15;
const STORED_SPOILAGE = 0.012;
const OPEN_SPOILAGE = 0.045;
const FIELD_GROWTH = 0.25;
const TENDED_GROWTH = 0.5;
const TENDING_DECAY = 0.5;
const PLANNING_SECONDS = 3;
const BIRTH_CHECK_DAYS = 0.25;
const DAILY_CHECK_DAYS = 0.5;
const CROP_DISPLAY_DAYS = 0.08;
const FAITH_BASELINE = 30;
const FAITH_DRIFT = 0.05;
const MOTHER_YOUNGEST = 15;
const MOTHER_OLDEST = 45;
const FATHER_YOUNGEST = 16;
const DAYS_BETWEEN_CHILDREN = 2;
const FOOD_PER_PERSON_FOR_BIRTHS = 2.5;
const MAXIMUM_MOTHERS_COUNTED = 4;
const BIRTHPLACE_SEARCH_RADIUS = 30;

interface TribeTick {
  context: SocietyContext;
  days: number;
  members: readonly Person[];
  seconds: number;
  services: SocietyServices;
  tribe: Tribe;
}

export interface SocietyServices extends SettlementServices {
  addPerson: (tribe: Tribe, person: Person) => void;
}

export function updateTribe(tick: TribeTick): void {
  learnAndDiscover(tick);
  spoilFood(tick);
  growFields(tick);
  planBuildings(tick);
  considerBirths(tick);
  driftFaith(tick);
  runDailyChecks(tick);
}

function learnAndDiscover(tick: TribeTick): void {
  const { context, members, tribe } = tick;

  const adults = members.filter((person) => !isChild(person)).length;
  const elders = members.filter((person) => isElder(person)).length;

  const learning =
    BASE_LEARNING_PER_DAY + adults * ADULT_LEARNING + elders * ELDER_LEARNING + tribe.faith * FAITH_LEARNING;

  learn(tribe, tick.days * learning, context.rules);
  discoverUpcoming(tribe, context);

  if (!knows(tribe, "fire") && context.hazards.isFireAround(tribe.campX, tribe.campZ)) {
    discover(tribe, "fire", `${tribe.name} saw a wildfire and kept the flame`, context);
  }
}

function discoverUpcoming(tribe: Tribe, context: SocietyContext): void {
  const upcoming = upcomingTechnology(tribe);

  if (upcoming === undefined || tribe.knowledge < upcoming.cost) {
    return;
  }

  tribe.knowledge = Math.max(0, tribe.knowledge - upcoming.cost * DISCOVERY_EFFORT);
  discover(tribe, upcoming.id, `${tribe.name} discovered ${upcoming.name.toLowerCase()}`, context);
}

export function discover(tribe: Tribe, technology: TechnologyId, message: string, context: SocietyContext): void {
  if (knows(tribe, technology)) {
    return;
  }

  tribe.technologies.add(technology);
  context.chronicle.record({ category: "discovery", text: message, tribeId: tribe.id, x: tribe.campX, z: tribe.campZ });
}

function spoilFood(tick: TribeTick): void {
  const { tribe } = tick;

  const storehouse = completedBuilding(tick.context.buildings, tribe.buildings.storehouseId);

  const spoilage = storehouse === null ? OPEN_SPOILAGE : STORED_SPOILAGE;

  tribe.stock.food = Math.max(0, tribe.stock.food - tribe.stock.food * spoilage * tick.days);
}

function growFields(tick: TribeTick): void {
  const { context, tribe } = tick;
  const { season } = context.environment;

  abandonFloodedFields(tribe, context);
  tribe.timers.cropDays += tick.days;

  const isShowingCrops = tribe.timers.cropDays > CROP_DISPLAY_DAYS;

  for (const field of tribe.fields) {
    if (isGrowingSeason(season)) {
      field.growth = Math.min(1, field.growth + tick.days * (FIELD_GROWTH + field.tending * TENDED_GROWTH));
    }

    if (isWinter(season)) {
      field.growth = 0;
    }

    field.tending = Math.max(0, field.tending - tick.days * TENDING_DECAY);

    if (isShowingCrops) {
      context.world.setCrop(field.cell, field.growth);
    }
  }

  if (isShowingCrops) {
    tribe.timers.cropDays = 0;
  }
}

function abandonFloodedFields(tribe: Tribe, context: SocietyContext): void {
  const { world } = context;

  const flooded = tribe.fields.filter((field) => world.isWater(field.cell));

  if (flooded.length === 0) {
    return;
  }

  for (const field of flooded) {
    world.setCrop(field.cell, 0);
  }

  tribe.fields = tribe.fields.filter((field) => !flooded.includes(field));
}

function planBuildings(tick: TribeTick): void {
  const { timers } = tick.tribe;

  timers.planningSeconds -= tick.seconds;

  if (timers.planningSeconds > 0) {
    return;
  }

  timers.planningSeconds = PLANNING_SECONDS;
  planConstruction(tick.tribe, tick.context);
}

function considerBirths(tick: TribeTick): void {
  const { timers } = tick.tribe;

  timers.birthDays += tick.days;

  if (timers.birthDays <= BIRTH_CHECK_DAYS) {
    return;
  }

  const elapsedDays = timers.birthDays;

  timers.birthDays = 0;

  const mother = chooseMother(tick, elapsedDays);

  if (mother !== null) {
    giveBirth(tick, mother);
  }
}

function chooseMother(tick: TribeTick, elapsedDays: number): Person | null {
  const { context, members, tribe } = tick;
  const { day } = context.environment;

  const mothers = members.filter((person) => {
    const isOfAge = person.age > MOTHER_YOUNGEST && person.age < MOTHER_OLDEST;

    return person.isFemale && isOfAge && day - person.lastBirthDay > DAYS_BETWEEN_CHILDREN;
  });
  const hasFather = members.some((person) => !person.isFemale && person.age > FATHER_YOUNGEST);
  const children = members.filter((person) => isChild(person)).length;

  const isFed = tribe.stock.food > members.length * FOOD_PER_PERSON_FOR_BIRTHS;
  const hasRoom = members.length < housingCapacity(tribe, context);
  const hasEnoughAdults = children <= members.length - children;

  if (mothers.length === 0 || !hasFather || !isFed || !hasRoom || !hasEnoughAdults) {
    return null;
  }

  const odds =
    elapsedDays *
    (0.4 + tribe.faith * 0.004) *
    Math.min(MAXIMUM_MOTHERS_COUNTED, mothers.length) *
    context.rules.life.birthRate;

  if (!context.random.chance(odds)) {
    return null;
  }

  return context.random.pick(mothers);
}

function giveBirth(tick: TribeTick, mother: Person): void {
  const { context, tribe } = tick;
  const { random } = context;

  const isFemale = random.chance(0.5);
  const besideMother = { x: mother.mover.x + 1, z: mother.mover.z + 1 };

  const birthplace = nearestWalkableSpot(context.world, besideMother, BIRTHPLACE_SEARCH_RADIUS);

  const child = createPerson(
    {
      age: 0,
      id: context.identifiers.next(),
      isFemale,
      name: personName(random, isFemale),
      tribeId: tribe.id,
      x: birthplace.x,
      z: birthplace.z,
    },
    random
  );

  mother.lastBirthDay = context.environment.day;
  tribe.births += 1;
  tick.services.addPerson(tribe, child);
  assignHomes(tribe, context);
  context.chronicle.record({
    category: "birth",
    text: `${child.name} was born to ${tribe.name}`,
    tribeId: tribe.id,
    x: child.mover.x,
    z: child.mover.z,
  });
}

function driftFaith(tick: TribeTick): void {
  const { tribe } = tick;

  tribe.faith += (FAITH_BASELINE - tribe.faith) * tick.days * FAITH_DRIFT;
}

function runDailyChecks(tick: TribeTick): void {
  const { context, members, services, tribe } = tick;

  tribe.timers.dailyDays += tick.days;

  if (tribe.timers.dailyDays <= DAILY_CHECK_DAYS) {
    return;
  }

  tribe.timers.dailyDays = 0;

  if (tribe.isMigrating) {
    updateMigration(tribe, members, context);
  } else {
    considerMoving(tribe, members, context, services);
  }

  considerSplit(tribe, members, context, services);
}

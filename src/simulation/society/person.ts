import { ADULT_AGE, ELDER_AGE } from "../../content/life-stages.ts";
import { FULL_TURN } from "../../shared/math.ts";
import type { RandomSource } from "../../shared/random.ts";
import type { CarriedItem, PersonPose } from "../../world/agent-poses.ts";
import { createMover, type Mover } from "../agents/movement.ts";
import type { Job } from "./jobs/job.ts";

export const YEARS_PER_DAY = 1;
export const NEED_SECONDS = 240;

const SHORTEST_LIFESPAN = 38;
const LIFESPAN_VARIATION = 22;
const CHILD_WALK_SPEED = 2;
const ELDER_WALK_SPEED = 1.8;
const ADULT_WALK_SPEED = 2.5;
const CHILD_RUN_SPEED = 3.8;
const ADULT_RUN_SPEED = 5.2;

export type DeathCause = "age" | "blast" | "cold" | "earthquake" | "fire" | "hunger" | "lightning" | "mammoth";

interface Carrying {
  food: number;
  foodItem: CarriedItem;
  stone: number;
  wood: number;
}

export interface Person {
  age: number;
  appearanceSeed: number;
  carrying: Carrying;
  causeOfDeath: DeathCause | null;
  dangerCheckSeconds: number;
  deathSeconds: number;
  energy: number;
  health: number;
  homeId: number | null;
  hunger: number;
  id: number;
  isAlive: boolean;
  isFemale: boolean;
  job: Job | null;
  lastBirthDay: number;
  lifespan: number;
  mover: Mover;
  name: string;
  phase: number;
  pose: PersonPose;
  rethinkSeconds: number;
  speed: number;
  tribeId: number;
  warmth: number;
}

interface PersonBirth {
  age: number;
  id: number;
  isFemale: boolean;
  name: string;
  tribeId: number;
  x: number;
  z: number;
}

export function createPerson(birth: PersonBirth, random: RandomSource): Person {
  return {
    age: birth.age,
    appearanceSeed: random.next(),
    carrying: { food: 0, foodItem: "nothing", stone: 0, wood: 0 },
    causeOfDeath: null,
    dangerCheckSeconds: random.next(),
    deathSeconds: 0,
    energy: 0.9,
    health: 1,
    homeId: null,
    hunger: random.between(0.15, 0.35),
    id: birth.id,
    isAlive: true,
    isFemale: birth.isFemale,
    job: null,
    lastBirthDay: Number.NEGATIVE_INFINITY,
    lifespan: SHORTEST_LIFESPAN + random.next() * LIFESPAN_VARIATION,
    mover: createMover(birth.x, birth.z, random.next() * FULL_TURN),
    name: birth.name,
    phase: random.next() * 10,
    pose: "idle",
    rethinkSeconds: random.next() * 2,
    speed: 0,
    tribeId: birth.tribeId,
    warmth: 1,
  };
}

export function isChild(person: Person): boolean {
  return person.age < ADULT_AGE;
}

export function isElder(person: Person): boolean {
  return person.age > ELDER_AGE;
}

export function walkSpeed(person: Person): number {
  if (isChild(person)) {
    return CHILD_WALK_SPEED;
  }

  if (isElder(person)) {
    return ELDER_WALK_SPEED;
  }

  return ADULT_WALK_SPEED;
}

export function runSpeed(person: Person): number {
  if (isChild(person)) {
    return CHILD_RUN_SPEED;
  }

  return ADULT_RUN_SPEED;
}

export function carriedItem(person: Person): CarriedItem {
  const { carrying } = person;

  if (carrying.wood > 0) {
    return "wood";
  }

  if (carrying.stone > 0) {
    return "stone";
  }

  if (carrying.food > 0) {
    return carrying.foodItem;
  }

  return "nothing";
}

export function isCarryingAnything(person: Person): boolean {
  return carriedItem(person) !== "nothing";
}

export function dropCarrying(person: Person): void {
  person.carrying.food = 0;
  person.carrying.foodItem = "nothing";
  person.carrying.stone = 0;
  person.carrying.wood = 0;
}

export function pickUpFood(person: Person, amount: number, item: CarriedItem): void {
  person.carrying.food += amount;
  person.carrying.foodItem = item;
}

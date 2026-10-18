import { ANIMALS, animalWithArticle } from "../../../content/animals.ts";
import { faceTowards } from "../../agents/movement.ts";
import { type Animal, startleAnimal } from "../../fauna/fauna.ts";
import { pickUpFood, walkSpeed } from "../person.ts";
import type { PersonTick } from "../society-context.ts";
import { learn, markScarce } from "../tribe.ts";
import { DeliverJob } from "./deliver-job.ts";
import { headTo, type Job, standStill, walk } from "./job.ts";

const HUNT_SECONDS = 50;
const HUNTING_RANGE = 800;
const THROWING_RANGE = 28;
const LOST_RANGE = 34;
const RETARGET_SECONDS = 2;
const FIRST_THROW_DELAY = 0.5;
const THROW_COOLDOWN = 2.2;
const MAXIMUM_CARRIED_MEAT = 8;
const HELPER_RANGE = 40;
const MAMMOTH_REACH = 12;
const MAMMOTH_COUNTERATTACK = 0.15;
const MAMMOTH_WOUND = 0.35;
const HELPER_HIT_BONUS = 0.05;

type HuntPhase = "stalk" | "strike";

export function findGame(tick: PersonTick): HuntJob | null {
  const { tribe } = tick;

  const hunters = tribe.memberIds.length;

  const animal = tick.context.fauna.nearestAnimal(tribe.campX, tribe.campZ, HUNTING_RANGE, (candidate) => {
    const { huntingPartySize } = ANIMALS[candidate.kind];

    return huntingPartySize !== null && hunters >= huntingPartySize;
  });

  if (animal === null) {
    markScarce(tribe, "game", tick.context.environment.day);

    return null;
  }

  return new HuntJob(tick, animal);
}

export class HuntJob implements Job {
  readonly kind = "hunt";
  readonly #animalId: number;
  #phase: HuntPhase = "stalk";
  #remainingSeconds = HUNT_SECONDS;
  #retargetSeconds = 0;
  #throwCooldown = 0;

  constructor(tick: PersonTick, animal: Animal) {
    this.#animalId = animal.id;
    headTo(tick.person, animal.mover, tick.context);
  }

  update(tick: PersonTick): Job | null {
    this.#remainingSeconds -= tick.seconds;

    const animal = tick.context.fauna.findAnimal(this.#animalId);

    if (animal === null || !animal.isAlive || this.#remainingSeconds <= 0) {
      return null;
    }

    const distance = Math.hypot(animal.mover.x - tick.person.mover.x, animal.mover.z - tick.person.mover.z);

    if (this.#phase === "stalk") {
      this.#stalk(tick, animal, distance);

      return this;
    }

    return this.#strike(tick, animal, distance);
  }

  #stalk(tick: PersonTick, animal: Animal, distance: number): void {
    this.#retargetSeconds -= tick.seconds;

    if (this.#retargetSeconds <= 0) {
      this.#retargetSeconds = RETARGET_SECONDS;
      headTo(tick.person, animal.mover, tick.context);
    }

    walk(tick, walkSpeed(tick.person) * (distance > 60 ? 1.1 : 0.75));

    if (distance < THROWING_RANGE) {
      this.#phase = "strike";
      this.#throwCooldown = FIRST_THROW_DELAY;
    }
  }

  #strike(tick: PersonTick, animal: Animal, distance: number): Job | null {
    standStill(tick.person, "throw");
    faceTowards(tick.person.mover, animal.mover.x, animal.mover.z);

    if (distance > LOST_RANGE) {
      this.#phase = "stalk";

      return this;
    }

    this.#throwCooldown -= tick.seconds;

    if (this.#throwCooldown > 0) {
      return this;
    }

    this.#throwCooldown = THROW_COOLDOWN;
    sufferCounterattack(tick, animal, distance);

    if (!tick.person.isAlive) {
      return null;
    }

    if (!tick.context.random.chance(hitChance(tick, animal))) {
      startleAnimal(animal, tick.person.mover.x, tick.person.mover.z, 0.8);
      this.#phase = "stalk";

      return this;
    }

    animal.health -= 1;

    if (animal.health > 0) {
      startleAnimal(animal, tick.person.mover.x, tick.person.mover.z, 1);

      return this;
    }

    return bringDown(tick, animal);
  }
}

function hitChance(tick: PersonTick, animal: Animal): number {
  const definition = ANIMALS[animal.kind];

  if (definition.huntingPartySize === null || definition.huntingPartySize <= 1) {
    return definition.hitChance;
  }

  const helpers = tick.context.people.countNear(
    animal.mover.x,
    animal.mover.z,
    HELPER_RANGE,
    (person) => person.tribeId === tick.tribe.id && person.job?.kind === "hunt"
  );

  return definition.hitChance + HELPER_HIT_BONUS * helpers;
}

function sufferCounterattack(tick: PersonTick, animal: Animal, distance: number): void {
  if (animal.kind !== "mammoth" || distance >= MAMMOTH_REACH) {
    return;
  }

  if (!tick.context.random.chance(MAMMOTH_COUNTERATTACK)) {
    return;
  }

  tick.person.health -= MAMMOTH_WOUND;

  if (tick.person.health <= 0) {
    tick.context.people.kill(tick.person, "mammoth");

    return;
  }

  tick.context.chronicle.record({
    category: "warning",
    text: `${tick.person.name} was hurt by a mammoth`,
    tribeId: tick.tribe.id,
    x: tick.person.mover.x,
    z: tick.person.mover.z,
  });
}

function bringDown(tick: PersonTick, animal: Animal): Job {
  const { food } = ANIMALS[animal.kind];

  const carried = Math.min(MAXIMUM_CARRIED_MEAT, food);

  tick.context.fauna.kill(animal, "hunt");
  pickUpFood(tick.person, carried, "meat");
  tick.tribe.stock.food += food - carried;
  learn(tick.tribe, 3, tick.context.rules);
  tick.context.chronicle.record({
    category: "hunt",
    text: `${tick.tribe.name} hunters brought down ${animalWithArticle(animal.kind)}`,
    tribeId: tick.tribe.id,
    x: animal.mover.x,
    z: animal.mover.z,
  });

  return new DeliverJob(tick);
}

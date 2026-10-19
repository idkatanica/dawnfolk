import { FOOD_KINDS } from "../../content/resources.ts";
import { createPerson } from "../society/person.ts";
import type { Tribe } from "../society/tribe.ts";
import type { SocietyHarness } from "./test-society.ts";

const ROW_LENGTH = 4;
const SPACING = 3;
const ADULT_AGE = 22;
const CHILD_AGE = 6;
const ARMORY_SPEARS = 12;

export interface TribeFounding {
  readonly adults: number;
  readonly children: number;
  readonly x: number;
  readonly z: number;
}

export function foundTribe(harness: SocietyHarness, founding: TribeFounding): Tribe {
  const tribe = harness.society.createTribe(founding.x, founding.z);

  for (let index = 0; index < founding.adults + founding.children; index += 1) {
    const isChild = index >= founding.adults;

    const person = createPerson(
      {
        age: isChild ? CHILD_AGE : ADULT_AGE + index,
        id: harness.identifiers.next(),
        isFemale: index % 2 === 1,
        name: `${tribe.name.charAt(0)}${index}`,
        tribeId: tribe.id,
        x: founding.x + (index % ROW_LENGTH) * SPACING,
        z: founding.z + Math.floor(index / ROW_LENGTH) * SPACING,
      },
      harness.random
    );

    person.hunger = 0.1;
    harness.society.addPerson(tribe, person);
  }

  return tribe;
}

export function setFood(tribe: Tribe, food: number): void {
  for (const kind of FOOD_KINDS) {
    tribe.stock[kind] = 0;
  }

  tribe.stock.meat = food;
}

export function armTribe(tribe: Tribe, food: number): void {
  tribe.technologies.add("fire");
  tribe.technologies.add("spear");
  tribe.stock.spears = ARMORY_SPEARS;
  setFood(tribe, food);
}

export function runUntil(harness: SocietyHarness, seconds: number, isDone: () => boolean): number {
  let elapsed = 0;

  while (elapsed < seconds && !isDone()) {
    harness.step();
    elapsed += 0.1;
  }

  return elapsed;
}

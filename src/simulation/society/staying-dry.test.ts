import { describe, expect, it } from "vitest";
import { SocietyHarness } from "../testing/test-society.ts";
import { assignJob } from "./decisions.ts";
import { FleeJob } from "./jobs/flee-job.ts";
import { WanderJob } from "./jobs/wander-job.ts";
import type { Person } from "./person.ts";
import type { PersonTick } from "./society-context.ts";
import type { Tribe } from "./tribe.ts";
import { updateTribe } from "./tribe-life.ts";

const MORNING = 0.3;
const STRIP_HALF_WIDTH = 10;

function createStripHarness(): SocietyHarness {
  const harness = new SocietyHarness({ day: MORNING });

  const { grid, terrain } = harness.world;

  for (let cell = 0; cell < grid.cellCount; cell += 1) {
    if (Math.abs(grid.cellCenterX(cell)) > STRIP_HALF_WIDTH) {
      terrain.waterSurface[cell] = terrain.height[cell] + 2;
    }
  }

  harness.navigation.rebuild();

  return harness;
}

function settle(harness: SocietyHarness, people: number): Tribe {
  const tribe = harness.spawnTribe(people);

  if (tribe === null) {
    throw new Error("Expected the tribe to settle");
  }

  return tribe;
}

function tickFor(harness: SocietyHarness, person: Person, tribe: Tribe): PersonTick {
  return { context: harness.context, person, seconds: 0.1, tribe };
}

function standsOnDryLand(harness: SocietyHarness, person: Person): boolean {
  return harness.world.isWalkableAt(person.mover.x, person.mover.z);
}

describe("staying dry", () => {
  it("lets newcomers arrive on dry land only", () => {
    const harness = createStripHarness();

    const tribe = settle(harness, 12);

    const members = harness.society.membersOf(tribe);

    expect(members.filter((person) => !standsOnDryLand(harness, person))).toEqual([]);
  });

  it("brings children into the world on dry land", () => {
    const harness = createStripHarness();

    const tribe = settle(harness, 3);

    const [mother, ...others] = harness.society.membersOf(tribe);

    mother.isFemale = true;
    mother.age = 24;
    mother.mover.x = STRIP_HALF_WIDTH - 0.5;
    mother.mover.z = tribe.campZ;

    for (const person of others) {
      person.isFemale = false;
      person.age = 30;
    }

    tribe.stock.food = 100;
    updateTribe({
      context: harness.context,
      days: 10,
      members: harness.society.membersOf(tribe),
      seconds: 0.1,
      services: harness.society,
      tribe,
    });

    const newborn = harness.society.people.at(-1);

    expect(tribe.births).toBe(1);
    expect(newborn?.age).toBe(0);
    expect(newborn === undefined ? false : standsOnDryLand(harness, newborn)).toBe(true);
  });

  it("sends children to play on dry land", () => {
    const harness = createStripHarness();

    const tribe = settle(harness, 4);

    const [child] = harness.society.membersOf(tribe);

    const tick = tickFor(harness, child, tribe);

    for (let game = 0; game < 30; game += 1) {
      assignJob(tick, new WanderJob("play", tick));

      expect(harness.world.isWalkableAt(child.mover.goalX, child.mover.goalZ)).toBe(true);
    }
  });

  it("stops wading when the flight is replaced by another job", () => {
    const harness = createStripHarness();

    const tribe = settle(harness, 4);

    const [person] = harness.society.membersOf(tribe);

    const tick = tickFor(harness, person, tribe);

    assignJob(tick, new FleeJob(tick, { x: person.mover.x, z: person.mover.z + 20 }));

    expect(person.mover.canWade).toBe(true);

    assignJob(tick, new WanderJob("idle", tick));

    expect(person.mover.canWade).toBe(false);
  });

  it("stops wading when a fleeing person joins another tribe", () => {
    const harness = createStripHarness();

    const tribe = settle(harness, 4);

    const offshoot = harness.society.createTribe(tribe.campX, tribe.campZ + 200);

    const [person] = harness.society.membersOf(tribe);

    const tick = tickFor(harness, person, tribe);

    assignJob(tick, new FleeJob(tick, { x: person.mover.x, z: person.mover.z + 20 }));
    harness.society.moveToTribe(person, tribe, offshoot);

    expect(person.job).toBeNull();
    expect(person.mover.canWade).toBe(false);
  });

  it("gives up fields that the water has taken", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = settle(harness, 4);

    const drowned = harness.world.grid.cellAt(tribe.campX + 40, tribe.campZ);
    const dry = harness.world.grid.cellAt(tribe.campX - 40, tribe.campZ);

    tribe.fields.push({ cell: drowned, growth: 0.8, tending: 0 }, { cell: dry, growth: 0.8, tending: 0 });
    harness.world.terrain.waterSurface[drowned] = harness.world.terrain.height[drowned] + 2;
    harness.step();

    expect(tribe.fields.map((field) => field.cell)).toEqual([dry]);
  });
});

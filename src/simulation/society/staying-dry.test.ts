import { describe, expect, it } from "vitest";
import { Ground } from "../../content/grounds.ts";
import { SocietyHarness, settle, tickFor } from "../testing/test-society.ts";
import { floodCells, floodStrip } from "../testing/test-world.ts";
import { assignJob } from "./decisions.ts";
import { findFishingSpot } from "./jobs/fish-job.ts";
import { FleeJob } from "./jobs/flee-job.ts";
import { WanderJob } from "./jobs/wander-job.ts";
import type { Person } from "./person.ts";
import type { Field } from "./tribe.ts";
import { updateTribe } from "./tribe-life.ts";

function sownField(cell: number): Field {
  return {
    cell,
    crop: "wheat",
    growth: 0.8,
    isFenced: false,
    isSown: true,
    plantings: 1,
    previousGround: Ground.Meadow,
    tending: 0,
  };
}

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

    tribe.stock.grain = 100;
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

  it("runs from danger along the shore rather than into the water", () => {
    const harness = createStripHarness();

    const tribe = settle(harness, 4);

    const [person] = harness.society.membersOf(tribe);

    const tick = tickFor(harness, person, tribe);

    person.mover.x = STRIP_HALF_WIDTH - 2;
    assignJob(tick, new FleeJob(tick, { x: person.mover.x - 30, z: person.mover.z }));

    let wasInWater = false;

    for (let step = 0; step < 200 && person.job !== null; step += 1) {
      person.job = person.job.update(tick);
      wasInWater = wasInWater || harness.world.isWaterAt(person.mover.x, person.mover.z);
    }

    expect(wasInWater).toBe(false);
  });

  it("walks people out of water that rose around them", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = settle(harness, 4);

    const [person] = harness.society.membersOf(tribe);

    floodCells(harness.world, harness.world.grid.cellsInRadius(person.mover.x, person.mover.z, 40), 1.6);
    harness.navigation.rebuild();

    expect(harness.world.isWaterAt(person.mover.x, person.mover.z)).toBe(true);

    harness.run(60);

    expect(harness.world.isWaterAt(person.mover.x, person.mover.z)).toBe(false);
  });

  it("gives up fields that the water has taken", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = settle(harness, 4);

    const drowned = harness.world.grid.cellAt(tribe.campX + 40, tribe.campZ);
    const dry = harness.world.grid.cellAt(tribe.campX - 40, tribe.campZ);

    tribe.fields.push(sownField(drowned), sownField(dry));
    harness.world.terrain.waterSurface[drowned] = harness.world.terrain.height[drowned] + 2;
    harness.step();

    expect(tribe.fields.map((field) => field.cell)).toEqual([dry]);
  });

  it("fishes from the bank and never from the water", () => {
    const harness = new SocietyHarness({ day: MORNING });

    floodStrip(harness.world, 20, 2);
    harness.navigation.rebuild();

    const tribe = settle(harness, 4);

    const [fisher] = harness.society.membersOf(tribe);

    const tick = tickFor(harness, fisher, tribe);
    const job = Array.from({ length: 6 }, () => findFishingSpot(tick)).find((found) => found !== null);

    if (job === undefined || job === null) {
      throw new Error("Expected a fishing spot by the river");
    }

    assignJob(tick, job);

    let fishingSpots = 0;
    let wasInWater = false;

    for (let step = 0; step < 900 && fisher.job !== null; step += 1) {
      fisher.job = fisher.job.update(tick);

      const { x, z } = fisher.mover;

      wasInWater = wasInWater || harness.world.isWaterAt(x, z);

      if (fisher.pose === "fish") {
        const isOnBank = harness.world.grid.cellsInRadius(x, z, 8).some((cell) => harness.world.isWater(cell));

        expect(harness.world.isWalkableAt(x, z) && isOnBank).toBe(true);
        fishingSpots += 1;
      }
    }

    expect(fishingSpots).toBeGreaterThan(0);
    expect(wasInWater).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { SocietyHarness } from "../testing/test-society.ts";
import { HuntJob } from "./jobs/hunt-job.ts";
import type { Job } from "./jobs/job.ts";
import { TendJob } from "./jobs/tend-job.ts";
import { nearestShore } from "./resources.ts";
import type { PersonTick } from "./society-context.ts";
import type { Tribe } from "./tribe.ts";

const MORNING = 0.3;

function settle(harness: SocietyHarness, people: number): Tribe {
  const tribe = harness.spawnTribe(people);

  if (tribe === null) {
    throw new Error("Expected the tribe to settle");
  }

  return tribe;
}

function firstMemberTick(harness: SocietyHarness, tribe: Tribe): PersonTick {
  const [person] = harness.society.membersOf(tribe);

  return { context: harness.context, person, seconds: 0.1, tribe };
}

function runToCompletion(job: Job, tick: PersonTick, limitSeconds: number): boolean {
  let current: Job | null = job;

  for (let elapsed = 0; elapsed < limitSeconds; elapsed += tick.seconds) {
    current = current.update(tick);

    if (current === null) {
      return true;
    }
  }

  return false;
}

describe("feeding the campfire", () => {
  it("keeps the wood the tender was already carrying", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = settle(harness, 3);

    const tick = firstMemberTick(harness, tribe);

    const campfire = harness.buildings.add(
      { kind: "campfire", rotation: 0, tribeId: tribe.id, x: tribe.campX + 2, z: tribe.campZ },
      harness.random
    );

    campfire.progress = 1;
    campfire.fuel = 0.2;
    tribe.stock.wood = 5;
    tick.person.carrying.wood = 3;

    expect(runToCompletion(new TendJob(tick, campfire), tick, 60)).toBe(true);
    expect(campfire.fuel).toBeCloseTo(0.65);
    expect(tribe.stock.wood).toBe(4);
    expect(tick.person.carrying.wood).toBe(3);
  });
});

describe("hunting mammoths", () => {
  it("names the mammoth when its counterattack kills a hunter", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = settle(harness, 6);

    const tick = firstMemberTick(harness, tribe);

    const herd = harness.fauna.spawnHerd("mammoth", tribe.campX + 40, tribe.campZ, 1, harness.random);

    if (herd === null) {
      throw new Error("Expected a mammoth herd");
    }

    const mammoth = harness.fauna.findAnimal(herd.memberIds[0]);

    if (mammoth === null) {
      throw new Error("Expected a mammoth");
    }

    mammoth.health = 1000;
    tick.person.health = 0.3;
    tick.person.mover.x = mammoth.mover.x + 5;
    tick.person.mover.z = mammoth.mover.z;

    for (let hunt = 0; hunt < 20; hunt += 1) {
      if (!tick.person.isAlive) {
        break;
      }

      runToCompletion(new HuntJob(tick, mammoth), tick, 60);
    }

    expect(tick.person.isAlive).toBe(false);
    expect(tick.person.causeOfDeath).toBe("mammoth");
    expect(harness.chronicle.takeEntries()).toContainEqual(
      expect.objectContaining({ text: expect.stringContaining("trampled by a mammoth") })
    );
  });
});

describe("fishing", () => {
  it("stands the fisher on the shore rather than at the water's edge", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const { grid, terrain } = harness.world;

    for (let cell = 0; cell < grid.cellCount; cell += 1) {
      if (grid.columnOf(cell) % 4 === 0 && grid.rowOf(cell) % 4 === 0) {
        terrain.waterSurface[cell] = terrain.height[cell] + 2;
      }
    }

    const reach = Array.from({ length: 8 }, (_unused, index) => (index / 8) * Math.PI * 2);

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const spot = nearestShore(harness.world, { x: 0, z: 0 }, 200, harness.random);

      if (spot === null) {
        throw new Error("Expected a fishing spot");
      }

      const wetSamples = reach.filter((angle) =>
        harness.world.isWaterAt(spot.x + Math.cos(angle) * 1.2, spot.z + Math.sin(angle) * 1.2)
      );

      expect(wetSamples).toEqual([]);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  isRockSpecies,
  PLANT_SPECIES,
  PlantSpecies,
  type PlantSpeciesIndex,
  plantSpeciesDefinition,
} from "../../content/plants.ts";
import { FULL_TURN, wrapAngle } from "../../shared/math.ts";
import { firstMemberTick, SocietyHarness, settle } from "../testing/test-society.ts";
import { findTree } from "./jobs/chop-job.ts";
import { findBerries } from "./jobs/gather-job.ts";
import { findGame, HuntJob } from "./jobs/hunt-job.ts";
import type { Job } from "./jobs/job.ts";
import { findStone } from "./jobs/quarry-job.ts";
import { TendJob } from "./jobs/tend-job.ts";
import { carriedAmount, pickUp, type Weapon } from "./person.ts";
import { nearestShore } from "./resources.ts";
import type { PersonTick } from "./society-context.ts";

const MORNING = 0.3;
const STONE_SPEAR: Weapon = { kind: "spear", material: "stone" };
const WORK_SPOT_TOLERANCE = 0.35;
const FACING_TOLERANCE = 0.05;
const ROCKS: readonly PlantSpeciesIndex[] = PLANT_SPECIES.filter((species) => isRockSpecies(species.index)).map(
  (species) => species.index
);

interface WorkPlacement {
  readonly missedBy: number;
  readonly turnedAwayBy: number;
}

function plantNear(tick: PersonTick, species: PlantSpeciesIndex, height: number): number {
  const { mover } = tick.person;

  return tick.context.world.plant({
    bornDay: 0,
    height,
    rotation: 0,
    seed: 0.5,
    species,
    x: mover.x + 14,
    z: mover.z - 6,
  });
}

function workUntilPosed(job: Job, tick: PersonTick, pose: string): void {
  let current: Job | null = job;

  for (let elapsed = 0; elapsed < 60 && current !== null; elapsed += tick.seconds) {
    current = current.update(tick);

    if (tick.person.pose === pose) {
      return;
    }
  }

  throw new Error(`Expected the person to start the ${pose} pose`);
}

function placementAt(tick: PersonTick, plant: number, reach: number): WorkPlacement {
  const { vegetation } = tick.context.world;
  const { mover } = tick.person;

  const radius = plantSpeciesDefinition(vegetation.species[plant]).radiusPerMeter * vegetation.height[plant];
  const towardX = vegetation.x[plant] - mover.x;
  const towardZ = vegetation.z[plant] - mover.z;

  return {
    missedBy: Math.abs(Math.hypot(towardX, towardZ) - (radius + reach)),
    turnedAwayBy: Math.abs(wrapAngle(Math.atan2(towardX, towardZ) - mover.heading)),
  };
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

describe("working at plants", () => {
  it("gathers berries at the edge of the bush, facing it", () => {
    const harness = new SocietyHarness({ day: MORNING });
    const tick = firstMemberTick(harness, settle(harness, 1));

    tick.context.world.vegetation.setFruit(plantNear(tick, PlantSpecies.Bush, 2.2), 1);

    const job = findBerries(tick);

    if (job === null) {
      throw new Error("Expected a bush to gather from");
    }

    workUntilPosed(job, tick, "gather");

    const placement = placementAt(tick, job.claimedPlant, 0.35);

    expect(placement.missedBy).toBeLessThan(WORK_SPOT_TOLERANCE);
    expect(placement.turnedAwayBy).toBeLessThan(FACING_TOLERANCE);
  });

  it("chops a tree from arm's reach of the trunk, facing it", () => {
    const harness = new SocietyHarness({ day: MORNING });
    const tick = firstMemberTick(harness, settle(harness, 1));

    plantNear(tick, PlantSpecies.Oak, 16);

    const job = findTree(tick);

    if (job === null) {
      throw new Error("Expected a tree to chop");
    }

    workUntilPosed(job, tick, "chop");

    const placement = placementAt(tick, job.claimedPlant, 0.75);

    expect(placement.missedBy).toBeLessThan(WORK_SPOT_TOLERANCE);
    expect(placement.turnedAwayBy).toBeLessThan(FACING_TOLERANCE);
  });
});

describe("quarrying", () => {
  it.each(ROCKS)("breaks stone from rock species %i at its edge and passes monuments by", (species) => {
    const harness = new SocietyHarness({ day: MORNING });
    const tick = firstMemberTick(harness, settle(harness, 1));
    const { vegetation } = tick.context.world;

    for (let plant = 0; plant < vegetation.count; plant += 1) {
      if (isRockSpecies(vegetation.species[plant])) {
        tick.context.world.removePlant(plant);
      }
    }

    tick.context.world.plant({
      bornDay: 0,
      height: 3,
      rotation: 0,
      seed: 0.1,
      species: PlantSpecies.Menhir,
      x: tick.person.mover.x + 4,
      z: tick.person.mover.z,
    });

    const rock = plantNear(tick, species, 1.2 * plantSpeciesDefinition(species).heightRange[0]);

    const job = findStone(tick);

    if (job === null) {
      throw new Error("Expected a rock to quarry");
    }

    expect(job.kind).toBe("quarry");
    expect(job.claimedPlant).toBe(rock);

    workUntilPosed(job, tick, "mine");

    expect(placementAt(tick, rock, 0.6).missedBy).toBeLessThan(WORK_SPOT_TOLERANCE);
  });
});

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
    pickUp(tick.person, "wood", 3, "wood");

    expect(runToCompletion(new TendJob(tick, campfire), tick, 60)).toBe(true);
    expect(campfire.fuel).toBeCloseTo(0.65);
    expect(tribe.stock.wood).toBe(4);
    expect(carriedAmount(tick.person, "wood")).toBe(3);
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

      runToCompletion(new HuntJob(tick, mammoth, STONE_SPEAR), tick, 60);
    }

    expect(tick.person.isAlive).toBe(false);
    expect(tick.person.causeOfDeath).toBe("mammoth");
    expect(harness.chronicle.takeEntries()).toContainEqual(
      expect.objectContaining({ text: expect.stringContaining("trampled by a mammoth") })
    );
  });
});

describe("choosing game", () => {
  it("leaves wolves alone and stalks an ibex instead", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = settle(harness, 3);

    const tick = firstMemberTick(harness, tribe);

    tribe.stock.spears = 2;
    harness.fauna.spawnHerd("wolf", tribe.campX + 30, tribe.campZ, 3, harness.random);

    expect(findGame(tick)).toBeNull();

    harness.fauna.spawnHerd("ibex", tribe.campX - 120, tribe.campZ, 2, harness.random);

    expect(findGame(tick)).toBeInstanceOf(HuntJob);
  });

  it("names the ibex with the right article when hunters bring one down", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = settle(harness, 3);

    const tick = firstMemberTick(harness, tribe);

    const herd = harness.fauna.spawnHerd("ibex", tribe.campX + 20, tribe.campZ, 1, harness.random);

    if (herd === null) {
      throw new Error("Expected an ibex herd");
    }

    const ibex = harness.fauna.findAnimal(herd.memberIds[0]);

    if (ibex === null) {
      throw new Error("Expected an ibex");
    }

    tick.person.mover.x = ibex.mover.x + 6;
    tick.person.mover.z = ibex.mover.z;

    for (let hunt = 0; hunt < 30; hunt += 1) {
      if (!ibex.isAlive) {
        break;
      }

      runToCompletion(new HuntJob(tick, ibex, STONE_SPEAR), tick, 30);
    }

    expect(ibex.isAlive).toBe(false);
    expect(harness.chronicle.takeEntries()).toContainEqual(
      expect.objectContaining({ text: expect.stringContaining("brought down an ibex") })
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

    const reach = Array.from({ length: 8 }, (_unused, index) => (index / 8) * FULL_TURN);

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

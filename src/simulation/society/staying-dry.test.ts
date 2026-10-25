import { describe, expect, it } from "vitest";
import { Ground } from "../../content/grounds.ts";
import { PlantSpecies } from "../../content/plants.ts";
import { firstMemberTick, SocietyHarness, settle, tickFor } from "../testing/test-society.ts";
import { floodCells, floodStrip } from "../testing/test-world.ts";
import { assignJob } from "./decisions.ts";
import { findFishingSpot } from "./jobs/fish-job.ts";
import { FleeJob } from "./jobs/flee-job.ts";
import { findBerries } from "./jobs/gather-job.ts";
import { headTo, headToWork } from "./jobs/job.ts";
import { WanderJob } from "./jobs/wander-job.ts";
import type { Person } from "./person.ts";
import { nearestShore } from "./resources.ts";
import type { PersonTick } from "./society-context.ts";
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

const WORK_POSES: ReadonlySet<string> = new Set(["gather", "chop", "dig", "fish", "build", "throw"]);

function standsOnDryLand(harness: SocietyHarness, person: Person): boolean {
  return harness.world.isWalkableAt(person.mover.x, person.mover.z);
}

function isOnDryFooting(harness: SocietyHarness, x: number, z: number): boolean {
  const cell = harness.world.grid.cellAt(x, z);

  return harness.world.isWalkable(cell) && !harness.world.touchesWater(cell);
}

function ripeBushBeside(tick: PersonTick): number {
  const { mover } = tick.person;
  const { world } = tick.context;

  for (let plant = 0; plant < world.vegetation.count; plant += 1) {
    world.vegetation.setFruit(plant, 0);
  }

  const bush = world.plant({
    bornDay: 0,
    height: 2.2,
    rotation: 0,
    seed: 0.5,
    species: PlantSpecies.Bush,
    x: mover.x + 24,
    z: mover.z,
  });

  world.vegetation.setFruit(bush, 1);

  return bush;
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

      if (fisher.pose !== "fish") {
        continue;
      }

      const isOnBank = harness.world.grid.cellsInRadius(x, z, 11).some((cell) => harness.world.isWater(cell));

      expect(harness.world.isWalkableAt(x, z) && isOnBank).toBe(true);
      fishingSpots += 1;
    }

    expect(fishingSpots).toBeGreaterThan(0);
    expect(wasInWater).toBe(false);
  });

  it("gathers only from bushes it can stand dry beside, and never from one the water has reached", () => {
    const harness = new SocietyHarness({ day: MORNING });
    const tick = firstMemberTick(harness, settle(harness, 1));
    const { grid } = harness.world;

    const bush = ripeBushBeside(tick);

    expect(findBerries(tick)?.claimedPlant).toBe(bush);

    tick.tribe.claimedPlants.clear();

    const bushCell = harness.world.vegetation.cell[bush];

    floodCells(harness.world, [grid.index(grid.columnOf(bushCell) + 1, grid.rowOf(bushCell))], 0.8);
    harness.navigation.rebuild();

    expect(findBerries(tick)?.claimedPlant).not.toBe(bush);
  });

  it("gathers from a bush beside the water when it can stand on dry ground within reach", () => {
    const harness = new SocietyHarness({ day: MORNING });
    const tick = firstMemberTick(harness, settle(harness, 1));
    const { grid } = harness.world;

    const bush = ripeBushBeside(tick);
    const bushCell = harness.world.vegetation.cell[bush];
    const left = grid.cellCenterX(bushCell) - grid.cellSize / 2;

    harness.world.removePlant(bush);

    const edgeBush = harness.world.plant({
      bornDay: 0,
      height: 2.2,
      rotation: 0,
      seed: 0.5,
      species: PlantSpecies.Bush,
      x: left + 0.6,
      z: grid.cellCenterZ(bushCell),
    });

    harness.world.vegetation.setFruit(edgeBush, 1);
    floodCells(harness.world, [grid.index(grid.columnOf(bushCell) + 1, grid.rowOf(bushCell))], 0.8);
    harness.navigation.rebuild();

    const job = findBerries(tick);

    expect(harness.world.touchesWater(harness.world.vegetation.cell[edgeBush])).toBe(true);
    expect(job?.claimedPlant).toBe(edgeBush);
    expect(isOnDryFooting(harness, tick.person.mover.goalX, tick.person.mover.goalZ)).toBe(true);
  });

  it("works and walks to places on dry ground clear of the water's edge", () => {
    const harness = new SocietyHarness({ day: MORNING });
    const tick = firstMemberTick(harness, settle(harness, 1));
    const { mover } = tick.person;

    floodCells(harness.world, harness.world.grid.cellsInRadius(mover.x + 60, mover.z, 12), 1.2);
    harness.navigation.rebuild();

    const edge = { x: mover.x + 46, z: mover.z };

    headToWork(tick.person, { radius: 0.5, reach: 0.35, ...edge }, harness.context);

    expect(isOnDryFooting(harness, mover.goalX, mover.goalZ)).toBe(true);
    expect(Math.hypot(mover.goalX - edge.x, mover.goalZ - edge.z)).toBeLessThan(15);

    headTo(tick.person, edge, harness.context);

    expect(isOnDryFooting(harness, mover.goalX, mover.goalZ)).toBe(true);
  });

  it("drops its work and walks out when the water rises under it", () => {
    const harness = new SocietyHarness({ day: MORNING });
    const tick = firstMemberTick(harness, settle(harness, 1));
    const { person } = tick;

    const job = findBerries({ ...tick, person });

    if (job === null) {
      throw new Error("Expected berries to gather");
    }

    assignJob(tick, job);
    harness.run(1);

    floodCells(harness.world, harness.world.grid.cellsInRadius(person.mover.x, person.mover.z, 25), 1);
    harness.navigation.rebuild();
    harness.step();

    expect(person.job).toBeNull();

    let workedInWater = false;

    for (let step = 0; step < 600; step += 1) {
      harness.step();
      workedInWater =
        workedInWater || (harness.world.isWaterAt(person.mover.x, person.mover.z) && WORK_POSES.has(person.pose));
    }

    expect(workedInWater).toBe(false);
    expect(harness.world.isWaterAt(person.mover.x, person.mover.z)).toBe(false);
  });

  it("fishes from the middle of a bank cell, corners included, facing the water beside it", () => {
    const harness = new SocietyHarness({ day: MORNING });
    const { grid } = harness.world;

    const pond = grid.cellsInRadius(0, 0, 400).filter((cell) => {
      const x = grid.cellCenterX(cell);
      const z = grid.cellCenterZ(cell);

      return (x > 0 && x < 40 && z > -100 && z < 100) || (z > 0 && z < 40 && x > -100 && x < 100);
    });

    floodCells(harness.world, pond, 2);

    const spots = Array.from({ length: 200 }, () =>
      nearestShore(harness.world, { x: -25, z: -25 }, 15, harness.random)
    );

    expect(spots.filter((spot) => spot !== null).length).toBeGreaterThan(5);

    for (const spot of spots) {
      if (spot === null) {
        continue;
      }

      const cell = grid.cellAt(spot.x, spot.z);
      const water = grid.cellAt(spot.waterX, spot.waterZ);

      expect(harness.world.isWalkable(cell)).toBe(true);
      expect(spot).toMatchObject({ x: grid.cellCenterX(cell), z: grid.cellCenterZ(cell) });
      expect(harness.world.isWater(water)).toBe(true);
      expect(Math.hypot(spot.waterX - spot.x, spot.waterZ - spot.z)).toBeCloseTo(grid.cellSize, 3);
    }
  });
});

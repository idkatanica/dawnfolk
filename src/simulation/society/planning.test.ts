import { describe, expect, it } from "vitest";
import { PlantSpecies } from "../../content/plants.ts";
import { SocietyHarness } from "../testing/test-society.ts";
import { plantInCell } from "../testing/test-world.ts";
import { canAfford, housingCapacity, planConstruction } from "./construction.ts";
import { decideJob } from "./decisions.ts";
import { findCampSite, scoreSite, siteSearchNear } from "./settlement.ts";
import type { PersonTick } from "./society-context.ts";
import type { Tribe } from "./tribe.ts";
import { chooseWork } from "./work-planner.ts";

function settledTribe(harness: SocietyHarness, people = 6): Tribe {
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

describe("construction planning", () => {
  it("lays out a campfire once the tribe knows fire", () => {
    const harness = new SocietyHarness();

    const tribe = settledTribe(harness);

    tribe.technologies.add("fire");
    planConstruction(tribe, harness.context);

    const site = harness.buildings.find(tribe.buildings.constructionSiteId);

    expect(site?.kind).toBe("campfire");
    expect(tribe.buildings.campfireId).toBe(site?.id);
  });

  it("waits until the tribe can afford a building", () => {
    const harness = new SocietyHarness();

    const tribe = settledTribe(harness);

    tribe.technologies.add("fire");
    tribe.stock.wood = 0;
    planConstruction(tribe, harness.context);

    expect(canAfford(tribe, "campfire")).toBe(false);
    expect(tribe.buildings.constructionSiteId).toBeNull();
  });

  it("counts housing from finished shelters only", () => {
    const harness = new SocietyHarness();

    const tribe = settledTribe(harness);

    const tent = harness.buildings.add({ kind: "tent", rotation: 0, tribeId: tribe.id, x: 30, z: 30 }, harness.random);

    tribe.buildings.shelterIds.push(tent.id);

    expect(housingCapacity(tribe, harness.context)).toBe(4);

    tent.progress = 1;

    expect(housingCapacity(tribe, harness.context)).toBe(7);
  });
});

describe("work planning", () => {
  it("does not hunt before spears are known", () => {
    const harness = new SocietyHarness();

    const tribe = settledTribe(harness);

    const tick = firstMemberTick(harness, tribe);

    harness.fauna.spawnHerd("deer", tribe.campX + 100, tribe.campZ, 4, harness.random);

    for (let attempt = 0; attempt < 30; attempt += 1) {
      expect(chooseWork(tick)?.kind).not.toBe("hunt");
    }
  });

  it("sends people to sleep at night", () => {
    const harness = new SocietyHarness({ day: 0.95 });

    const tribe = settledTribe(harness);

    expect(decideJob(firstMemberTick(harness, tribe)).kind).toBe("sleep");
  });

  it("quarries the stone for a hut it plans but cannot afford yet", () => {
    const harness = new SocietyHarness({ day: 0.4 });

    const tribe = settledTribe(harness);

    const tick = firstMemberTick(harness, tribe);

    const campfire = harness.buildings.add(
      { kind: "campfire", rotation: 0, tribeId: tribe.id, x: tribe.campX + 2, z: tribe.campZ },
      harness.random
    );

    campfire.progress = 1;
    tribe.buildings.campfireId = campfire.id;

    for (const technology of ["fire", "shelter", "storage", "huts"] as const) {
      tribe.technologies.add(technology);
    }

    tribe.stock.stone = 3;
    tribe.stock.wood = 40;
    plantInCell(harness.world, harness.world.grid.cellAt(tribe.campX + 30, tribe.campZ), PlantSpecies.Boulder);
    planConstruction(tribe, harness.context);

    const chosen = Array.from({ length: 40 }, () => chooseWork(tick)?.kind);

    expect(tribe.buildings.constructionSiteId).toBeNull();
    expect(chosen).toContain("quarry");
  });

  it("feeds a starving person before sending them to sleep", () => {
    const harness = new SocietyHarness({ day: 0.95 });

    const tribe = settledTribe(harness);

    const tick = firstMemberTick(harness, tribe);

    tick.person.hunger = 0.9;
    tribe.stock.food = 5;

    expect(decideJob(tick).kind).toBe("eat");
  });

  it("lets people woken by hunger at night eat and go back to sleep", () => {
    const harness = new SocietyHarness({ day: 0.92 });

    const tribe = settledTribe(harness);

    const [person] = harness.society.membersOf(tribe);

    tribe.stock.food = 20;
    harness.run(20);
    person.hunger = 0.9;
    harness.run(30);

    expect(harness.context.environment.isNight).toBe(true);
    expect(person.hunger).toBeLessThan(0.5);
    expect(person.job?.kind).toBe("sleep");
  });

  it("sends hungry people to eat when there is food", () => {
    const harness = new SocietyHarness({ day: 0.4 });

    const tribe = settledTribe(harness);

    const tick = firstMemberTick(harness, tribe);

    tick.person.hunger = 0.8;
    tribe.stock.food = 5;

    expect(decideJob(tick).kind).toBe("eat");
  });
});

describe("settlement", () => {
  it("rates steep or burning ground as unsuitable", () => {
    const harness = new SocietyHarness();
    const search = siteSearchNear({ x: 0, z: 0 }, 200, null);

    for (const cell of harness.world.grid.cellsInRadius(0, 0, 30)) {
      harness.world.fields.fire[cell] = 0.5;
    }

    expect(scoreSite({ x: 0, z: 0 }, search, harness.context, [])).toBe(Number.NEGATIVE_INFINITY);
    expect(scoreSite({ x: 200, z: 100 }, search, harness.context, [])).toBeGreaterThan(-5);
  });

  it("does not count burnt trees and bushes as food and wood nearby", () => {
    const harness = new SocietyHarness();
    const search = siteSearchNear({ x: 0, z: 0 }, 200, null);

    const before = scoreSite({ x: 0, z: 0 }, search, harness.context, []);

    for (const cell of harness.world.grid.cellsInRadius(0, 0, 200)) {
      harness.world.vegetation.burnTreesInCell(cell, 1.5);
    }

    expect(scoreSite({ x: 0, z: 0 }, search, harness.context, [])).toBeLessThan(before - 2);
  });

  it("keeps new camps away from other tribes", () => {
    const harness = new SocietyHarness();

    const tribe = settledTribe(harness);

    const site = findCampSite(siteSearchNear({ x: tribe.campX, z: tribe.campZ }, 400, null), harness.context, [tribe]);

    if (site === null) {
      throw new Error("Expected a camp site");
    }

    expect(Math.hypot(site.x - tribe.campX, site.z - tribe.campZ)).toBeGreaterThan(100);
  });
});

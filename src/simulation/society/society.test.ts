import { describe, expect, it } from "vitest";
import { worldRulesSchema } from "../../content/world-rules.ts";
import { SocietyHarness } from "../testing/test-society.ts";
import type { Tribe } from "./tribe.ts";

const MORNING = 0.3;
const EVENING = 0.9;

function expectTribe(tribe: Tribe | null): Tribe {
  if (tribe === null) {
    throw new Error("Expected the tribe to settle");
  }

  return tribe;
}

describe("arriving tribes", () => {
  it("settle with the requested number of people", () => {
    const harness = new SocietyHarness();

    const tribe = expectTribe(harness.spawnTribe(7));

    expect(tribe.memberIds).toHaveLength(7);
    expect(harness.society.population).toBe(7);
    expect(harness.chronicle.takeEntries()).toEqual([expect.objectContaining({ category: "arrival" })]);
  });

  it("refuse land with nowhere to stand", () => {
    const harness = new SocietyHarness({
      world: { dimensions: { cellSize: 10, cellsPerSide: 96 }, heightAt: (x) => x * 3 },
    });

    expect(harness.spawnTribe(7)).toBeNull();
  });
});

describe("daily life", () => {
  it("gathers berries into the stock during the day", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = expectTribe(harness.spawnTribe(6));

    tribe.stock.food = 0;
    harness.run(60);

    const jobs = harness.society.membersOf(tribe).map((person) => person.job?.kind);

    expect(jobs).toContain("gather");

    harness.run(120);

    expect(tribe.stock.food).toBeGreaterThan(0);
  });

  it("eats when hungry", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = expectTribe(harness.spawnTribe(4));

    const members = harness.society.membersOf(tribe);

    for (const person of members) {
      person.hunger = 0.9;
    }

    harness.run(40);

    expect(Math.min(...members.map((person) => person.hunger))).toBeLessThan(0.6);
  });

  it("goes to sleep at night", () => {
    const harness = new SocietyHarness({ day: EVENING });

    const tribe = expectTribe(harness.spawnTribe(4));

    harness.run(40);

    const sleeping = harness.society.membersOf(tribe).filter((person) => person.job?.kind === "sleep");

    expect(sleeping.length).toBeGreaterThan(2);
  });

  it("starves without food", () => {
    const hungryRules = worldRulesSchema.parse({ life: { hungerRate: 2 } });

    const harness = new SocietyHarness({ day: MORNING, rules: hungryRules });

    const tribe = expectTribe(harness.spawnTribe(3));

    for (const person of harness.society.membersOf(tribe)) {
      person.hunger = 1;
      person.health = 0.05;
    }

    tribe.stock.food = 0;
    harness.run(30);

    expect(harness.society.population).toBeLessThan(3);
    expect(harness.society.deaths).toBeGreaterThan(0);
  });
});

describe("danger", () => {
  it("makes people run from a fire nearby", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = expectTribe(harness.spawnTribe(4));

    for (const cell of harness.world.grid.cellsInRadius(tribe.campX + 40, tribe.campZ, 25)) {
      harness.world.fields.fire[cell] = 0.6;
    }

    harness.run(2);

    const fleeing = harness.society.membersOf(tribe).filter((person) => person.job?.kind === "flee");

    expect(fleeing.length).toBeGreaterThan(0);
  });

  it("kills people caught in a blast", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = expectTribe(harness.spawnTribe(4));

    harness.society.damageArea(tribe.campX, tribe.campZ, 200, 5, "blast");

    expect(harness.society.population).toBe(0);
    expect(harness.society.tribes()).toHaveLength(0);
  });
});

describe("progress", () => {
  it("discovers fire and lights a campfire", () => {
    const fastLearning = worldRulesSchema.parse({ life: { learningSpeed: 5 } });

    const harness = new SocietyHarness({ day: MORNING, rules: fastLearning });

    const tribe = expectTribe(harness.spawnTribe(6));

    tribe.stock.wood = 10;
    harness.run(240);

    expect(tribe.technologies.has("fire")).toBe(true);
    expect(tribe.buildings.campfireId).not.toBeNull();
  });

  it("brings children into a well fed tribe", () => {
    const fertile = worldRulesSchema.parse({ life: { birthRate: 3 } });

    const harness = new SocietyHarness({ day: MORNING, rules: fertile });

    const tribe = expectTribe(harness.spawnTribe(8));

    const hut = harness.buildings.add(
      { kind: "hut", rotation: 0, tribeId: tribe.id, x: tribe.campX + 15, z: tribe.campZ },
      harness.random
    );

    hut.progress = 1;
    tribe.buildings.shelterIds.push(hut.id);
    tribe.stock.food = 200;
    harness.run(480);

    expect(tribe.births).toBeGreaterThan(0);
  });
});

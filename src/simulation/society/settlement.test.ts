import { describe, expect, it } from "vitest";
import { SocietyHarness, settle } from "../testing/test-society.ts";
import { floodStrip, fordAcross } from "../testing/test-world.ts";
import type { Person } from "./person.ts";
import { considerSplit, scoreSite, siteSearchNear } from "./settlement.ts";
import type { Tribe } from "./tribe.ts";

interface SplittingTribe {
  harness: SocietyHarness;
  members: Person[];
  tribe: Tribe;
}

function settleSplittingTribe(youngestAge: number): SplittingTribe {
  const harness = new SocietyHarness();
  const tribe = settle(harness, 20);
  const members = harness.society.membersOf(tribe);

  for (const person of members) {
    person.age = 40;
  }

  for (const person of members.slice(0, 4)) {
    person.age = youngestAge;
  }

  return { harness, members, tribe };
}

function nextDrawAfterSplitCheck(youngestAge: number): number {
  const { harness, members, tribe } = settleSplittingTribe(youngestAge);

  considerSplit(tribe, members, harness.context);

  return harness.random.next();
}

describe("camp sites", () => {
  it("are only chosen where the tribe can walk before its migration runs out", () => {
    const harness = new SocietyHarness({
      world: { crossings: [fordAcross(-24, 24, 400)], dimensions: { cellSize: 10, cellsPerSide: 96 } },
    });

    floodStrip(harness.world, 20, 1.5);
    harness.navigation.rebuild();

    const origin = { x: -100, z: -300 };
    const search = siteSearchNear(origin, 900, null);

    expect(scoreSite({ x: 100, z: -300 }, search, harness.context, [])).toBe(Number.NEGATIVE_INFINITY);
    expect(scoreSite({ x: -100, z: -100 }, search, harness.context, [])).toBeGreaterThan(Number.NEGATIVE_INFINITY);
  });

  it("rank the river bank below ground a short walk back from it", () => {
    const harness = new SocietyHarness();

    floodStrip(harness.world, 20, 1.5);
    harness.navigation.rebuild();

    const search = siteSearchNear({ x: 0, z: 0 }, 300, null);

    const onTheBank = scoreSite({ x: -30, z: 100 }, search, harness.context, []);
    const backFromTheBank = scoreSite({ x: -100, z: 100 }, search, harness.context, []);

    expect(onTheBank).toBeLessThan(backFromTheBank);
  });
});

describe("splits", () => {
  it("search for a camp site only when young settlers can leave", () => {
    const idleDraw = settleSplittingTribe(40).harness.random.next();

    expect(nextDrawAfterSplitCheck(40)).toBe(idleDraw);
    expect(nextDrawAfterSplitCheck(20)).not.toBe(idleDraw);
  });
});

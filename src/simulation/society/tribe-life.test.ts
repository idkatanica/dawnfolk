import { describe, expect, it } from "vitest";
import { createStripHarness, STRIP_HALF_WIDTH, settle, standsOnDryLand } from "../testing/test-society.ts";
import { updateTribe } from "./tribe-life.ts";

describe("staying dry", () => {
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
});

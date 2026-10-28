import { describe, expect, it } from "vitest";
import { MORNING, SocietyHarness, settle, THROUGH_MINING, teach } from "../testing/test-society.ts";
import { discover } from "./progress.ts";

describe("eras", () => {
  it("announce once when a tribe enters a new era", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = settle(harness, 5);

    harness.chronicle.takeEntries();
    discover(tribe, "fire", "fire", harness.context);
    discover(tribe, "shelter", "shelters", harness.context);

    const eras = harness.chronicle.takeEntries().filter((entry) => entry.category === "era");

    expect(eras.map((entry) => entry.text)).toEqual(["The Bear Clan enters the Stone Age"]);
    expect(tribe.eraIndex).toBe(1);
  });

  it("wait for ore before the Copper Age and then enter it", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = settle(harness, 5);

    teach(tribe, THROUGH_MINING, 2);
    tribe.knowledge = 5000;
    harness.step();

    expect(tribe.technologies.has("copper")).toBe(false);
    expect(tribe.knowledge).toBeLessThanOrEqual(520);

    tribe.stock.copperOre = 6;
    harness.chronicle.takeEntries();
    harness.step();

    expect(tribe.technologies.has("copper")).toBe(true);
    expect(harness.chronicle.takeEntries()).toContainEqual(
      expect.objectContaining({ category: "era", text: "The Bear Clan enters the Copper Age" })
    );
  });
});

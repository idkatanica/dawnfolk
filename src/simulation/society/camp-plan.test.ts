import { describe, expect, it, vi } from "vitest";
import { SocietyHarness, settle } from "../testing/test-society.ts";
import { buildingPlans } from "./camp-plan.ts";

const TRIBE_SIZE = 6;

describe("building plans", () => {
  it("plans a wall without drawing from the random stream", () => {
    const harness = new SocietyHarness();

    const tribe = settle(harness, TRIBE_SIZE);

    tribe.technologies.add("bronze");

    for (let index = 0; index < 5; index += 1) {
      const tent = harness.buildings.add(
        { kind: "tent", rotation: 0, tribeId: tribe.id, x: tribe.campX + index * 12, z: tribe.campZ + 20 },
        harness.random
      );

      tent.progress = 1;
      tribe.buildings.shelterIds.push(tent.id);
    }

    const draw = vi.spyOn(harness.random, "next");

    const kinds = buildingPlans(tribe, harness.context).map((plan) => {
      return plan.kind;
    });

    expect(tribe.fields).toHaveLength(0);
    expect(kinds).toContain("palisade");
    expect(draw).not.toHaveBeenCalled();
  });
});

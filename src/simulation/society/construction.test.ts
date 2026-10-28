import { describe, expect, it } from "vitest";
import { createMiningHarness, SocietyHarness, settle, THROUGH_MINING, teach } from "../testing/test-society.ts";
import { buildingsOfKind } from "./camp-plan.ts";
import { canAfford, planConstruction } from "./construction.ts";

const TRIBE_SIZE = 6;

describe("construction planning", () => {
  it("lays out a campfire once the tribe knows fire", () => {
    const harness = new SocietyHarness();

    const tribe = settle(harness, TRIBE_SIZE);

    tribe.technologies.add("fire");
    planConstruction(tribe, harness.context);

    const site = harness.buildings.find(tribe.buildings.constructionSiteId);

    expect(site?.kind).toBe("campfire");
    expect(tribe.buildings.campfireId).toBe(site?.id);
  });

  it("waits until the tribe can afford a building", () => {
    const harness = new SocietyHarness();

    const tribe = settle(harness, TRIBE_SIZE);

    tribe.technologies.add("fire");
    tribe.stock.wood = 0;
    planConstruction(tribe, harness.context);

    expect(canAfford(tribe, "campfire")).toBe(false);
    expect(tribe.buildings.constructionSiteId).toBeNull();
  });

  it("opens a mine at a copper deposit once the tribe knows mining", () => {
    const harness = createMiningHarness();

    const tribe = settle(harness, 6);

    teach(tribe, THROUGH_MINING, 2);
    tribe.stock.wood = 200;
    tribe.stock.stone = 200;
    tribe.stock.clay = 200;
    tribe.stock.pottery = 20;

    for (let plan = 0; plan < 12; plan += 1) {
      planConstruction(tribe, harness.context);

      const site = harness.buildings.find(tribe.buildings.constructionSiteId);

      if (site !== null) {
        site.progress = 1;
        tribe.buildings.constructionSiteId = null;
      }
    }

    const [mine] = buildingsOfKind(tribe, harness.context, "mine");

    if (mine === undefined) {
      throw new Error("Expected a mine");
    }

    expect(mine.depositId).toBe(0);
    expect(Math.hypot(mine.x - 160, mine.z - 40)).toBeLessThan(25);
  });
});

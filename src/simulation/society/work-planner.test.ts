import { describe, expect, it } from "vitest";
import { PlantSpecies } from "../../content/plants.ts";
import { firstMemberTick, SocietyHarness, settle } from "../testing/test-society.ts";
import { plantInCell } from "../testing/test-world.ts";
import { planConstruction } from "./construction.ts";
import { chooseWork } from "./work-planner.ts";

const TRIBE_SIZE = 6;

describe("work planning", () => {
  it("does not hunt before spears are known", () => {
    const harness = new SocietyHarness();

    const tribe = settle(harness, TRIBE_SIZE);

    const tick = firstMemberTick(harness, tribe);

    harness.fauna.spawnHerd("deer", tribe.campX + 100, tribe.campZ, 4, harness.random);

    for (let attempt = 0; attempt < 30; attempt += 1) {
      expect(chooseWork(tick)?.kind).not.toBe("hunt");
    }
  });

  it("quarries the stone for a hut it plans but cannot afford yet", () => {
    const harness = new SocietyHarness({ day: 0.4 });

    const tribe = settle(harness, TRIBE_SIZE);

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

    expect(harness.buildings.find(tribe.buildings.constructionSiteId)?.kind).not.toBe("hut");
    expect(chosen).toContain("quarry");
  });
});

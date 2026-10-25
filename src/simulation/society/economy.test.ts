import { describe, expect, it } from "vitest";
import type { TechnologyId } from "../../content/technologies.ts";
import { WorldGrid } from "../../world/world-grid.ts";
import { firstMemberTick, runToCompletion, SocietyHarness, settle } from "../testing/test-society.ts";
import { depositAround } from "../testing/test-world.ts";
import type { Building } from "./buildings.ts";
import { buildingsOfKind } from "./camp-plan.ts";
import { constructionNeeds, planConstruction } from "./construction.ts";
import { CraftJob } from "./jobs/craft-job.ts";
import { findMineWork } from "./jobs/mine-job.ts";
import { discover } from "./progress.ts";
import { workSpeed } from "./tools.ts";
import type { Tribe } from "./tribe.ts";
import { chooseCraft } from "./workshops.ts";

const MORNING = 0.3;
const DIMENSIONS = { cellSize: 10, cellsPerSide: 96 };
const THROUGH_MINING: readonly TechnologyId[] = [
  "fire",
  "shelter",
  "spear",
  "fishing",
  "storage",
  "archery",
  "huts",
  "pottery",
  "farming",
  "totem",
  "weaving",
  "orchards",
  "mining",
];

function learnAll(tribe: Tribe, technologies: readonly TechnologyId[]): void {
  for (const technology of technologies) {
    tribe.technologies.add(technology);
  }

  tribe.eraIndex = 2;
}

function complete(tribe: Tribe, building: Building): Building {
  building.progress = 1;
  tribe.buildings.structureIds.push(building.id);

  return building;
}

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

    learnAll(tribe, THROUGH_MINING);
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

describe("mines", () => {
  function minedHarness(): SocietyHarness {
    const grid = new WorldGrid(DIMENSIONS);

    return new SocietyHarness({
      day: MORNING,
      world: { deposits: [depositAround(grid, "copper", 160, 40)], dimensions: DIMENSIONS },
    });
  }

  it("are opened at a copper deposit once the tribe knows mining", () => {
    const harness = minedHarness();

    const tribe = settle(harness, 6);

    learnAll(tribe, THROUGH_MINING);
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

  it("send miners to dig ore and carry it home", () => {
    const harness = minedHarness();

    const tribe = settle(harness, 4);

    const tick = firstMemberTick(harness, tribe);

    learnAll(tribe, THROUGH_MINING);

    const mine = complete(
      tribe,
      harness.buildings.add(
        { depositId: 0, kind: "mine", rotation: 0, tribeId: tribe.id, x: 150, z: 40 },
        harness.random
      )
    );

    const job = findMineWork(tick, "copper");

    expect(mine.kind).toBe("mine");
    expect(job?.kind).toBe("mine");

    if (job === null) {
      throw new Error("Expected work at the mine");
    }

    expect(runToCompletion(job, tick, 400)).toBe(true);
    expect(tribe.stock.copperOre).toBeGreaterThanOrEqual(12);
  });
});

describe("smelting and tools", () => {
  it("smelt copper ore into copper at the smelter and make copper tools from it", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = settle(harness, 4);

    const tick = firstMemberTick(harness, tribe);

    learnAll(tribe, [...THROUGH_MINING, "copper"]);
    complete(
      tribe,
      harness.buildings.add(
        { kind: "smelter", rotation: 0, tribeId: tribe.id, x: tribe.campX + 20, z: tribe.campZ },
        harness.random
      )
    );
    tribe.stock.copperOre = 9;
    tribe.stock.wood = 20;

    for (let batch = 0; batch < 3; batch += 1) {
      const order = chooseCraft(tribe, harness.context, constructionNeeds(tribe, harness.context));

      expect(order?.recipe).toBe("copper");

      if (order === null) {
        return;
      }

      runToCompletion(new CraftJob(tick, order), tick, 200);
    }

    expect(tribe.stock.copper).toBe(6);
    expect(tribe.stock.copperOre).toBe(0);

    const tools = chooseCraft(tribe, harness.context, constructionNeeds(tribe, harness.context));

    expect(tools?.recipe).toBe("tools");

    if (tools === null) {
      return;
    }

    const speedWithStone = workSpeed(tribe);

    runToCompletion(new CraftJob(tick, tools), tick, 200);

    expect(tribe.tools).toBe("copper");
    expect(workSpeed(tribe)).toBeGreaterThan(speedWithStone);
    expect(tribe.stock.copper).toBe(0);
  });

  it("head new spears with bronze once the tribe casts it", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = settle(harness, 4);

    const tick = firstMemberTick(harness, tribe);

    learnAll(tribe, [...THROUGH_MINING, "copper", "bronze"]);
    tribe.stock.bronze = 3;
    tribe.stock.wood = 10;
    tribe.stock.arrows = 100;
    tribe.stock.bows = 10;

    const order = chooseCraft(tribe, harness.context, constructionNeeds(tribe, harness.context));

    expect(order?.recipe).toBe("spears");
    expect(order?.material).toBe("bronze");

    if (order === null) {
      return;
    }

    runToCompletion(new CraftJob(tick, order), tick, 200);

    expect(tribe.armory).toBe("bronze");
    expect(tribe.stock.bronze).toBe(2);
  });
});

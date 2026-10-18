import { describe, expect, it } from "vitest";
import { cropOfCode, isFencedCode } from "../../content/crops.ts";
import { isFruitTreeSpecies } from "../../content/cultivated-plants.ts";
import { Ground } from "../../content/grounds.ts";
import { PlantSpecies } from "../../content/plants.ts";
import { describeEnvironment } from "../nature/environment.ts";
import { firstMemberTick, SocietyHarness, settle } from "../testing/test-society.ts";
import { PLOT_GROUND } from "../world/world-state.ts";
import { addFieldIfNeeded, fieldTask, sowField, updateFields } from "./farming.ts";
import { FarmJob } from "./jobs/farm-job.ts";
import type { Job } from "./jobs/job.ts";
import { addPlotIfNeeded, plantSpot, ripestFruitTree, updatePlots } from "./plots.ts";
import type { PersonTick } from "./society-context.ts";
import type { Tribe } from "./tribe.ts";
import { TroddenGround } from "./trodden-ground.ts";

const MORNING = 0.3;

function runToCompletion(job: Job, tick: PersonTick, limitSeconds: number): boolean {
  let current: Job | null = job;

  for (let elapsed = 0; elapsed < limitSeconds; elapsed += tick.seconds) {
    current = current.update(tick);

    if (current === null) {
      return true;
    }
  }

  return false;
}

function moveToSeason(harness: SocietyHarness, season: number): void {
  harness.calendar.setSeason(season);
  harness.context.environment = describeEnvironment(harness.calendar, harness.weather);
}

function knowing(tribe: Tribe, technologies: readonly ("farming" | "orchards" | "ploughing")[]): Tribe {
  for (const technology of technologies) {
    tribe.technologies.add(technology);
  }

  return tribe;
}

describe("trodden ground", () => {
  it("bares the earth around buildings and the camp, so nothing grows there", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = settle(harness, 4);

    const tent = harness.buildings.add(
      { kind: "tent", rotation: 0, tribeId: tribe.id, x: tribe.campX + 25, z: tribe.campZ },
      harness.random
    );

    tent.progress = 1;
    tribe.buildings.shelterIds.push(tent.id);
    new TroddenGround().update(0.2, harness.context, [tribe]);

    const { world } = harness;

    const camp = world.grid.cellAt(tribe.campX, tribe.campZ);
    const besideTent = world.grid.cellAt(tent.x + 4, tent.z);
    const farAway = world.grid.cellAt(tribe.campX + 200, tribe.campZ + 200);

    expect(world.isTrodden(camp)).toBe(true);
    expect(world.isTrodden(besideTent)).toBe(true);
    expect(world.isTrodden(farAway)).toBe(false);
    expect(world.canGrowWild(besideTent, PlantSpecies.Oak)).toBe(false);
    expect(world.groundChanges.takeRuns().length).toBeGreaterThan(0);
  });

  it("lets grass come back once a camp is left", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = settle(harness, 4);

    const trodden = new TroddenGround();

    trodden.update(0.2, harness.context, [tribe]);

    const camp = harness.world.grid.cellAt(tribe.campX, tribe.campZ);

    expect(harness.world.isTrodden(camp)).toBe(true);

    trodden.update(10, harness.context, []);

    expect(harness.world.fields.trodden[camp]).toBe(0);
  });
});

describe("fields", () => {
  it("are opened on fertile ground and sown with grain in spring", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = knowing(settle(harness, 6), ["farming"]);

    addFieldIfNeeded(tribe, harness.context);

    const [field] = tribe.fields;

    if (field === undefined) {
      throw new Error("Expected a field");
    }

    expect(harness.world.terrain.ground[field.cell]).toBe(Ground.Farm);
    expect(harness.world.occupancy[field.cell]).toBe(PLOT_GROUND);

    moveToSeason(harness, 0.3);

    expect(fieldTask(tribe, field, 0.3)).toBe("sow");

    sowField(tribe, field, 0.3);

    expect(["wheat", "barley"]).toContain(field.crop);
    expect(field.isSown).toBe(true);
  });

  it("grow through the seasons, are fenced after ploughing and yield grain at harvest", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = knowing(settle(harness, 6), ["farming", "ploughing"]);

    const tick = firstMemberTick(harness, tribe);

    addFieldIfNeeded(tribe, harness.context);

    const [field] = tribe.fields;

    if (field === undefined) {
      throw new Error("Expected a field");
    }

    moveToSeason(harness, 0.2);
    sowField(tribe, field, 0.2);
    updateFields(tribe, harness.context, 0.1);

    for (const season of [0.6, 1, 1.4, 1.8]) {
      moveToSeason(harness, season);
      updateFields(tribe, harness.context, 0.1);
    }

    const code = harness.world.cropCodes[field.cell];

    expect(field.growth).toBe(1);
    expect(isFencedCode(code)).toBe(true);
    expect(cropOfCode(code)).toBe(field.crop);
    expect(fieldTask(tribe, field, 1.8)).toBe("harvest");
    expect(runToCompletion(new FarmJob(tick, field), tick, 300)).toBe(true);
    expect(tribe.stock.grain + tribe.stock.vegetables).toBeGreaterThan(20);
    expect(field.isSown).toBe(false);
  });
});

describe("orchards", () => {
  it("are planted with fruit trees and berry bushes that grow and bear fruit in autumn", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const tribe = knowing(settle(harness, 6), ["farming", "orchards"]);

    addPlotIfNeeded(tribe, harness.context);

    const [orchard] = tribe.plots;

    if (orchard === undefined) {
      throw new Error("Expected an orchard");
    }

    const tree = orchard.spots.find((spot) => isFruitTreeSpecies(spot.species));

    if (tree === undefined) {
      throw new Error("Expected a fruit tree spot");
    }

    expect(orchard.kind).toBe("orchard");
    expect(orchard.spots.some((spot) => !isFruitTreeSpecies(spot.species))).toBe(true);

    plantSpot(tribe, tree, harness.context);

    const { vegetation } = harness.world;

    const sapling = vegetation.height[tree.plant];

    tree.plantedDay = harness.context.environment.day - 30;
    moveToSeason(harness, 2);
    updatePlots(tribe, harness.context, 0.5);

    expect(vegetation.isAlive(tree.plant)).toBe(true);
    expect(vegetation.height[tree.plant]).toBeGreaterThan(sapling * 2);
    expect(vegetation.fruit[tree.plant]).toBeGreaterThan(0.3);
    expect(ripestFruitTree(tribe, harness.world, tribe.claimedPlants)).toBe(tree.plant);
  });
});

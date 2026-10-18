import { describe, expect, it } from "vitest";
import { createRandom } from "../../shared/random.ts";
import { IdentifierSource } from "../identifiers.ts";
import { FireSystem } from "../nature/fire.ts";
import { createTestWorld } from "../testing/test-world.ts";
import { NO_BUILDING } from "../world/world-state.ts";
import { BuildingSystem, type BuildingTick, isCampfireLit } from "./buildings.ts";

function createBuildings() {
  const world = createTestWorld();

  return { buildings: new BuildingSystem(world, new IdentifierSource()), fire: new FireSystem(world), world };
}

function tickOf(fire: FireSystem, overrides: Partial<BuildingTick> = {}): BuildingTick {
  return {
    days: 0.1 / 240,
    fire,
    random: createRandom(1),
    seconds: 0.1,
    weather: { drought: 0.3, precipitation: 0, windSpeed: 5 },
    ...overrides,
  };
}

describe("buildings", () => {
  it("occupy their cell until removed", () => {
    const { buildings, world } = createBuildings();

    const hut = buildings.add({ kind: "hut", rotation: 0, tribeId: 1, x: 5, z: 5 }, createRandom(1));

    expect(world.occupancy[hut.cell]).toBe(hut.id);

    buildings.remove(hut, "abandoned");

    expect(world.occupancy[hut.cell]).toBe(NO_BUILDING);
    expect(buildings.takeLosses()).toEqual([{ building: hut, reason: "abandoned" }]);
  });

  it("catch fire from a wildfire and burn down", () => {
    const { buildings, fire, world } = createBuildings();

    const tent = buildings.add({ kind: "tent", rotation: 0, tribeId: 1, x: 5, z: 5 }, createRandom(1));

    tent.progress = 1;
    world.fields.fire[tent.cell] = 0.5;

    for (let step = 0; step < 400; step += 1) {
      buildings.update(tickOf(fire));
    }

    expect(buildings.all).toHaveLength(0);
    expect(buildings.takeIncidents()).toEqual([expect.objectContaining({ kind: "caughtFire" })]);
    expect(buildings.takeLosses()).toEqual([expect.objectContaining({ reason: "burnt" })]);
    expect(world.fields.scorch[tent.cell]).toBe(1);
  });

  it("break apart in a blast", () => {
    const { buildings } = createBuildings();

    buildings.add({ kind: "storehouse", rotation: 0, tribeId: 1, x: 5, z: 5 }, createRandom(1));
    buildings.damageArea(5, 5, 50, 500, false);

    expect(buildings.all).toHaveLength(0);
  });

  it("let a campfire burn down its fuel", () => {
    const { buildings, fire } = createBuildings();

    const campfire = buildings.add({ kind: "campfire", rotation: 0, tribeId: 1, x: 5, z: 5 }, createRandom(1));

    campfire.progress = 1;

    expect(isCampfireLit(campfire)).toBe(true);

    buildings.update(tickOf(fire, { days: 2 }));

    expect(isCampfireLit(campfire)).toBe(false);
  });
});

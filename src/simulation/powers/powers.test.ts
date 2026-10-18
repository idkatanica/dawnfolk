import { describe, expect, it } from "vitest";
import { Ground } from "../../content/grounds.ts";
import { PlantSpecies } from "../../content/plants.ts";
import { POWER_ORDER, POWERS } from "../../content/powers.ts";
import { WorldGrid } from "../../world/world-grid.ts";
import { Simulation } from "../simulation.ts";
import { createVegetatedWorld, monumentAround, plantsTooSteep, steepeningRamp } from "../testing/test-world.ts";
import { POWER_HANDLERS, parsePowerParameters } from "./power-registry.ts";

function createSimulation(baseTemperature = 15): Simulation {
  return new Simulation(createVegetatedWorld({ baseTemperature, dimensions: { cellSize: 10, cellsPerSide: 96 } }));
}

function brush(simulation: Simulation, powerId: Parameters<Simulation["beginStroke"]>[0], seconds: number) {
  simulation.beginStroke(powerId, 0, 0, {});

  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) {
    simulation.advance(0.05);
  }

  simulation.endStroke();
}

function centerCell(simulation: Simulation): number {
  return simulation.world.grid.cellAt(0, 0);
}

describe("power registry", () => {
  it("has a handler and valid defaults for every power", () => {
    for (const powerId of POWER_ORDER) {
      expect(POWER_HANDLERS[powerId]).toBeDefined();
      expect(parsePowerParameters(powerId, {})).toEqual(POWERS[powerId].parameters.parse({}));
    }
  });

  it("rejects parameters outside their range", () => {
    expect(parsePowerParameters("fire", { radius: 9000 })).toBeNull();
  });
});

describe("elements", () => {
  it("rain puts out fire and soaks the ground", () => {
    const simulation = createSimulation();

    simulation.usePower("fire", 0, 0, { radius: 30 });
    brush(simulation, "rain", 4);

    expect(simulation.fire.burningCount).toBe(0);
    expect(simulation.world.fields.wetness[centerCell(simulation)]).toBeGreaterThan(0.5);
  });

  it("snow covers the ground", () => {
    const simulation = createSimulation();

    brush(simulation, "snow", 1);

    expect(simulation.world.fields.snow[centerCell(simulation)]).toBeGreaterThan(0.3);
  });

  it("lightning strikes, scorches and starts a fire", () => {
    const simulation = createSimulation();

    simulation.usePower("lightning", 0, 0, { ignitionChance: 100 });

    expect(simulation.advance(0).effects).toEqual([expect.objectContaining({ isNatural: false, kind: "lightning" })]);
    expect(simulation.fire.burningCount).toBeGreaterThan(0);
  });

  it("an explosion leaves a crater and kills animals around it", () => {
    const simulation = createSimulation();

    simulation.fauna.spawnHerd("deer", 20, 0, 3, simulation.random);
    simulation.usePower("explosion", 0, 0, {});

    expect(simulation.world.terrain.height[centerCell(simulation)]).toBeLessThan(95);
    expect(simulation.fauna.livingCount).toBe(0);
  });

  it("an earthquake shakes the land and breaks buildings", () => {
    const simulation = createSimulation();

    const hut = simulation.buildings.add({ kind: "tent", rotation: 0, tribeId: 0, x: 30, z: 0 }, simulation.random);

    hut.progress = 1;
    simulation.usePower("earthquake", 0, 0, { magnitude: 100 });

    expect(simulation.buildings.all).toHaveLength(0);
    expect(simulation.advance(0).effects).toEqual([expect.objectContaining({ kind: "earthquake" })]);
  });

  it("names the earthquake when it kills someone", () => {
    const simulation = createSimulation();

    simulation.usePower("tribe", 0, 0, {});

    const [tribe] = simulation.society.tribes();

    for (const person of simulation.society.membersOf(tribe)) {
      person.health = 0.05;
    }

    simulation.usePower("earthquake", tribe.campX, tribe.campZ, { magnitude: 100 });

    expect(simulation.chronicle.takeEntries()).toContainEqual(
      expect.objectContaining({ text: expect.stringContaining("crushed in an earthquake") })
    );
  });
});

describe("land", () => {
  it("flatten pulls the land towards where the stroke began", () => {
    const simulation = createSimulation();

    const cell = simulation.world.grid.cellAt(30, 0);

    simulation.world.setHeight(cell, 140);
    brush(simulation, "flatten", 2);

    expect(simulation.world.terrain.height[cell]).toBeLessThan(110);
  });

  it("smooth softens a spike", () => {
    const simulation = createSimulation();

    simulation.world.setHeight(centerCell(simulation), 180);
    brush(simulation, "smooth", 1);

    expect(simulation.world.terrain.height[centerCell(simulation)]).toBeLessThan(120);
  });

  it("paint changes the ground and clears plants from rock", () => {
    const simulation = createSimulation();

    simulation.beginStroke("paint", 0, 0, { material: "rock", radius: 40 });
    simulation.endStroke();

    expect(simulation.world.terrain.ground[centerCell(simulation)]).toBe(Ground.Rock);
    expect(simulation.world.vegetation.hasPlantsInCell(centerCell(simulation))).toBe(false);
  });

  it("forest plants the chosen trees", () => {
    const simulation = createSimulation();

    const before = simulation.world.vegetation.aliveCount;

    simulation.beginStroke("forest", 0, 0, { density: 100, species: "birch" });

    for (let step = 0; step < 40; step += 1) {
      simulation.advance(0.05);
    }

    expect(simulation.world.vegetation.aliveCount).toBeGreaterThan(before + 20);
  });

  it("forest plants every tree only on ground gentle enough for it", () => {
    const simulation = new Simulation(
      createVegetatedWorld({ dimensions: { cellSize: 10, cellsPerSide: 96 }, heightAt: steepeningRamp(1.4, 480) })
    );
    const { vegetation } = simulation.world;

    const before = vegetation.aliveCount;

    for (const x of [-300, -100, 100, 300]) {
      simulation.beginStroke("forest", x, 0, { density: 100, radius: 120, species: "climate" });

      for (let step = 0; step < 40; step += 1) {
        simulation.advance(0.05);
      }

      simulation.endStroke();
    }

    expect(vegetation.aliveCount).toBeGreaterThan(before + 100);
    expect(plantsTooSteep(simulation.world)).toEqual([]);
  });

  it("forest plants nothing on monument ground", () => {
    const dimensions = { cellSize: 10, cellsPerSide: 96 };
    const ruin = monumentAround(new WorldGrid(dimensions), 0, 0, 50);
    const simulation = new Simulation(createVegetatedWorld({ dimensions, monuments: [ruin] }));
    const { vegetation } = simulation.world;

    const before = vegetation.count;

    simulation.beginStroke("forest", 0, 0, { density: 100, radius: 120, species: "oak" });

    for (let step = 0; step < 40; step += 1) {
      simulation.advance(0.05);
    }

    simulation.endStroke();

    const planted = Array.from({ length: vegetation.count - before }, (_, index) => vegetation.cell[before + index]);

    expect(planted.length).toBeGreaterThan(20);
    expect(planted.filter((cell) => simulation.world.isObstructed(cell))).toEqual([]);
  });

  it("forest suited to a hot climate grows acacias and palms", () => {
    const simulation = createSimulation(20);
    const { vegetation } = simulation.world;

    const before = vegetation.count;

    simulation.beginStroke("forest", 0, 0, { density: 100, species: "climate" });

    for (let step = 0; step < 40; step += 1) {
      simulation.advance(0.05);
    }

    const planted = Array.from({ length: vegetation.count - before }, (_, index) => vegetation.species[before + index]);

    expect(planted.length).toBeGreaterThan(20);
    expect(planted.every((species) => species === PlantSpecies.Acacia || species === PlantSpecies.Palm)).toBe(true);
  });
});

describe("life", () => {
  it("brings a tribe that settles near the click", () => {
    const simulation = createSimulation();

    simulation.usePower("tribe", 100, 100, { people: 5 });

    expect(simulation.society.population).toBe(5);
  });

  it("brings herds of deer and mammoths", () => {
    const simulation = createSimulation();

    simulation.usePower("deer", 0, 0, { herdSize: 4 });
    simulation.usePower("mammoth", 100, 0, { herdSize: 2 });

    expect(simulation.fauna.livingCount).toBe(6);
  });

  it("abundance fills bushes and feeds the nearest tribe", () => {
    const simulation = createSimulation();

    simulation.usePower("tribe", 0, 0, { people: 4 });

    const [tribe] = simulation.society.tribes();

    const foodBefore = tribe.stock.food;

    simulation.usePower("abundance", tribe.campX, tribe.campZ, {});

    expect(tribe.stock.food).toBeGreaterThan(foodBefore);
  });

  it("inspiration brings the next discovery closer", () => {
    const simulation = createSimulation();

    simulation.usePower("tribe", 0, 0, { people: 4 });

    const [tribe] = simulation.society.tribes();

    simulation.usePower("inspiration", tribe.campX, tribe.campZ, { strength: 100 });
    simulation.advance(0.1);

    expect(tribe.technologies.has("fire")).toBe(true);
  });

  it("healing restores everyone in the circle", () => {
    const simulation = createSimulation();

    simulation.usePower("tribe", 0, 0, { people: 4 });

    for (const person of simulation.society.people) {
      person.health = 0.2;
      person.hunger = 0.9;
    }

    const [tribe] = simulation.society.tribes();

    simulation.usePower("healing", tribe.campX, tribe.campZ, { radius: 200 });

    expect(simulation.society.people.every((person) => person.health === 1 && person.hunger <= 0.2)).toBe(true);
  });

  it("explains when healing finds nobody", () => {
    const simulation = createSimulation();

    simulation.usePower("healing", 0, 0, {});

    expect(simulation.takeNotices()).toEqual(["There is nobody inside the circle to heal."]);
  });
});

import { describe, expect, it } from "vitest";
import { Ground } from "../../content/grounds.ts";
import { PlantSpecies } from "../../content/plants.ts";
import { WorldGrid } from "../../world/world-grid.ts";
import { Simulation } from "../simulation.ts";
import { brush, createPowerSimulation } from "../testing/test-powers.ts";
import {
  centerCell,
  createVegetatedWorld,
  monumentAround,
  plantsTooSteep,
  steepeningRamp,
} from "../testing/test-world.ts";

describe("land", () => {
  it("flatten pulls the land towards where the stroke began", () => {
    const simulation = createPowerSimulation();

    const cell = simulation.world.grid.cellAt(30, 0);

    simulation.world.setHeight(cell, 140);
    brush(simulation, "flatten", 2);

    expect(simulation.world.terrain.height[cell]).toBeLessThan(110);
  });

  it("smooth softens a spike", () => {
    const simulation = createPowerSimulation();

    simulation.world.setHeight(centerCell(simulation.world), 180);
    brush(simulation, "smooth", 1);

    expect(simulation.world.terrain.height[centerCell(simulation.world)]).toBeLessThan(120);
  });

  it("paint changes the ground and clears plants from rock", () => {
    const simulation = createPowerSimulation();

    simulation.beginStroke("paint", 0, 0, { material: "rock", radius: 40 });
    simulation.endStroke();

    expect(simulation.world.terrain.ground[centerCell(simulation.world)]).toBe(Ground.Rock);
    expect(simulation.world.vegetation.hasPlantsInCell(centerCell(simulation.world))).toBe(false);
  });

  it("forest plants the chosen trees", () => {
    const simulation = createPowerSimulation();

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

    const planted = Array.from({ length: vegetation.count - before }, (_, index) => {
      return vegetation.cell[before + index];
    });

    expect(planted.length).toBeGreaterThan(20);
    expect(
      planted.filter((cell) => {
        return simulation.world.isObstructed(cell);
      })
    ).toEqual([]);
  });

  it("forest suited to a hot climate grows acacias and palms", () => {
    const simulation = createPowerSimulation(20);
    const { vegetation } = simulation.world;

    const before = vegetation.count;

    simulation.beginStroke("forest", 0, 0, { density: 100, species: "climate" });

    for (let step = 0; step < 40; step += 1) {
      simulation.advance(0.05);
    }

    const planted = Array.from({ length: vegetation.count - before }, (_, index) => {
      return vegetation.species[before + index];
    });

    expect(planted.length).toBeGreaterThan(20);
    expect(
      planted.every((species) => {
        return species === PlantSpecies.Acacia || species === PlantSpecies.Palm;
      })
    ).toBe(true);
  });
});

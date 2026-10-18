import { describe, expect, it } from "vitest";
import { plantSpeciesDefinition } from "../../content/plants.ts";
import { Simulation } from "../simulation.ts";
import { createVegetatedWorld } from "../testing/test-world.ts";

const VALLEY_SIDES = 0.25;
const VALLEY_FALL = 0.02;
const METEOR_Z = -200;

function valleyHeight(x: number, z: number): number {
  return 200 + Math.abs(x - 5) * VALLEY_SIDES + z * VALLEY_FALL;
}

function createValley(): Simulation {
  const simulation = new Simulation(
    createVegetatedWorld({ dimensions: { cellSize: 10, cellsPerSide: 96 }, heightAt: valleyHeight })
  );

  simulation.weather.setKind("clear");
  simulation.waterRecomputation.recompute();

  return simulation;
}

function settle(simulation: Simulation, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.1) {
    simulation.advance(0.1);
  }
}

function waterCellsWithin(simulation: Simulation, x: number, z: number, radius: number): number {
  const { world } = simulation;

  return world.grid.cellsInRadius(x, z, radius).filter((cell) => world.isWater(cell)).length;
}

function depthAt(simulation: Simulation, x: number, z: number): number {
  return simulation.world.waterDepth(simulation.world.grid.cellAt(x, z));
}

describe("water after a blast", () => {
  it("runs a river down the valley before anything happens", () => {
    const simulation = createValley();

    expect(simulation.world.water.rivers.length).toBeGreaterThan(0);
    expect(simulation.world.isWaterAt(0, 0)).toBe(true);
    expect(simulation.world.water.lakes).toHaveLength(0);
  });

  it("fills an explosion crater on a river as a pond and lets the river flow on", () => {
    const simulation = createValley();

    simulation.usePower("explosion", 0, 0, {});
    settle(simulation, 8);

    expect(simulation.world.water.lakes).toHaveLength(1);
    expect(depthAt(simulation, 0, 0)).toBeGreaterThan(5);
    expect(simulation.world.isWaterAt(0, -250)).toBe(true);
  });

  it("starts filling a crater lake at once and fills it over a few seconds", () => {
    const simulation = createValley();

    simulation.usePower("meteor", 0, METEOR_Z, { craterRadius: 140, fallTime: 0.5 });
    settle(simulation, 0.7);

    const early = waterCellsWithin(simulation, 0, METEOR_Z, 120);

    settle(simulation, 1.5);

    const later = waterCellsWithin(simulation, 0, METEOR_Z, 120);

    settle(simulation, 6);

    const full = waterCellsWithin(simulation, 0, METEOR_Z, 120);

    expect(simulation.waterRecomputation.isPending).toBe(false);
    expect(early).toBeLessThan(later);
    expect(later).toBeLessThan(full);
    expect(full).toBeGreaterThan(300);
    expect(depthAt(simulation, 0, METEOR_Z)).toBeGreaterThan(30);
  });

  it("dams a river that the rim of a nearby crater falls across", () => {
    const simulation = createValley();

    const before = simulation.world.water.lakes.length;

    simulation.usePower("explosion", 50, 0, { radius: 45 });
    settle(simulation, 8);

    const upstream = simulation.world.water.lakes.filter((lake) => lake.centerZ > 0 && Math.abs(lake.centerX) < 80);

    expect(simulation.world.water.lakes.length).toBeGreaterThan(before);
    expect(upstream.length).toBeGreaterThan(0);
  });

  it("drowns the plants that the rising water reaches", () => {
    const simulation = createValley();
    const { vegetation } = simulation.world;

    simulation.usePower("meteor", 0, METEOR_Z, { craterRadius: 140, fallTime: 0.5 });
    settle(simulation, 10);

    const drowned = Array.from({ length: vegetation.count }, (_, plant) => plant).filter((plant) => {
      const { form } = plantSpeciesDefinition(vegetation.species[plant]);

      const isGrowing = form !== "stone" && form !== "monument";

      return isGrowing && vegetation.isAlive(plant) && simulation.world.touchesWater(vegetation.cell[plant]);
    });

    expect(drowned).toEqual([]);
  });
});

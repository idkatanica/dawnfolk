import { describe, expect, it } from "vitest";
import { Biome } from "../../content/biomes.ts";
import { Ground } from "../../content/grounds.ts";
import { isTreeSpecies, PlantSpecies, plantSpeciesDefinition } from "../../content/plants.ts";
import { PlantState } from "../../world/vegetation-store.ts";
import { Simulation } from "../simulation.ts";
import { createVegetatedWorld, floodCells, plantInCell } from "../testing/test-world.ts";

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

function createForest(): Simulation {
  const simulation = new Simulation(
    createVegetatedWorld({ biome: Biome.Forest, dimensions: { cellSize: 10, cellsPerSide: 96 }, ground: Ground.Forest })
  );

  simulation.weather.setKind("clear");
  simulation.weather.setWind(0, 0);

  return simulation;
}

function treesWithin(simulation: Simulation, radius: number, state: number): number {
  const { vegetation } = simulation.world;

  let count = 0;

  for (let plant = 0; plant < vegetation.count; plant += 1) {
    const isNear = Math.hypot(vegetation.x[plant], vegetation.z[plant]) < radius;

    if (isNear && vegetation.state[plant] === state && isTreeSpecies(vegetation.species[plant])) {
      count += 1;
    }
  }

  return count;
}

function standingTreesOnScorchedGround(simulation: Simulation): number {
  const { fields, vegetation } = simulation.world;

  let count = 0;

  for (let plant = 0; plant < vegetation.count; plant += 1) {
    const isScorched = fields.scorch[vegetation.cell[plant]] > 0.05;

    if (isScorched && vegetation.isAlive(plant) && isTreeSpecies(vegetation.species[plant])) {
      count += 1;
    }
  }

  return count;
}

describe("fire after a blast", () => {
  it("fells the trees around the crater outward and sets the forest beyond burning", () => {
    const simulation = createForest();

    simulation.usePower("explosion", 0, 0, { radius: 45 });

    expect(treesWithin(simulation, 50, PlantState.Alive)).toBe(0);
    expect(treesWithin(simulation, 60, PlantState.Fallen)).toBeGreaterThan(10);
    expect(simulation.fire.burningCount).toBeGreaterThan(60);
  });

  it("lays the felled trees down pointing away from the blast", () => {
    const simulation = createForest();
    const { vegetation } = simulation.world;

    simulation.usePower("explosion", 0, 0, { radius: 45 });

    for (let plant = 0; plant < vegetation.count; plant += 1) {
      if (vegetation.state[plant] !== PlantState.Fallen) {
        continue;
      }

      const outward = Math.atan2(vegetation.x[plant], vegetation.z[plant]);
      const turn = Math.atan2(
        Math.sin(vegetation.rotation[plant] - outward),
        Math.cos(vegetation.rotation[plant] - outward)
      );

      expect(Math.abs(turn)).toBeLessThan(0.3);
    }
  });

  it("burns the forest around the crater and leaves no green tree on scorched ground", () => {
    const simulation = createForest();

    const before = treesWithin(simulation, 85, PlantState.Alive);

    simulation.usePower("explosion", 0, 0, { radius: 45 });

    expect(standingTreesOnScorchedGround(simulation)).toBe(0);

    simulation.runTicks(3000);

    expect(simulation.fire.burningCount).toBeLessThan(40);
    expect(treesWithin(simulation, 85, PlantState.Alive)).toBeLessThan(before * 0.2);
    expect(standingTreesOnScorchedGround(simulation)).toBe(0);
  });

  it("throws burning debris that starts fires beyond the ring", () => {
    const simulation = createForest();

    simulation.usePower("explosion", 0, 0, { radius: 45 });

    const flights = simulation.advance(0).effects.filter((effect) => effect.kind === "ember");

    expect(flights.length).toBeGreaterThan(5);
    expect(simulation.embers.flying.length).toBe(flights.length);
  });

  it("starts no fire when the debris is not burning", () => {
    const simulation = createForest();

    simulation.usePower("explosion", 0, 0, { burningDebris: false, radius: 45 });
    settle(simulation, 5);

    expect(simulation.fire.burningCount).toBe(0);
    expect(standingTreesOnScorchedGround(simulation)).toBe(0);
  });

  it("starts no fire from a blast in a lake", () => {
    const simulation = createForest();
    const { grid } = simulation.world;

    floodCells(simulation.world, grid.cellsInRadius(0, 0, 70), 6);
    simulation.usePower("explosion", 0, 0, { radius: 45 });
    settle(simulation, 3);

    expect(simulation.fire.burningCount).toBe(0);
    expect(simulation.embers.flying).toHaveLength(0);
  });

  it("burns nothing on bare rock", () => {
    const simulation = new Simulation(
      createVegetatedWorld({
        biome: Biome.Glacier,
        dimensions: { cellSize: 10, cellsPerSide: 96 },
        ground: Ground.Rock,
      })
    );

    simulation.usePower("explosion", 0, 0, { radius: 45 });
    settle(simulation, 5);

    expect(simulation.fire.burningCount).toBe(0);
  });

  it("shatters big rocks near the crater into smaller ones", () => {
    const simulation = createForest();
    const { grid, vegetation } = simulation.world;

    function boulders(isWanted: (height: number) => boolean): number {
      let count = 0;

      for (let plant = 0; plant < vegetation.count; plant += 1) {
        const isNear = Math.hypot(vegetation.x[plant] - 45, vegetation.z[plant] - 5) < 25;

        if (isNear && vegetation.isAlive(plant) && vegetation.species[plant] === PlantSpecies.Boulder) {
          count += isWanted(vegetation.height[plant]) ? 1 : 0;
        }
      }

      return count;
    }

    const boulder = plantInCell(simulation.world, grid.cellAt(42, 0), PlantSpecies.Boulder);

    vegetation.height[boulder] = 3.5;
    simulation.usePower("explosion", 0, 0, { radius: 45 });

    expect(boulders((height) => height > 3)).toBe(0);
    expect(boulders((height) => height < 1.6)).toBeGreaterThan(1);
  });
});

describe("earthquakes", () => {
  it("throw trees down instead of making them vanish", () => {
    const simulation = createForest();

    simulation.usePower("earthquake", 0, 0, { magnitude: 100, radius: 300 });

    expect(treesWithin(simulation, 300, PlantState.Fallen)).toBeGreaterThan(20);
  });
});

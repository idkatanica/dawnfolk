import { describe, expect, it } from "vitest";
import { DEFAULT_GENERATION_OPTIONS, type GenerationOptions } from "../generation/generation-options.ts";
import { Simulation, type SimulationSnapshot } from "./simulation.ts";

const SEED = 11;
const OPTIONS: GenerationOptions = { ...DEFAULT_GENERATION_OPTIONS, dimensions: { cellSize: 20, cellsPerSide: 128 } };
const SETTLING_SECONDS = 12;

function generate(): Simulation {
  return Simulation.generate(SEED, OPTIONS, () => undefined);
}

function settle(simulation: Simulation): void {
  for (let elapsed = 0; elapsed < SETTLING_SECONDS && simulation.isBusy; elapsed += 0.25) {
    simulation.advance(0.25);
  }
}

function grownSimulation(): Simulation {
  const simulation = generate();

  simulation.populate();
  simulation.execute({ speed: 16, type: "setSpeed" });

  for (const tribe of simulation.society.tribes()) {
    tribe.technologies.add("fire");
    tribe.technologies.add("shelter");
  }

  simulation.runTicks(300);
  simulation.execute({ parameters: { radius: 60 }, powerId: "raise", type: "usePower", x: 120, z: -80 });
  simulation.execute({ parameters: { radius: 30 }, powerId: "fire", type: "usePower", x: -150, z: 90 });
  settle(simulation);
  simulation.runTicks(300);

  return simulation;
}

function snapshotOf(simulation: Simulation): SimulationSnapshot {
  const snapshot = simulation.snapshot();

  if (snapshot === null) {
    throw new Error("The simulation was busy");
  }

  return snapshot;
}

function restored(snapshot: SimulationSnapshot): Simulation {
  const simulation = generate();

  simulation.restore(structuredClone(snapshot));

  return simulation;
}

function plantsByCell(simulation: Simulation): number[][] {
  const { grid, vegetation } = simulation.world;

  return Array.from({ length: grid.cellCount }, (_, cell) => vegetation.plantsInCell(cell));
}

describe("world snapshots", () => {
  it("restores a grown world into a fresh island from the same seed", () => {
    const original = grownSimulation();
    const snapshot = snapshotOf(original);

    const copy = restored(snapshot);

    expect(original.society.population).toBeGreaterThan(0);
    expect(original.buildings.all.length).toBeGreaterThan(0);
    expect(original.fire.burningCount).toBeGreaterThan(0);
    expect(original.world.heightVersion).toBeGreaterThan(0);
    expect(snapshotOf(copy)).toStrictEqual(snapshot);
  });

  it("keeps the world going after a restore", () => {
    const original = grownSimulation();
    const snapshot = snapshotOf(original);

    const copy = restored(snapshot);

    const tribeIds = copy.society.tribes().map((tribe) => tribe.id);

    expect(tribeIds).toEqual(original.society.tribes().map((tribe) => tribe.id));
    expect(copy.society.population).toBe(original.society.population);
    expect(copy.buildings.all.map((building) => building.id)).toEqual(
      original.buildings.all.map((building) => building.id)
    );
    expect(copy.world.vegetation.aliveCount).toBe(original.world.vegetation.aliveCount);
    expect(plantsByCell(copy)).toStrictEqual(plantsByCell(original));
    expect(copy.world.terrain).toStrictEqual(original.world.terrain);
    expect(copy.calendar.view()).toEqual(original.calendar.view());

    copy.runTicks(600);

    expect(copy.tick).toBe(original.tick + 600);
    expect(copy.society.tribes().length).toBeGreaterThan(0);
    expect(copy.calendar.day).toBeGreaterThan(original.calendar.day);

    for (const tribe of copy.society.tribes()) {
      if (tribeIds.includes(tribe.id)) {
        expect(tribe.technologies.has("fire")).toBe(true);
      }
    }
  });

  it("sends the restored world to the renderer in full", () => {
    const original = grownSimulation();

    const copy = restored(snapshotOf(original));

    const initial = copy.initialWorld();

    expect(initial.terrain.height).toEqual(original.world.terrain.height);
    expect(initial.terrain.waterSurface).toEqual(original.world.terrain.waterSurface);
    expect(initial.vegetation.count).toBe(original.world.vegetation.count);
    expect(initial.frame.buildings).toHaveLength(original.buildings.all.length);
    expect(initial.frame.personCount).toBe(original.society.people.length);
    expect(initial.frame.tribes.map((tribe) => tribe.id)).toEqual(original.society.tribes().map((tribe) => tribe.id));
  });

  it("drops jobs and claims that cannot be saved", () => {
    const original = grownSimulation();

    const snapshot = snapshotOf(original);

    expect(snapshot.society.people.every((person) => person.job === null)).toBe(true);
    expect(snapshot.society.tribes.every((tribe) => tribe.claimedPlants.size === 0)).toBe(true);
  });

  it("refuses to save while the land is still settling", () => {
    const simulation = generate();

    simulation.execute({ parameters: { radius: 60 }, powerId: "raise", type: "usePower", x: 0, z: 0 });
    simulation.advance(0.05);

    expect(simulation.isBusy).toBe(true);
    expect(simulation.snapshot()).toBeNull();
  });
});

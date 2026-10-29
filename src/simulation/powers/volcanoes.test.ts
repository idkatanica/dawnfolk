import { describe, expect, it } from "vitest";
import { Ground } from "../../content/grounds.ts";
import { Simulation } from "../simulation.ts";
import { snapshotOf } from "../testing/test-simulation.ts";
import { createVegetatedWorld, floodCells } from "../testing/test-world.ts";
import { COOLING_SECONDS, SWELL_SECONDS, type Volcano } from "./volcanoes.ts";

const RADIUS = 100;
const BASE_HEIGHT = 100;
const FALL_PER_METER = 0.08;
const RIVER_START = 260;

interface VolcanoWorld {
  hasRiver: boolean;
}

function floodRiver(simulation: Simulation): void {
  const { grid } = simulation.world;

  floodCells(
    simulation.world,
    grid.cellsInRadius(0, 0, grid.worldSize).filter((cell) => grid.cellCenterX(cell) > RIVER_START),
    1
  );
}

function createSimulation({ hasRiver }: VolcanoWorld): Simulation {
  const simulation = new Simulation(
    createVegetatedWorld({
      dimensions: { cellSize: 10, cellsPerSide: 96 },
      heightAt: (x) => BASE_HEIGHT - x * FALL_PER_METER,
    })
  );

  simulation.weather.setKind("clear");

  if (hasRiver) {
    floodRiver(simulation);
  }

  return simulation;
}

function runFor(simulation: Simulation, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.1) {
    simulation.advance(0.1);
  }
}

function settle(simulation: Simulation): void {
  for (let elapsed = 0; elapsed < 10 && simulation.isBusy; elapsed += 0.1) {
    simulation.advance(0.1);
  }
}

function onlyVolcano(simulation: Simulation): Volcano {
  const [volcano] = simulation.volcanoes.all;

  if (volcano === undefined) {
    throw new Error("Expected a volcano");
  }

  return volcano;
}

function erupt(world: VolcanoWorld, strength = 60): Simulation {
  const simulation = createSimulation(world);

  simulation.execute({ parameters: { radius: RADIUS, strength }, powerId: "volcano", type: "usePower", x: 0, z: 0 });

  return simulation;
}

describe("volcanoes", () => {
  it("swells the ground into a cone with a crater on top", () => {
    const simulation = erupt({ hasRiver: false });
    const { world } = simulation;

    runFor(simulation, SWELL_SECONDS + 0.5);

    const summit = world.heightAt(RADIUS * 0.2, 0) - (BASE_HEIGHT - RADIUS * 0.2 * FALL_PER_METER);
    const crater = world.heightAt(0, 0) - BASE_HEIGHT;
    const flank = world.heightAt(0, RADIUS * 0.6) - BASE_HEIGHT;
    const outside = world.heightAt(0, RADIUS * 1.2) - BASE_HEIGHT;

    expect(summit).toBeGreaterThan(RADIUS * 0.35);
    expect(crater).toBeLessThan(summit - 5);
    expect(flank).toBeGreaterThan(3);
    expect(flank).toBeLessThan(summit);
    expect(outside).toBeCloseTo(0, 5);
  });

  it("sends lava downhill along the same cells every time", () => {
    const first = erupt({ hasRiver: false });
    const second = erupt({ hasRiver: false });

    runFor(first, SWELL_SECONDS + 20);
    runFor(second, SWELL_SECONDS + 20);

    const volcano = onlyVolcano(first);
    const { terrain } = first.world;

    expect([...volcano.lava.keys()]).toEqual([...onlyVolcano(second).lava.keys()]);
    expect(volcano.tongues.length).toBeGreaterThanOrEqual(2);

    for (const tongue of volcano.tongues) {
      expect(tongue.cells.length).toBeGreaterThan(4);

      for (let step = 1; step < tongue.cells.length; step += 1) {
        expect(terrain.height[tongue.cells[step]]).toBeLessThanOrEqual(terrain.height[tongue.cells[step - 1]] + 1.5);
      }

      const [start] = tongue.cells;
      const end = tongue.cells.at(-1);

      expect(end).toBeDefined();
      expect(terrain.height[end === undefined ? start : end]).toBeLessThan(terrain.height[start] - 10);
    }
  });

  it("sets what it touches on fire and turns its path to lava rock", () => {
    const simulation = erupt({ hasRiver: false });

    runFor(simulation, SWELL_SECONDS + 10);

    const volcano = onlyVolcano(simulation);
    const { terrain } = simulation.world;

    expect(simulation.fire.burningCount).toBeGreaterThan(0);
    expect(simulation.embers.flying.length).toBeGreaterThan(0);
    expect([...volcano.lava.keys()].every((cell) => terrain.ground[cell] === Ground.Basalt)).toBe(true);
    expect(simulation.advance(0).lava.cells.length).toBe(volcano.lava.size);
  });

  it("hisses to steam and stops where it meets water", () => {
    const simulation = erupt({ hasRiver: false }, 100);
    const { world } = simulation;

    runFor(simulation, SWELL_SECONDS);
    settle(simulation);
    floodRiver(simulation);
    runFor(simulation, 60);

    const volcano = onlyVolcano(simulation);
    const quenched = volcano.tongues.filter((tongue) => tongue.quenchedCell >= 0);

    expect(quenched.length).toBeGreaterThan(0);
    expect(quenched.every((tongue) => world.isWater(tongue.quenchedCell))).toBe(true);
    expect([...volcano.lava.keys()].some((cell) => world.isWater(cell))).toBe(false);
    expect(simulation.advance(0).volcanoes[0].steam.length).toBeGreaterThan(0);
  });

  it("cools into rock and leaves fertile ash that regrows sooner", () => {
    const simulation = erupt({ hasRiver: false }, 5);
    const { world } = simulation;

    runFor(simulation, SWELL_SECONDS + 5);

    const lavaCells = [...onlyVolcano(simulation).lava.keys()];

    runFor(simulation, 30 + COOLING_SECONDS * 1.4);

    const ashCells = world.grid.cellsInRadius(0, 0, RADIUS).filter((cell) => world.terrain.ground[cell] === Ground.Ash);

    expect(simulation.volcanoes.all).toHaveLength(0);
    expect(simulation.advance(0).lava.cells).toHaveLength(0);
    expect(lavaCells.every((cell) => world.terrain.ground[cell] === Ground.Basalt)).toBe(true);
    expect(ashCells.length).toBeGreaterThan(50);
    expect(ashCells.every((cell) => world.recovering.has(cell))).toBe(true);
  });

  it("kills people and animals that stand in hot lava", () => {
    const simulation = erupt({ hasRiver: false });

    simulation.execute({ parameters: { herdSize: 3 }, powerId: "deer", type: "usePower", x: -300, z: -300 });
    simulation.execute({ parameters: { people: 3 }, powerId: "tribe", type: "usePower", x: -300, z: 300 });
    runFor(simulation, SWELL_SECONDS + 5);

    const [lavaCell] = onlyVolcano(simulation).lava.keys();
    const [person] = simulation.society.people;
    const [animal] = simulation.fauna.animals;
    const { grid } = simulation.world;

    expect(lavaCell).toBeDefined();
    expect(person).toBeDefined();
    expect(animal).toBeDefined();

    for (const mover of [person.mover, animal.mover]) {
      mover.x = grid.cellCenterX(lavaCell === undefined ? 0 : lavaCell);
      mover.z = grid.cellCenterZ(lavaCell === undefined ? 0 : lavaCell);
    }

    simulation.step();

    expect(person.isAlive).toBe(false);
    expect(person.causeOfDeath).toBe("lava");
    expect(animal.isAlive).toBe(false);
  });

  it("lets ash soil heal and regrow faster than ordinary ground", () => {
    const simulation = createSimulation({ hasRiver: false });
    const { grid, fields } = simulation.world;

    const ash = grid.cellAt(-200, 0);
    const meadow = grid.cellAt(200, 0);

    simulation.world.setGround(ash, Ground.Ash);

    for (const cell of [ash, meadow]) {
      fields.scorch[cell] = 0.8;
      simulation.world.markSurfaceCell(cell);
    }

    simulation.execute({ seconds: 60, type: "setDaySeconds" });
    simulation.runTicks(600);

    expect(fields.scorch[meadow]).toBeGreaterThan(0.3);
    expect(fields.scorch[ash]).toBeLessThan(fields.scorch[meadow] - 0.3);
  });

  it("refuses to rise out of water", () => {
    const simulation = createSimulation({ hasRiver: true });

    simulation.execute({ parameters: { radius: RADIUS }, powerId: "volcano", type: "usePower", x: 400, z: 0 });

    expect(simulation.volcanoes.all).toHaveLength(0);
    expect(simulation.takeNotices()).toEqual(["A volcano needs dry land"]);
  });

  it("saves and loads in the middle of an eruption", () => {
    const simulation = erupt({ hasRiver: true });

    runFor(simulation, SWELL_SECONDS + 4);
    settle(simulation);

    const snapshot = snapshotOf(simulation);
    const loaded = createSimulation({ hasRiver: true });

    loaded.restore(structuredClone(snapshot));

    expect(onlyVolcano(loaded)).toEqual(onlyVolcano(simulation));

    runFor(simulation, 8);
    runFor(loaded, 8);

    expect([...onlyVolcano(loaded).lava.keys()]).toEqual([...onlyVolcano(simulation).lava.keys()]);
    expect(onlyVolcano(loaded).age).toBeCloseTo(onlyVolcano(simulation).age, 5);
  });

  it("loads saves made before volcanoes existed", () => {
    const simulation = erupt({ hasRiver: false });

    runFor(simulation, SWELL_SECONDS + 2);
    settle(simulation);

    const { volcanoes: _volcanoes, ...olderSnapshot } = snapshotOf(simulation);
    const loaded = createSimulation({ hasRiver: false });

    loaded.restore(structuredClone(olderSnapshot));

    expect(loaded.volcanoes.all).toHaveLength(0);
  });
});

import { describe, expect, it as test } from "vitest";
import { DEFAULT_GENERATION_OPTIONS } from "../generation/generation-options.ts";
import { generateWorld } from "../generation/world-generator.ts";
import type { IslandShapeKind } from "../world/island-shape.ts";
import { isHopping } from "./agents/hops.ts";
import { Simulation } from "./simulation.ts";
import { floodCells } from "./testing/test-world.ts";
import { TICK_SECONDS } from "./tick.ts";

const RUN_SECONDS = 600;
const LONGEST_SPELL_IN_WATER = 5;
const SETTLERS_BY_CROSSINGS = 2;
const FLOOD_RADIUS = 45;
const FLOOD_DEPTH = 1.6;
const SECONDS_TO_SWIM_OUT = 75;

interface Walker {
  readonly id: number;
  readonly isHopping: boolean;
  readonly x: number;
  readonly z: number;
}

function populatedIsland(shape: IslandShapeKind): Simulation {
  const simulation = new Simulation(generateWorld(7, { ...DEFAULT_GENERATION_OPTIONS, shape }));

  simulation.populate();

  for (const crossing of simulation.world.crossings.slice(0, SETTLERS_BY_CROSSINGS)) {
    simulation.execute({
      parameters: {},
      powerId: "tribe",
      type: "usePower",
      x: crossing.startX + (crossing.startX - crossing.endX),
      z: crossing.startZ + (crossing.startZ - crossing.endZ),
    });
  }

  return simulation;
}

function walkers(simulation: Simulation): Walker[] {
  const people = simulation.society.people.filter((person) => person.isAlive);
  const animals = simulation.fauna.animals.filter((animal) => animal.isAlive);

  return [...people, ...animals].map(({ id, mover }) => ({ id, isHopping: isHopping(mover), x: mover.x, z: mover.z }));
}

function isInOpenWater(simulation: Simulation, walker: Walker): boolean {
  const { world } = simulation;

  return world.isWaterAt(walker.x, walker.z) && world.crossingAt(walker.x, walker.z) === null && !walker.isHopping;
}

function longestSpellInWater(simulation: Simulation, seconds: number): number {
  const wetSince = new Map<number, number>();

  let longest = 0;

  for (let tick = 0; tick < seconds / TICK_SECONDS; tick += 1) {
    simulation.step();

    for (const walker of walkers(simulation)) {
      if (!isInOpenWater(simulation, walker)) {
        wetSince.delete(walker.id);

        continue;
      }

      const since = wetSince.get(walker.id);

      if (since === undefined) {
        wetSince.set(walker.id, tick);

        continue;
      }

      longest = Math.max(longest, (tick - since) * TICK_SECONDS);
    }
  }

  return longest;
}

describe.each(["round", "square"] as const)("a long day on a %s island", (shape) => {
  test("keeps people and animals out of water and gets them out of a flood", { timeout: 180_000 }, () => {
    const simulation = populatedIsland(shape);

    expect(longestSpellInWater(simulation, RUN_SECONDS)).toBeLessThan(LONGEST_SPELL_IN_WATER);
    expect(simulation.society.population).toBeGreaterThan(14);

    const person = simulation.society.people.find((candidate) => candidate.isAlive);

    if (person === undefined) {
      throw new Error("Expected someone on the island");
    }

    const { world } = simulation;

    floodCells(world, world.grid.cellsInRadius(person.mover.x, person.mover.z, FLOOD_RADIUS), FLOOD_DEPTH);
    simulation.navigation.rebuild();

    expect(walkers(simulation).some((walker) => isInOpenWater(simulation, walker))).toBe(true);

    simulation.runTicks(SECONDS_TO_SWIM_OUT / TICK_SECONDS);

    expect(walkers(simulation).filter((walker) => isInOpenWater(simulation, walker))).toEqual([]);
  });
});

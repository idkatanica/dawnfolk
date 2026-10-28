import { WorldMirror } from "../../game/world-mirror.ts";
import { Simulation } from "../../simulation/simulation.ts";
import { createVegetatedWorld, type TestWorldOptions } from "../../simulation/testing/test-world.ts";

export function createVegetatedMirror(overrides: Partial<TestWorldOptions> = {}): WorldMirror {
  const simulation = new Simulation(
    createVegetatedWorld({ dimensions: { cellSize: 10, cellsPerSide: 64 }, ...overrides })
  );

  return new WorldMirror(simulation.initialWorld(), 0);
}

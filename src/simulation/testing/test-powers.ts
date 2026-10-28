import type { PowerId } from "../../content/powers.ts";
import { Simulation } from "../simulation.ts";
import { createVegetatedWorld } from "./test-world.ts";

export function createPowerSimulation(baseTemperature = 15): Simulation {
  return new Simulation(createVegetatedWorld({ baseTemperature, dimensions: { cellSize: 10, cellsPerSide: 96 } }));
}

export function brush(simulation: Simulation, powerId: PowerId, seconds: number): void {
  simulation.beginStroke(powerId, 0, 0, {});

  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) {
    simulation.advance(0.05);
  }

  simulation.endStroke();
}

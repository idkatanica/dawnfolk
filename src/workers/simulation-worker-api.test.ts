import { expose, wrap } from "comlink";
import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_REQUEST, type WorldRequest } from "../generation/generation-options.ts";
import type { InitialWorld } from "../simulation/frame.ts";
import { Simulation } from "../simulation/simulation.ts";
import { createVegetatedWorld } from "../simulation/testing/test-world.ts";
import { createSimulationWorkerApi, type SimulationWorkerApi } from "./simulation-worker-api.ts";

interface WorldSender {
  createWorld: (request: WorldRequest) => InitialWorld;
}

function createTestSimulation(): Simulation {
  return new Simulation(createVegetatedWorld({ dimensions: { cellSize: 10, cellsPerSide: 64 } }));
}

describe("creating the world", () => {
  it("moves every terrain buffer to the main thread instead of copying it", async () => {
    const api = createSimulationWorkerApi(createTestSimulation);

    const sent: InitialWorld[] = [];
    const { port1, port2 } = new MessageChannel();

    expose(
      {
        createWorld: (request: WorldRequest) => {
          const world = api.createWorld(request, () => undefined);

          sent.push(world);

          return world;
        },
      },
      port1
    );

    const received = await wrap<WorldSender>(port2).createWorld(DEFAULT_WORLD_REQUEST);

    port1.close();
    port2.close();

    expect(received.terrain.coastDistance).toHaveLength(64 * 64);
    expect(sent).toHaveLength(1);

    for (const values of sent.flatMap((world) => Object.values(world.terrain))) {
      expect(values.buffer.byteLength).toBe(0);
    }
  });
});

describe("saving the world", () => {
  function createApi(): SimulationWorkerApi {
    return createSimulationWorkerApi(createTestSimulation, createTestSimulation);
  }

  it("saves nothing before a world exists", () => {
    expect(createApi().saveWorld()).toBeNull();
  });

  it("continues a saved world where it left off", () => {
    const api = createApi();

    api.createWorld(DEFAULT_WORLD_REQUEST, () => undefined);
    api.advance(0.25, [{ parameters: {}, powerId: "tribe", type: "usePower", x: 0, z: 0 }]);

    const saved = api.saveWorld();

    if (saved === null) {
      throw new Error("The world was busy");
    }

    expect(saved.summary.population).toBeGreaterThan(0);

    const loaded = createApi().loadWorld(saved, () => undefined);

    expect(loaded.frame.tick).toBe(saved.simulation.tick);
    expect(loaded.frame.tribes).toHaveLength(saved.summary.tribeCount);
  });

  it("refuses a damaged save", () => {
    expect(() => createApi().loadWorld({ version: 1 }, () => undefined)).toThrow("cannot be loaded");
  });
});

import { expose, wrap } from "comlink";
import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_REQUEST, type WorldRequest } from "../generation/generation-options.ts";
import type { InitialWorld } from "../simulation/frame.ts";
import { Simulation } from "../simulation/simulation.ts";
import { createVegetatedWorld } from "../simulation/testing/test-world.ts";
import { createSimulationWorkerApi } from "./simulation-worker-api.ts";

interface WorldSender {
  createWorld: (request: WorldRequest) => InitialWorld;
}

describe("creating the world", () => {
  it("moves every terrain buffer to the main thread instead of copying it", async () => {
    const api = createSimulationWorkerApi(
      () => new Simulation(createVegetatedWorld({ dimensions: { cellSize: 10, cellsPerSide: 64 } }))
    );

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

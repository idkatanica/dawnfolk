import { describe, expect, it, onTestFinished } from "vitest";
import type { GenerationStage } from "../generation/world-generator.ts";
import { WorkerSimulationConnection } from "./simulation-connection.ts";

const SMALL_WORLD = {
  options: { dimensions: { cellSize: 10, cellsPerSide: 96 }, erosionStrength: 1, shape: "round" },
  seed: 3,
} as const;

describe("worker simulation connection", () => {
  it("creates the world in a worker and advances it with the queued commands", async () => {
    const connection = new WorkerSimulationConnection();
    const stages = new Set<GenerationStage>();

    onTestFinished(() => {
      connection.dispose();
    });

    const world = await connection.createWorld(SMALL_WORLD, (progress) => {
      stages.add(progress.stage);
    });

    connection.send({ isPaused: true, type: "setPaused" });

    const frame = await connection.advance(0.2);

    expect(stages).toContain("vegetation");
    expect(world.terrain.height).toHaveLength(96 * 96);
    expect(world.frame.personCount).toBeGreaterThan(0);
    expect(frame.isPaused).toBe(true);
    expect(frame.people.length).toBeGreaterThan(0);
  });

  it("drops commands queued for the previous world", async () => {
    const connection = new WorkerSimulationConnection();

    onTestFinished(() => {
      connection.dispose();
    });

    await connection.createWorld(SMALL_WORLD, () => undefined);
    connection.send({ isPaused: true, type: "setPaused" });
    await connection.createWorld(SMALL_WORLD, () => undefined);

    const frame = await connection.advance(0.2);

    expect(frame.isPaused).toBe(false);
  });
});

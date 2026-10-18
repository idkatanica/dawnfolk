import { describe, expect, it } from "vitest";
import { WorldMirror } from "../../game/world-mirror.ts";
import { Simulation } from "../../simulation/simulation.ts";
import { createVegetatedWorld, type TestWorldOptions } from "../../simulation/testing/test-world.ts";
import { PlantState } from "../../world/vegetation-store.ts";
import { BUCKET_COUNT, FLOATS_PER_PLANT, PLANT_SINKING, VegetationChunks } from "./vegetation-chunks.ts";

const SLOPE = 0.6;

function createMirror(overrides: Partial<TestWorldOptions> = {}): WorldMirror {
  const simulation = new Simulation(
    createVegetatedWorld({ dimensions: { cellSize: 10, cellsPerSide: 64 }, ...overrides })
  );

  return new WorldMirror(simulation.initialWorld(), 0);
}

function packedPlantCount(chunks: VegetationChunks): number {
  return chunks.chunks.reduce(
    (total, chunk) => total + chunk.buckets.reduce((sum, bucket) => sum + bucket.length / FLOATS_PER_PLANT, 0),
    0
  );
}

function alivePlantCount(mirror: WorldMirror): number {
  let count = 0;

  for (let plant = 0; plant < mirror.vegetation.count; plant += 1) {
    if (mirror.vegetation.state[plant] !== PlantState.Removed) {
      count += 1;
    }
  }

  return count;
}

describe("vegetation chunks", () => {
  it("packs every standing plant once", () => {
    const mirror = createMirror();

    const chunks = new VegetationChunks(mirror);

    chunks.repackDirty();

    expect(alivePlantCount(mirror)).toBeGreaterThan(0);
    expect(packedPlantCount(chunks)).toBe(alivePlantCount(mirror));
  });

  it("keeps one bucket per species and variant", () => {
    const chunks = new VegetationChunks(createMirror());

    chunks.repackDirty();

    for (const chunk of chunks.chunks) {
      expect(chunk.buckets).toHaveLength(BUCKET_COUNT);
    }
  });

  it("drops removed plants after a change", () => {
    const mirror = createMirror();

    const chunks = new VegetationChunks(mirror);

    chunks.repackDirty();
    mirror.vegetation.state[0] = PlantState.Removed;
    chunks.plantsChanged([0]);

    expect(chunks.repackDirty()).toHaveLength(1);
    expect(packedPlantCount(chunks)).toBe(alivePlantCount(mirror));
  });

  it("places plants on the ground", () => {
    const mirror = createMirror();

    const chunks = new VegetationChunks(mirror);

    chunks.repackDirty();

    const chunk = chunks.chunks.find((candidate) => candidate.plants.size > 0);

    const bucket = chunk?.buckets.find((candidate) => candidate.length > 0);

    if (bucket === undefined) {
      throw new Error("The test world should have plants");
    }

    const [x, y, z] = bucket;

    expect(y).toBeCloseTo(mirror.heightAt(x, z) - PLANT_SINKING, 3);
  });

  it("sinks plants on a slope until their downhill side touches the ground", () => {
    const mirror = createMirror({ heightAt: (x) => 100 + x * SLOPE });

    const chunks = new VegetationChunks(mirror);

    chunks.repackDirty();

    const buckets = chunks.chunks.flatMap((chunk) => chunk.buckets.filter((bucket) => bucket.length > 0));

    expect(buckets.length).toBeGreaterThan(0);

    for (const bucket of buckets) {
      for (let offset = 0; offset < bucket.length; offset += FLOATS_PER_PLANT) {
        const [x, y, z] = bucket.subarray(offset, offset + 3);

        expect(y).toBeLessThan(mirror.heightAt(x, z) - PLANT_SINKING - 0.05);
      }
    }
  });
});

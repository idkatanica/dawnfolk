import { beforeEach, describe, expect, it } from "vitest";
import { generateWorld } from "../../generation/world-generator.ts";
import { createTestWorld } from "../testing/test-world.ts";
import { flattenTerrain, raiseTerrain } from "./terrain-editing.ts";
import { WaterRecomputation } from "./water-recomputation.ts";
import { WorldState } from "./world-state.ts";

const TEST_OPTIONS = { dimensions: { cellSize: 40, cellsPerSide: 96 }, erosionStrength: 0.4 };

let world: WorldState;

beforeEach(() => {
  world = new WorldState(generateWorld(11, TEST_OPTIONS));
});

describe("water recomputation", () => {
  it("waits for the land to stay still before recomputing", () => {
    const recomputation = new WaterRecomputation(world);

    raiseTerrain(world, { radius: 200, x: 0, z: 0 }, 5);

    expect(recomputation.update(0.1)).toBe(false);
    expect(recomputation.isPending).toBe(true);
    expect(recomputation.update(0.3)).toBe(false);
    expect(recomputation.update(0.5)).toBe(true);
    expect(recomputation.isPending).toBe(false);
  });

  it("does not deepen channels when recomputed repeatedly", () => {
    const recomputation = new WaterRecomputation(world);
    const heightsBefore = Float32Array.from(world.terrain.height);
    const lakesBefore = world.water.lakes.length;

    recomputation.recompute();
    recomputation.recompute();

    const largestChange = heightsBefore.reduce(
      (largest, height, cell) => Math.max(largest, Math.abs(height - world.terrain.height[cell])),
      0
    );

    expect(largestChange).toBeLessThan(0.01);
    expect(world.water.lakes).toHaveLength(lakesBefore);
  });

  it("keeps carving depths positive after an edit", () => {
    const recomputation = new WaterRecomputation(world);

    raiseTerrain(world, { radius: 300, x: 0, z: 0 }, 20);
    recomputation.recompute();

    expect(Math.min(...world.terrain.carving)).toBeGreaterThanOrEqual(0);
    expect(world.waterVersion).toBe(1);
  });

  it("reports only the heights that recomputing changed", () => {
    const levelled = createTestWorld({ dimensions: { cellSize: 10, cellsPerSide: 48 } });

    const recomputation = new WaterRecomputation(levelled);

    for (let row = 10; row < 20; row += 1) {
      const cell = levelled.grid.index(30, row);

      levelled.terrain.carving[cell] = 3;
      levelled.terrain.height[cell] = 97;
    }

    recomputation.recompute();

    expect(levelled.heightChanges.takeRegion()).toEqual({ firstColumn: 28, firstRow: 8, lastColumn: 32, lastRow: 21 });

    recomputation.recompute();

    expect(levelled.heightChanges.takeRegion()).toBeNull();
  });

  it("does not raise the old channel again once the land over it was levelled", () => {
    const levelled = createTestWorld({ dimensions: { cellSize: 10, cellsPerSide: 24 } });

    const recomputation = new WaterRecomputation(levelled);

    for (let row = 4; row < 20; row += 1) {
      const cell = levelled.grid.index(12, row);

      levelled.terrain.carving[cell] = 3;
      levelled.terrain.height[cell] = 97;
    }

    flattenTerrain(levelled, { radius: 60, x: 5, z: 5 }, 100, 1);
    recomputation.recompute();

    expect(levelled.terrain.height[levelled.grid.cellAt(5, 5)]).toBeCloseTo(100, 2);
  });
});

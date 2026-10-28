import { describe, expect, it } from "vitest";
import { FULL_TURN } from "../../shared/math.ts";
import { MORNING, SocietyHarness } from "../testing/test-society.ts";
import { floodCells } from "../testing/test-world.ts";
import { nearestShore } from "./resources.ts";

describe("fishing", () => {
  it("stands the fisher on the shore rather than at the water's edge", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const { grid, terrain } = harness.world;

    for (let cell = 0; cell < grid.cellCount; cell += 1) {
      if (grid.columnOf(cell) % 4 === 0 && grid.rowOf(cell) % 4 === 0) {
        terrain.waterSurface[cell] = terrain.height[cell] + 2;
      }
    }

    const angles = Array.from({ length: 8 }, (_, index) => (index / 8) * FULL_TURN);

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const spot = nearestShore(harness.world, { x: 0, z: 0 }, 200, harness.random);

      if (spot === null) {
        throw new Error("Expected a fishing spot");
      }

      const wetSamples = angles.filter((angle) =>
        harness.world.isWaterAt(spot.x + Math.cos(angle) * 1.2, spot.z + Math.sin(angle) * 1.2)
      );

      expect(wetSamples).toEqual([]);
    }
  });
});

describe("staying dry", () => {
  it("fishes from the middle of a bank cell, corners included, facing the water beside it", () => {
    const harness = new SocietyHarness({ day: MORNING });

    const { grid } = harness.world;

    const pond = grid.cellsInRadius(0, 0, 400).filter((cell) => {
      const x = grid.cellCenterX(cell);
      const z = grid.cellCenterZ(cell);

      return (x > 0 && x < 40 && z > -100 && z < 100) || (z > 0 && z < 40 && x > -100 && x < 100);
    });

    floodCells(harness.world, pond, 2);

    const spots = Array.from({ length: 200 }, () =>
      nearestShore(harness.world, { x: -25, z: -25 }, 15, harness.random)
    );

    expect(spots.filter((spot) => spot !== null).length).toBeGreaterThan(5);

    for (const spot of spots) {
      if (spot === null) {
        continue;
      }

      const cell = grid.cellAt(spot.x, spot.z);
      const water = grid.cellAt(spot.waterX, spot.waterZ);

      expect(harness.world.isWalkable(cell)).toBe(true);
      expect(spot).toMatchObject({ x: grid.cellCenterX(cell), z: grid.cellCenterZ(cell) });
      expect(harness.world.isWater(water)).toBe(true);
      expect(Math.hypot(spot.waterX - spot.x, spot.waterZ - spot.z)).toBeCloseTo(grid.cellSize, 3);
    }
  });
});

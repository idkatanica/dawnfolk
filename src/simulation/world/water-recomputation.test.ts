import { beforeEach, describe, expect, it } from "vitest";
import { PlantSpecies } from "../../content/plants.ts";
import { DEFAULT_GENERATION_OPTIONS, type GenerationOptions } from "../../generation/generation-options.ts";
import { type GeneratedWorld, generateWorld } from "../../generation/world-generator.ts";
import { type Crossing, crossingLength } from "../../world/crossings.ts";
import { PlantState } from "../../world/vegetation-store.ts";
import { createTestWorld } from "../testing/test-world.ts";
import { flattenTerrain, raiseTerrain } from "./terrain-editing.ts";
import { WaterRecomputation } from "./water-recomputation.ts";
import { NO_BUILDING, SPRING_GROUND, WorldState } from "./world-state.ts";

const TEST_OPTIONS: GenerationOptions = {
  dimensions: { cellSize: 40, cellsPerSide: 96 },
  erosionStrength: 0.4,
  shape: "round",
};

describe("water recomputation", () => {
  let world: WorldState;

  beforeEach(() => {
    world = new WorldState(generateWorld(11, TEST_OPTIONS));
  });

  it("waits for the land to stay still before recomputing", () => {
    const recomputation = new WaterRecomputation(world);

    raiseTerrain(world, { radius: 200, x: 0, z: 0 }, 5);

    expect(recomputation.update(0.1)).toBe("none");
    expect(recomputation.isPending).toBe(true);
    expect(recomputation.update(0.3)).toBe("none");
    expect(recomputation.update(0.5)).toBe("features");
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

  it("keeps the springs at the heads of the recomputed rivers and their ground reserved", () => {
    const recomputation = new WaterRecomputation(world);

    raiseTerrain(world, { radius: 300, x: 0, z: 0 }, 20);
    recomputation.recompute();

    const reserved = new Set(world.water.springs.flatMap((spring) => spring.cells));

    expect(world.water.springs.length).toBeGreaterThan(0);

    for (const spring of world.water.springs) {
      expect(world.water.rivers[spring.river]).toBeDefined();
    }

    for (let cell = 0; cell < world.grid.cellCount; cell += 1) {
      if (world.occupancy[cell] === SPRING_GROUND) {
        expect(reserved.has(cell)).toBe(true);
      }

      if (reserved.has(cell)) {
        expect(world.occupancy[cell]).not.toBe(NO_BUILDING);
      }
    }
  });

  it("clears rocks from the cells the water covers and leaves them on its dry banks", () => {
    const recomputation = new WaterRecomputation(world);
    const { grid } = world;

    const wetCells = Array.from({ length: grid.cellCount }, (_, cell) => cell).filter((cell) => world.isWater(cell));

    for (const cell of wetCells.slice(0, 40)) {
      world.plant({
        bornDay: 0,
        height: 1.5,
        rotation: 0,
        seed: 0.5,
        species: PlantSpecies.Boulder,
        x: grid.cellCenterX(cell),
        z: grid.cellCenterZ(cell),
      });
    }

    recomputation.recompute();

    const wetBoulders = Array.from({ length: world.vegetation.count }, (_, plant) => plant).filter(
      (plant) =>
        world.vegetation.species[plant] === PlantSpecies.Boulder &&
        world.vegetation.state[plant] === PlantState.Alive &&
        world.isWater(world.vegetation.cell[plant])
    );

    expect(wetCells.length).toBeGreaterThan(40);
    expect(wetBoulders).toEqual([]);
  });

  it("keeps carving depths positive after an edit", () => {
    const recomputation = new WaterRecomputation(world);

    raiseTerrain(world, { radius: 300, x: 0, z: 0 }, 20);
    recomputation.recompute();

    expect(Math.min(...world.terrain.carving)).toBeGreaterThanOrEqual(0);
    expect(world.waterVersion).toBe(1);
  });
});

describe("water recomputation over levelled land", () => {
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

describe("crossings after the water is worked out again", () => {
  let generated: GeneratedWorld;

  function freshWorld(): WorldState {
    if (generated === undefined) {
      generated = generateWorld(7, DEFAULT_GENERATION_OPTIONS);
    }

    return new WorldState({
      ...generated,
      terrain: {
        ...generated.terrain,
        carving: Float32Array.from(generated.terrain.carving),
        height: Float32Array.from(generated.terrain.height),
        riverStrength: Uint8Array.from(generated.terrain.riverStrength),
        waterSurface: Float32Array.from(generated.terrain.waterSurface),
      },
    });
  }

  function idsOf(crossings: readonly Crossing[]): number[] {
    return crossings.map((crossing) => crossing.id).sort((first, second) => first - second);
  }

  it("keeps every crossing where the land stayed the same", { timeout: 60_000 }, () => {
    const state = freshWorld();

    const before = state.crossings;

    new WaterRecomputation(state).recompute();

    expect(idsOf(state.crossings)).toEqual(idsOf(before));
    expect(state.crossings.map((crossing) => crossingLength(crossing))).toEqual(
      before.map((crossing) => expect.closeTo(crossingLength(crossing), 6))
    );
  });

  it("drops a crossing whose river was buried and keeps the others", { timeout: 60_000 }, () => {
    const state = freshWorld();

    const [buried, ...others] = state.crossings;

    if (buried === undefined) {
      throw new Error("Expected the island to have crossings");
    }

    raiseTerrain(state, { radius: 90, x: (buried.startX + buried.endX) / 2, z: (buried.startZ + buried.endZ) / 2 }, 40);
    new WaterRecomputation(state).recompute();

    const remaining = new Set(state.crossings.map((crossing) => crossing.id));

    expect(remaining.has(buried.id)).toBe(false);
    expect(others.filter((crossing) => remaining.has(crossing.id)).length).toBeGreaterThan(others.length * 0.8);
  });
});

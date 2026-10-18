import { describe, expect, it } from "vitest";
import { WorldMirror } from "../../game/world-mirror.ts";
import { Simulation } from "../../simulation/simulation.ts";
import { centerCell, createVegetatedWorld, floodCells } from "../../simulation/testing/test-world.ts";
import { standingHeight } from "./agent-view-input.ts";

const WADING_DEPTH = 1.1;

function mirrorWithPool(depth: number) {
  const simulation = new Simulation(
    createVegetatedWorld({ dimensions: { cellSize: 10, cellsPerSide: 64 }, heightAt: () => 100 })
  );

  const pool = centerCell(simulation.world);

  floodCells(simulation.world, [pool], depth);

  const { grid } = simulation.world;

  return {
    mirror: new WorldMirror(simulation.initialWorld(), 0),
    x: grid.cellCenterX(pool),
    z: grid.cellCenterZ(pool),
  };
}

describe("standing height", () => {
  it("stands on dry ground", () => {
    const { mirror, x, z } = mirrorWithPool(3);

    expect(standingHeight(mirror, x + 200, z, WADING_DEPTH)).toBeCloseTo(100, 3);
  });

  it("wades through shallow water on the bottom", () => {
    const { mirror, x, z } = mirrorWithPool(0.6);

    expect(standingHeight(mirror, x, z, WADING_DEPTH)).toBeCloseTo(100, 3);
  });

  it("keeps the head above deep water", () => {
    const { mirror, x, z } = mirrorWithPool(3);

    expect(standingHeight(mirror, x, z, WADING_DEPTH)).toBeCloseTo(103 - WADING_DEPTH, 3);
  });
});

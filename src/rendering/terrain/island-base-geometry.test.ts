import { describe, expect, it } from "vitest";
import { WorldMirror } from "../../game/world-mirror.ts";
import { Simulation } from "../../simulation/simulation.ts";
import { createVegetatedWorld } from "../../simulation/testing/test-world.ts";
import { sampleHeight } from "../../world/terrain-sampling.ts";
import { buildIslandBaseGeometry } from "./island-base-geometry.ts";

const CELLS_PER_SIDE = 32;
const COAST_TOLERANCE = 0.01;

function rimPoints(mirror: WorldMirror): (readonly [number, number])[] {
  const { cliff } = buildIslandBaseGeometry(mirror);

  const topPoints = cliff.getAttribute("topPoint");
  const cliffAmounts = cliff.getAttribute("cliffAmount");
  const rim: (readonly [number, number])[] = [];

  for (let vertex = 0; vertex < cliffAmounts.count; vertex += 1) {
    if (cliffAmounts.getX(vertex) === 1) {
      rim.push([topPoints.getX(vertex), topPoints.getY(vertex)]);
    }
  }

  return rim;
}

function squareMirror(): WorldMirror {
  const world = createVegetatedWorld({ dimensions: { cellSize: 10, cellsPerSide: CELLS_PER_SIDE } });

  return new WorldMirror(new Simulation(world).initialWorld(), 0);
}

function roundMirror(): WorldMirror {
  const simulation = Simulation.generate(
    5,
    { dimensions: { cellSize: 20, cellsPerSide: 96 }, erosionStrength: 0.4, shape: "round" },
    () => undefined
  );

  return new WorldMirror(simulation.initialWorld(), 0);
}

describe("island base geometry", () => {
  it("tops the square cliff at every edge cell exactly once", () => {
    const mirror = squareMirror();

    const { grid } = mirror;
    const last = CELLS_PER_SIDE - 1;
    const edges = new Set<string>();

    const rim = rimPoints(mirror).map(([x, z]) => {
      const cell = grid.cellAt(x, z);

      return `${grid.columnOf(cell)},${grid.rowOf(cell)}`;
    });

    for (let position = 0; position <= last; position += 1) {
      edges.add(`${position},0`).add(`${position},${last}`).add(`0,${position}`).add(`${last},${position}`);
    }

    expect(rim).toHaveLength(edges.size);
    expect(new Set(rim)).toEqual(edges);
  });

  it("tops the round cliff on the coast all the way around", () => {
    const mirror = roundMirror();

    const rim = rimPoints(mirror);

    expect(rim.length).toBeGreaterThan(500);

    for (const [x, z] of rim) {
      expect(Math.abs(sampleHeight(mirror.terrain.coastDistance, mirror.grid, x, z))).toBeLessThan(COAST_TOLERANCE);
    }
  });
});

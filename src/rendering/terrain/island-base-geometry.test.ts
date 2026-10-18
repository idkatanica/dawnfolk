import { describe, expect, it } from "vitest";
import { WorldMirror } from "../../game/world-mirror.ts";
import { Simulation } from "../../simulation/simulation.ts";
import { createVegetatedWorld } from "../../simulation/testing/test-world.ts";
import { buildIslandBaseGeometry } from "./island-base-geometry.ts";

const CELLS_PER_SIDE = 32;

function rimCells(): string[] {
  const mirror = new WorldMirror(
    new Simulation(createVegetatedWorld({ dimensions: { cellSize: 10, cellsPerSide: CELLS_PER_SIDE } })).initialWorld(),
    0
  );

  const geometry = buildIslandBaseGeometry(mirror);
  const cells = geometry.getAttribute("topCell");
  const cliff = geometry.getAttribute("cliffAmount");
  const rim: string[] = [];

  for (let vertex = 0; vertex < cliff.count; vertex += 1) {
    if (cliff.getX(vertex) === 1) {
      rim.push(`${cells.getX(vertex)},${cells.getY(vertex)}`);
    }
  }

  return rim;
}

describe("island base geometry", () => {
  it("tops the cliff at every edge cell exactly once", () => {
    const last = CELLS_PER_SIDE - 1;
    const rim = rimCells();
    const edges = new Set<string>();

    for (let position = 0; position <= last; position += 1) {
      edges.add(`${position},0`).add(`${position},${last}`).add(`0,${position}`).add(`${last},${position}`);
    }

    expect(rim).toHaveLength(edges.size);
    expect(new Set(rim)).toEqual(edges);
  });
});

import { describe, expect, it } from "vitest";
import { WorldMirror } from "../../game/world-mirror.ts";
import { Simulation } from "../../simulation/simulation.ts";
import { createVegetatedWorld } from "../../simulation/testing/test-world.ts";
import { sampleHeight } from "../../world/terrain-sampling.ts";
import { buildIslandBaseGeometry, islandPlinthHeight } from "./island-base-geometry.ts";
import { type CoastPoint, type GroundArea, IslandOutline, type OutlineSide } from "./island-outline.ts";

const CELLS_PER_SIDE = 32;
const COAST_TOLERANCE = 1.5;
const NUDGE = 0.01;
const AREA_SIZE = 160;
const SAMPLE_STEP = 2;
const round = new WorldMirror(
  Simulation.generate(
    5,
    { dimensions: { cellSize: 20, cellsPerSide: 96 }, erosionStrength: 0.4, shape: "round" },
    () => undefined
  ).initialWorld(),
  0
);

function rimPoints(mirror: WorldMirror): (readonly [number, number])[] {
  const outline = new IslandOutline(mirror);

  const { cliff } = buildIslandBaseGeometry(mirror, outline, islandPlinthHeight(mirror, outline));

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

function latticeLines(
  mirror: WorldMirror,
  from: readonly [number, number],
  towards: readonly [number, number]
): number[] {
  const { cellSize, halfSize } = mirror.grid;

  const length = Math.hypot(towards[0] - from[0], towards[1] - from[1]);
  const share = NUDGE / length;

  const x = from[0] + (towards[0] - from[0]) * share;
  const z = from[1] + (towards[1] - from[1]) * share;

  const column = (x + halfSize) / cellSize - 0.5;
  const row = (z + halfSize) / cellSize - 0.5;

  return [Math.floor(column), Math.floor(row), Math.floor(column + row), Math.floor(column - row)];
}

function coastOf(outline: IslandOutline): readonly CoastPoint[] {
  if (outline.coast === null) {
    throw new Error("A round island has a coast outline");
  }

  return outline.coast;
}

function squareMirror(): WorldMirror {
  const world = createVegetatedWorld({ dimensions: { cellSize: 10, cellsPerSide: CELLS_PER_SIDE } });

  return new WorldMirror(new Simulation(world).initialWorld(), 0);
}

function isInside(outline: IslandOutline, x: number, z: number): boolean {
  const [coastX, coastZ] = outline.atCoast(x, z);

  return Math.hypot(x, z) < Math.hypot(coastX, coastZ);
}

function sampledSides(outline: IslandOutline, area: GroundArea): Set<boolean> {
  const sides = new Set<boolean>();

  for (let z = area.minimumZ; z <= area.maximumZ; z += SAMPLE_STEP) {
    for (let x = area.minimumX; x <= area.maximumX; x += SAMPLE_STEP) {
      sides.add(isInside(outline, x, z));
    }
  }

  return sides;
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

  it("tops the round cliff along the outline the terrain is cut by", () => {
    const outline = new IslandOutline(round);

    const rim = rimPoints(round);
    const coast = coastOf(outline);

    expect(rim).toHaveLength(coast.length);

    for (const [index, [x, z]] of rim.entries()) {
      const { angle, radius } = coast[index];

      expect(x).toBeCloseTo(Math.cos(angle) * radius, 3);
      expect(z).toBeCloseTo(Math.sin(angle) * radius, 3);
      expect(Math.abs(sampleHeight(round.terrain.coastDistance, round.grid, x, z))).toBeLessThan(COAST_TOLERANCE);
    }
  });

  it("breaks the cliff top at every line of the terrain mesh it crosses", () => {
    const rim = rimPoints(round);

    const segments = rim
      .map((start, index) => [start, rim[(index + 1) % rim.length]] as const)
      .filter(([start, end]) => Math.hypot(end[0] - start[0], end[1] - start[1]) > NUDGE * 2);

    for (const [start, end] of segments) {
      expect(latticeLines(round, end, start)).toEqual(latticeLines(round, start, end));
    }
  });
});

describe("island outline", () => {
  it("tells areas wholly inside or outside the coast from those it crosses", () => {
    const outline = new IslandOutline(round);

    const { halfSize } = round.grid;
    const found = new Set<OutlineSide>();
    const misplaced: string[] = [];

    for (let minimumZ = -halfSize; minimumZ < halfSize; minimumZ += AREA_SIZE) {
      for (let minimumX = -halfSize; minimumX < halfSize; minimumX += AREA_SIZE) {
        const area = { maximumX: minimumX + AREA_SIZE, maximumZ: minimumZ + AREA_SIZE, minimumX, minimumZ };

        const side = outline.sideOf(area, 0);

        found.add(side);

        if (side !== "across" && sampledSides(outline, area).has(side === "outside")) {
          misplaced.push(`${side} at ${minimumX}, ${minimumZ}`);
        }
      }
    }

    expect(misplaced).toEqual([]);
    expect(found).toEqual(new Set(["across", "inside", "outside"]));
  });
});

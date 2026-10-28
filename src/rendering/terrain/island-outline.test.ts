import { describe, expect, it } from "vitest";
import { WorldMirror } from "../../game/world-mirror.ts";
import { Simulation } from "../../simulation/simulation.ts";
import { type GroundArea, IslandOutline, type OutlineSide } from "./island-outline.ts";

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

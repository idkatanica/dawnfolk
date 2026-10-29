import { describe, expect, it } from "vitest";
import type { Spring } from "../../world/water.ts";
import { WorldGrid } from "../../world/world-grid.ts";
import { CaveOutlets, caveMouthWidth } from "./cave-outlets.ts";

const grid = new WorldGrid({ cellSize: 10, cellsPerSide: 32 });

const SPRING: Omit<Spring, "kind" | "x" | "z"> = {
  cells: [],
  directionX: 0,
  directionZ: 1,
  level: 4,
  radius: 4,
  river: 0,
  seed: 0.3,
};

const SPRINGS: readonly Spring[] = [
  { ...SPRING, kind: "cave", x: -60, z: -60 },
  { ...SPRING, kind: "pond", x: 60, z: 60 },
];

function slotAt(outlets: CaveOutlets, x: number, z: number): number {
  const cells = outlets.cells.image.data;

  return cells instanceof Float32Array ? cells[grid.cellAt(x, z)] : Number.NaN;
}

describe("CaveOutlets", () => {
  it("marks the cells from inside each cave to where its river runs free, and leaves ponds out", () => {
    const outlets = new CaveOutlets(grid, SPRINGS);

    expect(slotAt(outlets, -60, -60)).toBe(1);
    expect(slotAt(outlets, -60, -45)).toBe(1);
    expect(slotAt(outlets, -60, -120)).toBe(0);
    expect(slotAt(outlets, 0, -60)).toBe(0);
    expect(slotAt(outlets, 60, 60)).toBe(0);

    outlets.rebuild([]);

    expect(slotAt(outlets, -60, -60)).toBe(0);
  });

  it("reaches across the two grid cells a river can cover beside its mouth", () => {
    const outlets = new CaveOutlets(grid, SPRINGS);

    expect(slotAt(outlets, -40, -62)).toBe(1);
    expect(slotAt(outlets, -90, -62)).toBe(1);
    expect(slotAt(outlets, -30, -62)).toBe(0);
    expect(slotAt(outlets, -100, -62)).toBe(0);
  });

  it("opens each cave a little wider than its river", () => {
    expect(caveMouthWidth({ ...SPRING, kind: "cave", x: 0, z: 0 })).toBeGreaterThan(SPRING.radius * 2);
  });
});

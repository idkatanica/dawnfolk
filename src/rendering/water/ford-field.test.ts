import { describe, expect, it } from "vitest";
import type { Crossing } from "../../world/crossings.ts";
import { WorldGrid } from "../../world/world-grid.ts";
import { FORD_PATH_REACH, FordField } from "./ford-field.ts";

const grid = new WorldGrid({ cellSize: 10, cellsPerSide: 32 });

const CROSSINGS: readonly Crossing[] = [
  { endDeck: 101, endX: 0, endZ: 40, id: 0, kind: "log", seed: 0.2, startDeck: 101, startX: 0, startZ: 20 },
  { endX: 30, endZ: -45, id: 1, kind: "ford", seed: 0.4, startX: -30, startZ: -45 },
];

function slotAt(field: FordField, x: number, z: number): number {
  const cells = field.cells.image.data;

  return cells instanceof Float32Array ? cells[grid.cellAt(x, z)] : Number.NaN;
}

describe("FordField", () => {
  it("marks the cells along each ford and the paths leading to it, and leaves logs out", () => {
    const field = new FordField(grid, CROSSINGS);

    expect(slotAt(field, 0, -45)).toBe(1);
    expect(slotAt(field, -30 - FORD_PATH_REACH + 1, -45)).toBe(1);
    expect(slotAt(field, 0, -75)).toBe(0);
    expect(slotAt(field, 0, 30)).toBe(0);

    field.rebuild([]);

    expect(slotAt(field, 0, -45)).toBe(0);
  });
});

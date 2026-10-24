import { describe, expect, it } from "vitest";
import { WorldGrid } from "./world-grid.ts";

const grid = new WorldGrid({ cellSize: 10, cellsPerSide: 8 });

function columnsAndRows(cells: readonly number[]): string[] {
  return cells.map((cell) => `${grid.columnOf(cell)},${grid.rowOf(cell)}`);
}

describe("world grid", () => {
  it("lists the cells a segment crosses, in order", () => {
    expect(columnsAndRows(grid.cellsAlong(-35, -35, -5, -35))).toEqual(["0,0", "1,0", "2,0", "3,0"]);
  });

  it("catches the corner cell a diagonal clips", () => {
    const cells = columnsAndRows(grid.cellsAlong(-20.1, -19.8, -19.8, -20.1));

    expect(cells).toEqual(["1,2", "2,2", "2,1"]);
  });

  it("stays in one cell for a short step inside it", () => {
    expect(columnsAndRows(grid.cellsAlong(3, 3, 4, 4))).toEqual(["4,4"]);
  });

  it("clamps the bounds of a circle to the grid", () => {
    expect(grid.circleBounds(-35, 30, 12)).toEqual({ firstColumn: 0, firstRow: 5, lastColumn: 1, lastRow: 7 });
  });
});

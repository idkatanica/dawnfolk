import { describe, expect, it } from "vitest";
import { SURFACE_CHANNELS } from "../world/agent-buffers.ts";
import { allRows, packChangedSurfaceRows, packSurfaceRows } from "./frame-packing.ts";
import { createTestWorld } from "./testing/test-world.ts";

describe("surface rows", () => {
  it("send only the rows whose bytes changed since they were last sent", () => {
    const world = createTestWorld({ dimensions: { cellSize: 10, cellsPerSide: 32 } });
    const { fields, grid } = world;

    const bytesPerRow = grid.cellsPerSide * SURFACE_CHANNELS;
    const [initial] = packSurfaceRows(world, allRows(world));
    const sent = initial.data.slice();
    const marked = [{ firstRow: 0, rowCount: 16 }];

    fields.wetness[grid.index(4, 3)] = 0.5;
    fields.snow[grid.index(0, 4)] = 0.6;
    fields.fire[grid.index(9, 10)] = 0.3;
    fields.scorch[grid.index(1, 12)] = 0.0001;
    fields.wetness[grid.index(2, 15)] = 1;

    const changed = packChangedSurfaceRows(world, marked, sent);
    const [current] = packSurfaceRows(world, allRows(world));

    expect(
      changed.map(({ firstRow, rowCount }) => {
        return { firstRow, rowCount };
      })
    ).toEqual([
      { firstRow: 3, rowCount: 2 },
      { firstRow: 10, rowCount: 1 },
      { firstRow: 15, rowCount: 1 },
    ]);
    expect(changed[0].data).toEqual(current.data.slice(3 * bytesPerRow, 5 * bytesPerRow));
    expect(sent).toEqual(current.data);
    expect(packChangedSurfaceRows(world, marked, sent)).toEqual([]);
  });
});

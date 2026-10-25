import { describe, expect, it } from "vitest";
import { createRandom } from "../../shared/random.ts";
import type { CellRegion } from "../../world/change-tracking.ts";
import { NO_WATER } from "../../world/water.ts";
import {
  BANK_SINK,
  buildShoreField,
  DRY_DEPTH,
  MAXIMUM_REACH,
  NOT_POND,
  SHORE_CHANNELS,
  ShoreChannel,
  type ShoreSource,
  updateShoreDepths,
  updateShoreField,
} from "./shore-field.ts";

const SIZE = 8;
const CELL_SIZE = 10;
const BANK_HEIGHT = 12;
const RIVER_ROW = 3;

function riverLevel(column: number): number {
  return 10 - column * 0.5;
}

function createSource(): ShoreSource {
  const heights = new Float32Array(SIZE * SIZE).fill(BANK_HEIGHT);
  const levels = new Float32Array(SIZE * SIZE).fill(NO_WATER);

  for (let column = 0; column < SIZE; column += 1) {
    const cell = RIVER_ROW * SIZE + column;

    levels[cell] = riverLevel(column);
    heights[cell] = riverLevel(column) - 1;
  }

  return { cellSize: CELL_SIZE, heights, levels, pondDepths: new Float32Array(SIZE * SIZE).fill(NOT_POND), size: SIZE };
}

function build(source: ShoreSource): Float32Array {
  const target = new Float32Array(source.size * source.size * SHORE_CHANNELS);

  buildShoreField(source, target);

  return target;
}

function valueAt(field: Float32Array, column: number, row: number, channel: number): number {
  return field[(row * SIZE + column) * SHORE_CHANNELS + channel];
}

describe("buildShoreField", () => {
  it("stores the depth and the downhill slope of wet cells", () => {
    const field = build(createSource());

    expect(valueAt(field, 3, RIVER_ROW, ShoreChannel.Depth)).toBeCloseTo(1);
    expect(valueAt(field, 3, RIVER_ROW, ShoreChannel.FlowX)).toBeCloseTo((riverLevel(2) - riverLevel(4)) / 20);
    expect(valueAt(field, 3, RIVER_ROW, ShoreChannel.FlowZ)).toBe(0);
  });

  it("sinks banks below the water beside them and keeps far ground dry", () => {
    const field = build(createSource());

    expect(valueAt(field, 3, RIVER_ROW - 1, ShoreChannel.Depth)).toBeCloseTo(riverLevel(3) - BANK_HEIGHT);
    expect(valueAt(field, 3, RIVER_ROW - 1, ShoreChannel.Depth)).toBeLessThan(-BANK_SINK);
    expect(valueAt(field, 3, 0, ShoreChannel.Depth)).toBe(DRY_DEPTH);
  });

  it("measures how many cells away the nearest water is", () => {
    const field = build(createSource());

    expect(valueAt(field, 5, RIVER_ROW, ShoreChannel.Reach)).toBe(0);
    expect(valueAt(field, 5, RIVER_ROW + 2, ShoreChannel.Reach)).toBe(2);
    expect(valueAt(field, 0, SIZE - 1, ShoreChannel.Reach)).toBe(SIZE - 1 - RIVER_ROW);
  });

  it("caps the reach far from any water", () => {
    const size = MAXIMUM_REACH + 4;
    const levels = new Float32Array(size * size).fill(NO_WATER);

    levels[0] = 1;

    const field = build({
      cellSize: CELL_SIZE,
      heights: new Float32Array(size * size),
      levels,
      pondDepths: new Float32Array(size * size).fill(NOT_POND),
      size,
    });

    expect(field[(size * size - 1) * SHORE_CHANNELS + ShoreChannel.Reach]).toBe(MAXIMUM_REACH);
  });

  it("puts the shore of deep water halfway to a low bank instead of against it", () => {
    const source = createSource();

    for (let column = 0; column < SIZE; column += 1) {
      const river = RIVER_ROW * SIZE + column;

      source.heights[river] = riverLevel(column) - 4;
      source.heights[river - SIZE] = riverLevel(column) + 0.1;
    }

    const field = build(source);

    const water = valueAt(field, 3, RIVER_ROW, ShoreChannel.Depth);
    const bank = valueAt(field, 3, RIVER_ROW - 1, ShoreChannel.Depth);

    expect(water).toBeCloseTo(4);
    expect(bank).toBeCloseTo(-4);
    expect((water + bank) / 2).toBeCloseTo(0);
  });

  it("shades the dry shore of a pond by its distance from the pond's outline so the edge can curve", () => {
    const source = createSource();

    for (let column = 0; column < SIZE; column += 1) {
      const river = RIVER_ROW * SIZE + column;

      source.heights[river] = riverLevel(column) - 1;
      source.heights[river - SIZE] = riverLevel(column) + 0.2;
      source.pondDepths[river - SIZE] = -column * 0.2;
    }

    const field = build(source);

    expect(valueAt(field, 1, RIVER_ROW - 1, ShoreChannel.Depth)).toBeCloseTo(-0.2);
    expect(valueAt(field, 4, RIVER_ROW - 1, ShoreChannel.Depth)).toBeCloseTo(-0.8);
    expect(valueAt(field, 3, RIVER_ROW + 1, ShoreChannel.Depth)).toBeLessThan(-BANK_SINK);
  });

  it("joins water that steps diagonally from cell to cell", () => {
    const heights = new Float32Array(SIZE * SIZE).fill(3);
    const levels = new Float32Array(SIZE * SIZE).fill(NO_WATER);

    for (let index = 0; index < SIZE; index += 1) {
      levels[index * SIZE + index] = 1;
      heights[index * SIZE + index] = 0;
    }

    const field = build({
      cellSize: CELL_SIZE,
      heights,
      levels,
      pondDepths: new Float32Array(SIZE * SIZE).fill(NOT_POND),
      size: SIZE,
    });

    const quadCenter =
      (valueAt(field, 2, 2, ShoreChannel.Depth) +
        valueAt(field, 3, 2, ShoreChannel.Depth) +
        valueAt(field, 2, 3, ShoreChannel.Depth) +
        valueAt(field, 3, 3, ShoreChannel.Depth)) /
      4;

    expect(quadCenter).toBeGreaterThan(0);
    expect(valueAt(field, 3, 2, ShoreChannel.Depth)).toBeLessThan(0);
  });
});

describe("updateShoreDepths", () => {
  it("matches a full rebuild after the ground changes in a region", () => {
    const source = createSource();
    const field = build(source);

    for (let column = 2; column <= 4; column += 1) {
      source.heights[(RIVER_ROW - 1) * SIZE + column] = riverLevel(column) + 0.5;
      source.heights[RIVER_ROW * SIZE + column] = riverLevel(column) - 3;
    }

    updateShoreDepths(source, { firstColumn: 2, firstRow: RIVER_ROW - 1, lastColumn: 4, lastRow: RIVER_ROW }, field);

    expect(Array.from(field)).toEqual(Array.from(build(source)));
  });
});

describe("updateShoreField", () => {
  const LAKE: CellRegion = { firstColumn: 18, firstRow: 18, lastColumn: 21, lastRow: 21 };

  function createDrySource(size: number): ShoreSource {
    return {
      cellSize: CELL_SIZE,
      heights: new Float32Array(size * size),
      levels: new Float32Array(size * size).fill(NO_WATER),
      pondDepths: new Float32Array(size * size).fill(NOT_POND),
      size,
    };
  }

  function setLevels(source: ShoreSource, region: CellRegion, level: number): void {
    for (let row = region.firstRow; row <= region.lastRow; row += 1) {
      for (let column = region.firstColumn; column <= region.lastColumn; column += 1) {
        source.levels[row * source.size + column] = level;
      }
    }
  }

  function reachAt(source: ShoreSource, field: Float32Array, column: number, row: number): number {
    return field[(row * source.size + column) * SHORE_CHANNELS + ShoreChannel.Reach];
  }

  it("matches a full rebuild as a lake fills and drains, as far as the reach goes", () => {
    const source = createDrySource(40);
    const field = build(source);

    setLevels(source, LAKE, 1);
    updateShoreField(source, LAKE, field);

    expect(Array.from(field)).toEqual(Array.from(build(source)));
    expect(reachAt(source, field, LAKE.lastColumn + MAXIMUM_REACH - 1, LAKE.lastRow)).toBe(MAXIMUM_REACH - 1);

    setLevels(source, LAKE, NO_WATER);
    updateShoreField(source, LAKE, field);

    expect(Array.from(field)).toEqual(Array.from(build(source)));
    expect(reachAt(source, field, LAKE.lastColumn + MAXIMUM_REACH - 1, LAKE.lastRow)).toBe(MAXIMUM_REACH);
  });

  it.each([
    [{ firstColumn: 26, firstRow: 24, lastColumn: 36, lastRow: 30 }],
    [{ firstColumn: 0, firstRow: 50, lastColumn: 9, lastRow: 63 }],
    [{ firstColumn: 60, firstRow: 0, lastColumn: 63, lastRow: 3 }],
  ])("matches a full rebuild after the levels change in %o among scattered water", (region) => {
    const size = 64;
    const random = createRandom(7);
    const source = createDrySource(size);

    for (let cell = 0; cell < size * size; cell += 1) {
      source.heights[cell] = random.between(0, 4);
      source.levels[cell] = random.chance(0.01) ? source.heights[cell] + random.between(0.1, 2) : NO_WATER;
    }

    const field = build(source);

    for (let row = region.firstRow; row <= region.lastRow; row += 1) {
      for (let column = region.firstColumn; column <= region.lastColumn; column += 1) {
        const cell = row * size + column;

        source.levels[cell] = random.chance(0.3) ? source.heights[cell] + random.between(0.1, 2) : NO_WATER;
      }
    }

    updateShoreField(source, region, field);

    expect(Array.from(field)).toEqual(Array.from(build(source)));
  });
});

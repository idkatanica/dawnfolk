import { describe, expect, it } from "vitest";
import { NO_WATER } from "../../world/water.ts";
import {
  BANK_SINK,
  buildShoreField,
  DRY_DEPTH,
  MAXIMUM_REACH,
  SHORE_CHANNELS,
  ShoreChannel,
  type ShoreSource,
  updateShoreDepths,
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

  return { cellSize: CELL_SIZE, heights, levels, size: SIZE };
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
    const source = createSource();
    const field = build(source);

    expect(valueAt(field, 5, RIVER_ROW, ShoreChannel.Reach)).toBe(0);
    expect(valueAt(field, 5, RIVER_ROW + 2, ShoreChannel.Reach)).toBe(2);
    expect(valueAt(field, 0, SIZE - 1, ShoreChannel.Reach)).toBe(SIZE - 1 - RIVER_ROW);
  });

  it("caps the reach far from any water", () => {
    const size = MAXIMUM_REACH + 4;
    const levels = new Float32Array(size * size).fill(NO_WATER);
    const target = new Float32Array(size * size * SHORE_CHANNELS);

    levels[0] = 1;
    buildShoreField({ cellSize: CELL_SIZE, heights: new Float32Array(size * size), levels, size }, target);

    expect(target[(size * size - 1) * SHORE_CHANNELS + ShoreChannel.Reach]).toBe(MAXIMUM_REACH);
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

  it("joins water that steps diagonally from cell to cell", () => {
    const heights = new Float32Array(SIZE * SIZE).fill(3);
    const levels = new Float32Array(SIZE * SIZE).fill(NO_WATER);

    for (let index = 0; index < SIZE; index += 1) {
      levels[index * SIZE + index] = 1;
      heights[index * SIZE + index] = 0;
    }

    const field = build({ cellSize: CELL_SIZE, heights, levels, size: SIZE });

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

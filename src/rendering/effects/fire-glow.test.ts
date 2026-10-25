import { describe, expect, it } from "vitest";
import { WorldGrid } from "../../world/world-grid.ts";
import { type BurningCells, FireGlow } from "./fire-glow.ts";

const GRID = new WorldGrid({ cellSize: 10, cellsPerSide: 512 });
const TEXELS_PER_SIDE = 128;

function burning(cells: readonly number[], intensity = 255): BurningCells {
  return {
    burningCells: Int32Array.from(cells),
    burningIntensity: Uint8Array.from(cells.map(() => intensity)),
  };
}

function texelAt(glow: FireGlow, column: number, row: number): number {
  const { data } = glow.texture.image;

  if (!(data instanceof Uint8Array)) {
    throw new Error("The glow texture should hold bytes");
  }

  return data[row * TEXELS_PER_SIDE + column];
}

function blaze(centerColumn: number, centerRow: number, radius: number): number[] {
  const cells: number[] = [];

  for (let row = centerRow - radius; row <= centerRow + radius; row += 1) {
    for (let column = centerColumn - radius; column <= centerColumn + radius; column += 1) {
      cells.push(GRID.index(column, row));
    }
  }

  return cells;
}

describe("fire glow", () => {
  it("stays dark while nothing burns", () => {
    const glow = new FireGlow(GRID);

    const { version } = glow.texture;

    glow.update(burning([]));

    expect(glow.texture.version).toBe(version);
    expect(texelAt(glow, 64, 64)).toBe(0);
  });

  it("lights the texels around a fire and fades with distance", () => {
    const glow = new FireGlow(GRID);

    glow.update(burning(blaze(256, 256, 12)));

    const center = texelAt(glow, 64, 64);
    const edge = texelAt(glow, 70, 64);

    expect(center).toBeGreaterThan(edge);
    expect(edge).toBeGreaterThan(0);
    expect(texelAt(glow, 90, 64)).toBe(0);
  });

  it("follows the intensity of the flames", () => {
    const strong = new FireGlow(GRID);
    const weak = new FireGlow(GRID);

    strong.update(burning(blaze(256, 256, 4), 255));
    weak.update(burning(blaze(256, 256, 4), 60));

    expect(texelAt(strong, 64, 64)).toBeGreaterThan(texelAt(weak, 64, 64));
  });

  it("goes dark once the fire is out", () => {
    const glow = new FireGlow(GRID);

    glow.update(burning(blaze(256, 256, 8)));
    glow.update(burning([]));

    expect(texelAt(glow, 64, 64)).toBe(0);
  });

  it("skips a frame it has already drawn", () => {
    const glow = new FireGlow(GRID);
    const frame = burning(blaze(80, 80, 6));

    glow.update(frame);

    const { version } = glow.texture;

    glow.update(frame);

    expect(glow.texture.version).toBe(version);
  });
});

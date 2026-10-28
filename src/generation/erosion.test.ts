import { describe, expect, it } from "vitest";
import { createRandom } from "../shared/random.ts";
import { erodeAcrossScales, limitSlopes, relaxSlopes } from "./erosion.ts";

const CELL_SIZE = 10;
const NEIGHBORS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

function steepestSlope(heights: Float32Array, size: number): number {
  let steepest = 0;

  for (let row = 1; row < size - 1; row += 1) {
    for (let column = 1; column < size - 1; column += 1) {
      for (const [columnStep, rowStep] of NEIGHBORS) {
        const drop = Math.abs(heights[row * size + column] - heights[(row + rowStep) * size + column + columnStep]);

        steepest = Math.max(steepest, drop / (Math.hypot(columnStep, rowStep) * CELL_SIZE));
      }
    }
  }

  return steepest;
}

function sumOf(heights: Float32Array): number {
  return heights.reduce((total, height) => total + height, 0);
}

function cone(size: number, summit: number): Float32Array {
  const heights = new Float32Array(size * size);
  const center = (size - 1) / 2;

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      heights[row * size + column] = 100 + Math.max(0, summit - Math.hypot(column - center, row - center) * 9);
    }
  }

  return heights;
}

describe("thermal relaxation", () => {
  it("settles a spike into a slope at the talus angle without losing material", () => {
    const size = 32;
    const heights = new Float32Array(size * size).fill(100);

    heights[16 * size + 16] = 300;

    const before = sumOf(heights);
    const iterations = relaxSlopes(heights, size, CELL_SIZE, new Float32Array(size * size).fill(0.8), 1000);

    expect(iterations).toBeLessThan(1000);
    expect(steepestSlope(heights, size)).toBeLessThan(0.81);
    expect(sumOf(heights)).toBeCloseTo(before, -1);
  });
});

describe("slope limit", () => {
  it("keeps every neighbor drop under the limit and never raises the land", () => {
    const size = 40;
    const random = createRandom(4);
    const original = Float32Array.from({ length: size * size }, () => random.between(0, 400));

    const heights = Float32Array.from(original);

    limitSlopes(heights, size, CELL_SIZE, 1.2);

    expect(steepestSlope(heights, size)).toBeLessThan(1.2 + 1e-4);
    expect(heights.every((height, cell) => height <= original[cell])).toBe(true);
  });
});

describe("erosion across scales", () => {
  const size = 64;
  const scales = [
    { dropletsPerCell: 1.5, factor: 4 },
    { dropletsPerCell: 1.5, factor: 2 },
    { dropletsPerCell: 1, factor: 1 },
  ];

  function erode(resistance: number): Float32Array {
    const heights = cone(size, 500);

    erodeAcrossScales(heights, size, createRandom(3), {
      coarseReach: new Float32Array(size * size).fill(1),
      resistance: new Float32Array(size * size).fill(resistance),
      scales,
    });

    return heights;
  }

  it("cuts the same valleys for the same seed", () => {
    const eroded = erode(0);

    expect(erode(0)).toEqual(eroded);
    expect(Math.max(...eroded)).toBeLessThan(Math.max(...cone(size, 500)));
  });

  it("leaves fully resistant rock untouched", () => {
    const untouched = cone(size, 500);

    const largestChange = erode(1).reduce(
      (largest, height, cell) => Math.max(largest, Math.abs(height - untouched[cell])),
      0
    );

    expect(largestChange).toBeLessThan(1e-3);
  });
});

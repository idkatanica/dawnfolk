import { lerp } from "../shared/math.ts";
import type { RandomSource } from "../shared/random.ts";

export interface HydraulicErosionOptions {
  brushRadius: number;
  capacity: number;
  depositionSpeed: number;
  dropletCount: number;
  erosionSpeed: number;
  evaporation: number;
  gravity: number;
  heightScale: number;
  inertia: number;
  maximumSteps: number;
  minimumCapacity: number;
}

export const DEFAULT_HYDRAULIC_EROSION: Omit<HydraulicErosionOptions, "dropletCount"> = {
  brushRadius: 3,
  capacity: 4,
  depositionSpeed: 0.3,
  erosionSpeed: 0.32,
  evaporation: 0.012,
  gravity: 4,
  heightScale: 1600,
  inertia: 0.06,
  maximumSteps: 60,
  minimumCapacity: 0.01,
};

interface ErosionBrush {
  columns: Int32Array;
  rows: Int32Array;
  weights: Float32Array;
}

interface SurfaceSample {
  gradientX: number;
  gradientZ: number;
  height: number;
}

function createBrush(radius: number): ErosionBrush {
  const columns: number[] = [];
  const rows: number[] = [];
  const weights: number[] = [];
  let weightSum = 0;

  for (let row = -radius; row <= radius; row += 1) {
    for (let column = -radius; column <= radius; column += 1) {
      const distanceFromCenter = Math.sqrt(column * column + row * row);

      if (distanceFromCenter <= radius) {
        const weight = 1 - distanceFromCenter / radius;

        columns.push(column);
        rows.push(row);
        weights.push(weight);
        weightSum += weight;
      }
    }
  }

  return {
    columns: Int32Array.from(columns),
    rows: Int32Array.from(rows),
    weights: Float32Array.from(weights, (weight) => weight / weightSum),
  };
}

function sampleSurface(map: Float32Array, size: number, x: number, z: number, sample: SurfaceSample): void {
  const column = Math.floor(x);
  const row = Math.floor(z);

  const offsetX = x - column;
  const offsetZ = z - row;
  const index = row * size + column;

  const northWest = map[index];
  const northEast = map[index + 1];
  const southWest = map[index + size];
  const southEast = map[index + size + 1];

  sample.gradientX = (northEast - northWest) * (1 - offsetZ) + (southEast - southWest) * offsetZ;
  sample.gradientZ = (southWest - northWest) * (1 - offsetX) + (southEast - northEast) * offsetX;
  sample.height = lerp(lerp(northWest, northEast, offsetX), lerp(southWest, southEast, offsetX), offsetZ);
}

function deposit(map: Float32Array, size: number, x: number, z: number, amount: number): void {
  const column = Math.floor(x);
  const row = Math.floor(z);

  const offsetX = x - column;
  const offsetZ = z - row;
  const index = row * size + column;

  map[index] += amount * (1 - offsetX) * (1 - offsetZ);
  map[index + 1] += amount * offsetX * (1 - offsetZ);
  map[index + size] += amount * (1 - offsetX) * offsetZ;
  map[index + size + 1] += amount * offsetX * offsetZ;
}

function erode(map: Float32Array, size: number, brush: ErosionBrush, x: number, z: number, amount: number): number {
  const centerColumn = Math.floor(x);
  const centerRow = Math.floor(z);
  let removed = 0;

  for (let brushIndex = 0; brushIndex < brush.weights.length; brushIndex += 1) {
    const column = centerColumn + brush.columns[brushIndex];
    const row = centerRow + brush.rows[brushIndex];

    if (column < 0 || row < 0 || column >= size || row >= size) {
      continue;
    }

    const index = row * size + column;

    const take = Math.min(map[index], amount * brush.weights[brushIndex]);

    map[index] -= take;
    removed += take;
  }

  return removed;
}

function depositedAmount(heightChange: number, sediment: number, capacity: number, depositionSpeed: number): number {
  if (heightChange > 0) {
    return Math.min(heightChange, sediment);
  }

  return (sediment - capacity) * depositionSpeed;
}

function simulateDroplet(
  map: Float32Array,
  size: number,
  brush: ErosionBrush,
  random: RandomSource,
  options: HydraulicErosionOptions
): void {
  const limit = size - 2;
  const sample: SurfaceSample = { gradientX: 0, gradientZ: 0, height: 0 };

  let directionX = 0;
  let directionZ = 0;
  let speed = 1;
  let water = 1;
  let sediment = 0;

  let x = random.next() * limit;
  let z = random.next() * limit;

  for (let step = 0; step < options.maximumSteps; step += 1) {
    sampleSurface(map, size, x, z, sample);

    const startHeight = sample.height;

    directionX = directionX * options.inertia - sample.gradientX * (1 - options.inertia);
    directionZ = directionZ * options.inertia - sample.gradientZ * (1 - options.inertia);

    const length = Math.hypot(directionX, directionZ);

    if (length < 1e-9) {
      return;
    }

    const previousX = x;
    const previousZ = z;

    directionX /= length;
    directionZ /= length;
    x += directionX;
    z += directionZ;

    if (x < 0 || x >= limit || z < 0 || z >= limit) {
      return;
    }

    sampleSurface(map, size, x, z, sample);

    const heightChange = sample.height - startHeight;

    const capacity = Math.max(-heightChange * speed * water * options.capacity, options.minimumCapacity);

    if (sediment > capacity || heightChange > 0) {
      const amount = depositedAmount(heightChange, sediment, capacity, options.depositionSpeed);

      sediment -= amount;
      deposit(map, size, previousX, previousZ, amount);
    } else {
      const amount = Math.min((capacity - sediment) * options.erosionSpeed, -heightChange);

      sediment += erode(map, size, brush, previousX, previousZ, amount);
    }

    speed = Math.sqrt(Math.max(0, speed * speed - heightChange * options.gravity));
    water *= 1 - options.evaporation;
  }
}

export function erodeHydraulically(
  heights: Float32Array,
  size: number,
  random: RandomSource,
  options: HydraulicErosionOptions,
  onProgress: (progress: number) => void
): void {
  const map = Float32Array.from(heights, (height) => height / options.heightScale);
  const brush = createBrush(options.brushRadius);
  const reportEvery = Math.max(1, Math.floor(options.dropletCount / 20));

  for (let droplet = 0; droplet < options.dropletCount; droplet += 1) {
    simulateDroplet(map, size, brush, random, options);

    if (droplet % reportEvery === 0) {
      onProgress(droplet / options.dropletCount);
    }
  }

  for (const [index, value] of map.entries()) {
    heights[index] = value * options.heightScale;
  }
}

export function erodeThermally(
  heights: Float32Array,
  size: number,
  cellSize: number,
  iterations: number,
  talusSlope: number
): void {
  const maximumDrop = talusSlope * cellSize;
  const change = new Float32Array(heights.length);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    change.fill(0);

    for (let row = 1; row < size - 1; row += 1) {
      for (let column = 1; column < size - 1; column += 1) {
        relaxCell(heights, change, row * size + column, size, maximumDrop);
      }
    }

    for (const [index, value] of change.entries()) {
      heights[index] += value;
    }
  }
}

function relaxCell(
  heights: Float32Array,
  change: Float32Array,
  index: number,
  size: number,
  maximumDrop: number
): void {
  const neighbors = [index - 1, index + 1, index - size, index + size];
  const height = heights[index];
  let total = 0;
  let steepest = 0;

  for (const neighbor of neighbors) {
    const drop = height - heights[neighbor];

    if (drop > maximumDrop) {
      total += drop - maximumDrop;
      steepest = Math.max(steepest, drop);
    }
  }

  if (total <= 0) {
    return;
  }

  const moved = 0.25 * (steepest - maximumDrop);

  for (const neighbor of neighbors) {
    const drop = height - heights[neighbor];

    if (drop > maximumDrop) {
      const share = (moved * (drop - maximumDrop)) / total;

      change[neighbor] += share;
      change[index] -= share;
    }
  }
}

export function smoothHeights(heights: Float32Array, size: number, passes: number, strength: number): void {
  const smoothed = new Float32Array(heights.length);

  for (let pass = 0; pass < passes; pass += 1) {
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        const index = row * size + column;
        const left = heights[row * size + Math.max(0, column - 1)];
        const right = heights[row * size + Math.min(size - 1, column + 1)];
        const up = heights[Math.max(0, row - 1) * size + column];
        const down = heights[Math.min(size - 1, row + 1) * size + column];

        smoothed[index] = lerp(heights[index], (left + right + up + down) * 0.25, strength);
      }
    }

    heights.set(smoothed);
  }
}

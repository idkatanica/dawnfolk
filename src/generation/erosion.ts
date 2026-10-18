import { lerp } from "../shared/math.ts";
import type { RandomSource } from "../shared/random.ts";

interface HydraulicErosionOptions {
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

const DEFAULT_HYDRAULIC_EROSION: Omit<HydraulicErosionOptions, "dropletCount"> = {
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

const SETTLED_EXCESS = 0.02;

interface ErosionBrush {
  columns: Int32Array;
  offsets: Int32Array;
  radius: number;
  rows: Int32Array;
  weights: Float32Array;
}

interface SurfaceSample {
  gradientX: number;
  gradientZ: number;
  height: number;
}

interface Neighborhood {
  columns: Int32Array;
  distances: Float32Array;
  offsets: Int32Array;
  rows: Int32Array;
}

function createBrush(radius: number, size: number): ErosionBrush {
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
    offsets: Int32Array.from(columns, (column, index) => rows[index] * size + column),
    radius,
    rows: Int32Array.from(rows),
    weights: Float32Array.from(weights, (weight) => weight / weightSum),
  };
}

function createNeighborhood(size: number): Neighborhood {
  const columns = Int32Array.of(-1, 1, 0, 0, -1, 1, -1, 1);
  const rows = Int32Array.of(0, 0, -1, 1, -1, -1, 1, 1);

  return {
    columns,
    distances: Float32Array.of(1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2),
    offsets: columns.map((column, index) => rows[index] * size + column),
    rows,
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
  const center = centerRow * size + centerColumn;
  const isInside =
    centerColumn >= brush.radius &&
    centerRow >= brush.radius &&
    centerColumn < size - brush.radius &&
    centerRow < size - brush.radius;

  let removed = 0;

  for (let brushIndex = 0; brushIndex < brush.weights.length; brushIndex += 1) {
    if (!(isInside || isOnMap(centerColumn + brush.columns[brushIndex], centerRow + brush.rows[brushIndex], size))) {
      continue;
    }

    const index = center + brush.offsets[brushIndex];

    const take = Math.min(map[index], amount * brush.weights[brushIndex]);

    map[index] -= take;
    removed += take;
  }

  return removed;
}

function isOnMap(column: number, row: number, size: number): boolean {
  return column >= 0 && row >= 0 && column < size && row < size;
}

function depositedAmount(heightChange: number, sediment: number, capacity: number, depositionSpeed: number): number {
  if (heightChange > 0) {
    return Math.min(heightChange, sediment);
  }

  return (sediment - capacity) * depositionSpeed;
}

interface DropletTerrain {
  readonly brush: ErosionBrush;
  readonly map: Float32Array;
  readonly resistance: Float32Array;
  readonly size: number;
}

function simulateDroplet(
  terrain: DropletTerrain,
  random: RandomSource,
  options: HydraulicErosionOptions,
  sample: SurfaceSample
): void {
  const { brush, map, size } = terrain;
  const limit = size - 2;

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

    const length = Math.sqrt(directionX * directionX + directionZ * directionZ);

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
      const softness = 1 - terrain.resistance[Math.floor(previousZ) * size + Math.floor(previousX)];
      const amount = Math.min((capacity - sediment) * options.erosionSpeed, -heightChange) * softness;

      sediment += erode(map, size, brush, previousX, previousZ, amount);
    }

    speed = Math.sqrt(Math.max(0, speed * speed - heightChange * options.gravity));
    water *= 1 - options.evaporation;
  }
}

function erodeHydraulically(
  heights: Float32Array,
  resistance: Float32Array,
  random: RandomSource,
  options: HydraulicErosionOptions,
  onProgress: (progress: number) => void
): void {
  const size = Math.round(Math.sqrt(heights.length));
  const map = Float32Array.from(heights, (height) => height / options.heightScale);
  const terrain: DropletTerrain = { brush: createBrush(options.brushRadius, size), map, resistance, size };
  const sample: SurfaceSample = { gradientX: 0, gradientZ: 0, height: 0 };
  const reportEvery = Math.max(1, Math.floor(options.dropletCount / 20));

  for (let droplet = 0; droplet < options.dropletCount; droplet += 1) {
    simulateDroplet(terrain, random, options, sample);

    if (droplet % reportEvery === 0) {
      onProgress(droplet / options.dropletCount);
    }
  }

  for (const [index, value] of map.entries()) {
    heights[index] = value * options.heightScale;
  }
}

function downsample(heights: Float32Array, size: number, factor: number): Float32Array {
  const coarseSize = size / factor;
  const coarse = new Float32Array(coarseSize * coarseSize);
  const share = 1 / (factor * factor);

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      coarse[Math.floor(row / factor) * coarseSize + Math.floor(column / factor)] +=
        heights[row * size + column] * share;
    }
  }

  return coarse;
}

function coarseCoordinate(fine: number, factor: number, coarseSize: number): number {
  return Math.min(Math.max((fine - (factor - 1) / 2) / factor, 0), coarseSize - 1);
}

function addUpsampledChange(
  heights: Float32Array,
  size: number,
  change: Float32Array,
  factor: number,
  reach: Float32Array
): void {
  const coarseSize = size / factor;
  const last = coarseSize - 1;

  for (let row = 0; row < size; row += 1) {
    const coarseRow = coarseCoordinate(row, factor, coarseSize);

    const top = Math.floor(coarseRow);
    const bottom = Math.min(last, top + 1);
    const downward = coarseRow - top;

    for (let column = 0; column < size; column += 1) {
      const coarseColumn = coarseCoordinate(column, factor, coarseSize);

      const left = Math.floor(coarseColumn);
      const right = Math.min(last, left + 1);
      const rightward = coarseColumn - left;

      const upper = lerp(change[top * coarseSize + left], change[top * coarseSize + right], rightward);
      const lower = lerp(change[bottom * coarseSize + left], change[bottom * coarseSize + right], rightward);

      heights[row * size + column] += lerp(upper, lower, downward) * reach[row * size + column];
    }
  }
}

export interface ErosionScale {
  readonly dropletsPerCell: number;
  readonly factor: number;
}

export interface ErosionPlan {
  readonly coarseReach: Float32Array;
  readonly resistance: Float32Array;
  readonly scales: readonly ErosionScale[];
}

export function erodeAcrossScales(
  heights: Float32Array,
  size: number,
  random: RandomSource,
  { coarseReach, resistance, scales }: ErosionPlan,
  onProgress: (progress: number) => void
): void {
  for (const [index, scale] of scales.entries()) {
    const coarseSize = size / scale.factor;
    const report = (progress: number) => onProgress((index + progress) / scales.length);
    const options = {
      ...DEFAULT_HYDRAULIC_EROSION,
      dropletCount: Math.round(coarseSize * coarseSize * scale.dropletsPerCell),
    };

    if (scale.factor === 1) {
      erodeHydraulically(heights, resistance, random, options, report);

      continue;
    }

    const coarse = downsample(heights, size, scale.factor);
    const before = Float32Array.from(coarse);

    erodeHydraulically(coarse, downsample(resistance, size, scale.factor), random, options, report);
    addUpsampledChange(
      heights,
      size,
      coarse.map((height, cell) => height - before[cell]),
      scale.factor,
      coarseReach
    );
  }
}

interface SlopeRelaxation {
  readonly active: Uint8Array;
  readonly cellSize: number;
  readonly change: Float32Array;
  readonly heights: Float32Array;
  readonly neighborhood: Neighborhood;
  readonly size: number;
  readonly talus: Float32Array;
}

function shedExcess(relaxation: SlopeRelaxation, column: number, row: number): boolean {
  const { change, heights, neighborhood, size } = relaxation;
  const cell = row * size + column;
  const height = heights[cell];
  const allowedDrop = relaxation.talus[cell] * relaxation.cellSize;

  let total = 0;
  let largest = 0;

  for (let neighbor = 0; neighbor < 8; neighbor += 1) {
    if (!isOnMap(column + neighborhood.columns[neighbor], row + neighborhood.rows[neighbor], size)) {
      continue;
    }

    const excess =
      height - heights[cell + neighborhood.offsets[neighbor]] - allowedDrop * neighborhood.distances[neighbor];

    if (excess > 0) {
      total += excess;
      largest = Math.max(largest, excess);
    }
  }

  if (largest <= SETTLED_EXCESS) {
    return false;
  }

  const moved = 0.5 * largest;

  for (let neighbor = 0; neighbor < 8; neighbor += 1) {
    if (!isOnMap(column + neighborhood.columns[neighbor], row + neighborhood.rows[neighbor], size)) {
      continue;
    }

    const target = cell + neighborhood.offsets[neighbor];

    const excess = height - heights[target] - allowedDrop * neighborhood.distances[neighbor];

    if (excess > 0) {
      const share = (moved * excess) / total;

      change[target] += share;
      change[cell] -= share;
    }
  }

  return true;
}

function applyRelaxation(relaxation: SlopeRelaxation): void {
  const { active, change, heights, neighborhood, size } = relaxation;

  active.fill(0);

  for (let cell = 0; cell < heights.length; cell += 1) {
    if (change[cell] === 0) {
      continue;
    }

    const column = cell % size;
    const row = (cell - column) / size;

    heights[cell] += change[cell];
    change[cell] = 0;
    active[cell] = 1;

    for (let neighbor = 0; neighbor < 8; neighbor += 1) {
      if (isOnMap(column + neighborhood.columns[neighbor], row + neighborhood.rows[neighbor], size)) {
        active[cell + neighborhood.offsets[neighbor]] = 1;
      }
    }
  }
}

export function relaxSlopes(
  heights: Float32Array,
  size: number,
  cellSize: number,
  talus: Float32Array,
  maximumIterations: number
): number {
  const relaxation: SlopeRelaxation = {
    active: new Uint8Array(heights.length).fill(1),
    cellSize,
    change: new Float32Array(heights.length),
    heights,
    neighborhood: createNeighborhood(size),
    size,
    talus,
  };

  for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
    let isSettled = true;

    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        if (relaxation.active[row * size + column] === 1 && shedExcess(relaxation, column, row)) {
          isSettled = false;
        }
      }
    }

    if (isSettled) {
      return iteration;
    }

    applyRelaxation(relaxation);
  }

  return maximumIterations;
}

function lowerToward(heights: Float32Array, cell: number, neighbor: number, allowedDrop: number): void {
  heights[cell] = Math.min(heights[cell], heights[neighbor] + allowedDrop);
}

function limitFromEarlierCells(heights: Float32Array, size: number, straight: number, diagonal: number): void {
  const last = size - 1;

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const cell = row * size + column;

      if (column > 0) {
        lowerToward(heights, cell, cell - 1, straight);
      }

      if (row === 0) {
        continue;
      }

      lowerToward(heights, cell, cell - size, straight);

      if (column > 0) {
        lowerToward(heights, cell, cell - size - 1, diagonal);
      }

      if (column < last) {
        lowerToward(heights, cell, cell - size + 1, diagonal);
      }
    }
  }
}

function limitFromLaterCells(heights: Float32Array, size: number, straight: number, diagonal: number): void {
  const last = size - 1;

  for (let row = last; row >= 0; row -= 1) {
    for (let column = last; column >= 0; column -= 1) {
      const cell = row * size + column;

      if (column < last) {
        lowerToward(heights, cell, cell + 1, straight);
      }

      if (row === last) {
        continue;
      }

      lowerToward(heights, cell, cell + size, straight);

      if (column < last) {
        lowerToward(heights, cell, cell + size + 1, diagonal);
      }

      if (column > 0) {
        lowerToward(heights, cell, cell + size - 1, diagonal);
      }
    }
  }
}

export function limitSlopes(heights: Float32Array, size: number, cellSize: number, steepestSlope: number): void {
  const straight = steepestSlope * cellSize;

  limitFromEarlierCells(heights, size, straight, straight * Math.SQRT2);
  limitFromLaterCells(heights, size, straight, straight * Math.SQRT2);
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

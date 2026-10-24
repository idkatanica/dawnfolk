import { Biome, type BiomeIndex } from "../content/biomes.ts";
import { Ground, type GroundIndex } from "../content/grounds.ts";
import { saturate } from "../shared/math.ts";
import { createNoiseSampler } from "../shared/noise.ts";
import { createRandom } from "../shared/random.ts";
import { gradientZAt, slopeAt } from "../world/footing.ts";
import { hasWater } from "../world/water.ts";
import type { WorldGrid } from "../world/world-grid.ts";
import { islandPointAt } from "./relief.ts";

interface ClimateInputs {
  desert: Float64Array;
  grid: WorldGrid;
  heights: Float32Array;
  lakeIds: Int32Array;
  riverStrength: Uint8Array;
  seed: number;
  waterSurface: Float32Array;
}

interface ClimateResult {
  baseTemperature: Float32Array;
  biome: Uint8Array;
  ground: Uint8Array;
  moisture: Float32Array;
  variation: Float32Array;
}

interface CellClimate {
  desert: number;
  height: number;
  isNearShore: boolean;
  isRiverBank: boolean;
  isWater: boolean;
  moisture: number;
  slope: number;
  temperature: number;
}

const MAXIMUM_WATER_DISTANCE = 64;
const GLACIER_TEMPERATURE = -2.4;
const ICE_CLIFF_SLOPE = 1.2;
const BARE_ROCK_SLOPE = 0.9;
const COLD_ROCK_SLOPE = 0.55;
const COLD_ROCK_TEMPERATURE = 3.2;
const ESCARPMENT_SLOPE = 0.62;
const TREE_LINE_TEMPERATURE = 1.6;
const ALPINE_SLOPE = 0.42;
const SHORE_TEMPERATURE = 3;
const WIDE_RIVER_STRENGTH = 130;
const BROAD_RIVER_STRENGTH = 85;
const RIVER_BANK_RISE = 1.4;
const RIVER_BANK_RISE_PER_CELL = 0.9;
const STEEPEST_RIVER_BANK = 0.36;

const BIOME_GROUND: Readonly<Record<BiomeIndex, GroundIndex>> = {
  [Biome.Alpine]: Ground.Rock,
  [Biome.Beach]: Ground.Sand,
  [Biome.Desert]: Ground.Sand,
  [Biome.Forest]: Ground.Forest,
  [Biome.Glacier]: Ground.Snow,
  [Biome.Meadow]: Ground.Meadow,
  [Biome.Mesa]: Ground.RedRock,
  [Biome.Scrub]: Ground.Scrub,
  [Biome.Steppe]: Ground.Steppe,
  [Biome.Swamp]: Ground.Swamp,
  [Biome.Taiga]: Ground.Forest,
  [Biome.Tundra]: Ground.Tundra,
  [Biome.Water]: Ground.Sand,
};

function baseTemperature(height: number, southness: number, desert: number): number {
  return 9.6 - (6.5 * (height - 200)) / 1000 + 5 * southness + 3.5 * desert;
}

function classifyColdOrSteep(cell: CellClimate): BiomeIndex | null {
  if (cell.temperature < GLACIER_TEMPERATURE) {
    return cell.slope > ICE_CLIFF_SLOPE ? Biome.Alpine : Biome.Glacier;
  }

  if (cell.slope > BARE_ROCK_SLOPE || (cell.slope > COLD_ROCK_SLOPE && cell.temperature < COLD_ROCK_TEMPERATURE)) {
    return cell.desert > 0.5 ? Biome.Mesa : Biome.Alpine;
  }

  if (cell.desert > 0.5 && cell.slope > ESCARPMENT_SLOPE) {
    return Biome.Mesa;
  }

  if ((cell.isNearShore || cell.isRiverBank) && cell.temperature > SHORE_TEMPERATURE) {
    return Biome.Beach;
  }

  if (cell.temperature < TREE_LINE_TEMPERATURE) {
    return cell.slope > ALPINE_SLOPE ? Biome.Alpine : Biome.Tundra;
  }

  return null;
}

function classifyDry(cell: CellClimate): BiomeIndex {
  if (cell.desert > 0.5 && cell.height > 470) {
    return Biome.Mesa;
  }

  return cell.moisture > 0.5 ? Biome.Steppe : Biome.Desert;
}

function classifyTemperate(cell: CellClimate): BiomeIndex {
  if (cell.temperature < 5) {
    return cell.moisture > 0.4 ? Biome.Taiga : Biome.Tundra;
  }

  if (cell.moisture > 0.78 && cell.slope < 0.12 && cell.height < 420) {
    return Biome.Swamp;
  }

  if (cell.temperature < 8.2) {
    if (cell.moisture > 0.5) {
      return Biome.Taiga;
    }

    return cell.moisture > 0.36 ? Biome.Meadow : Biome.Steppe;
  }

  if (cell.moisture > 0.6) {
    return Biome.Forest;
  }

  if (cell.moisture > 0.45) {
    return Biome.Meadow;
  }

  if (cell.moisture > 0.32) {
    return cell.slope > 0.45 ? Biome.Scrub : Biome.Steppe;
  }

  return cell.desert > 0.25 ? Biome.Desert : Biome.Steppe;
}

function classifyBiome(cell: CellClimate): BiomeIndex {
  if (cell.isWater) {
    return Biome.Water;
  }

  const coldOrSteep = classifyColdOrSteep(cell);

  if (coldOrSteep !== null) {
    return coldOrSteep;
  }

  if (cell.desert > 0.55) {
    return classifyDry(cell);
  }

  return classifyTemperate(cell);
}

function distanceToWater(grid: WorldGrid, waterSurface: Float32Array, heights: Float32Array): Float32Array {
  const distances = new Float32Array(grid.cellCount).fill(MAXIMUM_WATER_DISTANCE);
  const queue = new Int32Array(grid.cellCount);
  let head = 0;
  let tail = 0;

  for (const [cell, surface] of waterSurface.entries()) {
    if (hasWater(surface, heights[cell])) {
      distances[cell] = 0;
      queue[tail] = cell;
      tail += 1;
    }
  }

  while (head < tail) {
    const cell = queue[head];

    const next = distances[cell] + 1;

    head += 1;

    if (next >= MAXIMUM_WATER_DISTANCE) {
      continue;
    }

    for (const neighbor of orthogonalNeighbors(grid, cell)) {
      if (distances[neighbor] > next) {
        distances[neighbor] = next;
        queue[tail] = neighbor;
        tail += 1;
      }
    }
  }

  return distances;
}

function orthogonalNeighbors(grid: WorldGrid, cell: number): number[] {
  const column = grid.columnOf(cell);
  const row = grid.rowOf(cell);
  const neighbors: number[] = [];

  if (column > 0) {
    neighbors.push(cell - 1);
  }

  if (column < grid.cellsPerSide - 1) {
    neighbors.push(cell + 1);
  }

  if (row > 0) {
    neighbors.push(cell - grid.cellsPerSide);
  }

  if (row < grid.cellsPerSide - 1) {
    neighbors.push(cell + grid.cellsPerSide);
  }

  return neighbors;
}

interface Slopes {
  north: Float32Array;
  slope: Float32Array;
}

function northFacing(gradientZ: number, slope: number): number {
  if (slope < 1e-4) {
    return 0;
  }

  return (gradientZ / slope) * Math.min(1, slope * 3);
}

function measureSlopes(grid: WorldGrid, heights: Float32Array): Slopes {
  const slopes: Slopes = { north: new Float32Array(grid.cellCount), slope: new Float32Array(grid.cellCount) };

  for (let cell = 0; cell < grid.cellCount; cell += 1) {
    const slope = slopeAt(heights, grid, cell);

    slopes.north[cell] = northFacing(gradientZAt(heights, grid, cell), slope);
    slopes.slope[cell] = slope;
  }

  return slopes;
}

function riverBankWidth(strength: number): number {
  if (strength >= WIDE_RIVER_STRENGTH) {
    return 3;
  }

  return strength >= BROAD_RIVER_STRENGTH ? 2 : 1;
}

function markRiverBank(inputs: ClimateInputs, slopes: Float32Array, banks: Uint8Array, source: number): void {
  const { grid, heights, waterSurface } = inputs;

  const width = riverBankWidth(inputs.riverStrength[source]);
  const column = grid.columnOf(source);
  const row = grid.rowOf(source);

  for (let rowOffset = -width; rowOffset <= width; rowOffset += 1) {
    for (let columnOffset = -width; columnOffset <= width; columnOffset += 1) {
      const distance = Math.hypot(columnOffset, rowOffset);

      if (distance > width + 0.5 || !grid.contains(column + columnOffset, row + rowOffset)) {
        continue;
      }

      const cell = grid.index(column + columnOffset, row + rowOffset);

      const rise = heights[cell] - waterSurface[source];
      const isLowAndGentle = rise <= RIVER_BANK_RISE + RIVER_BANK_RISE_PER_CELL * distance;

      if (isLowAndGentle && slopes[cell] <= STEEPEST_RIVER_BANK && !hasWater(waterSurface[cell], heights[cell])) {
        banks[cell] = 1;
      }
    }
  }
}

function findRiverBanks(inputs: ClimateInputs, slopes: Float32Array): Uint8Array {
  const { heights, riverStrength, waterSurface } = inputs;

  const banks = new Uint8Array(heights.length);

  for (const [cell, strength] of riverStrength.entries()) {
    if (strength > 0 && hasWater(waterSurface[cell], heights[cell])) {
      markRiverBank(inputs, slopes, banks, cell);
    }
  }

  return banks;
}

function isStillWater(inputs: ClimateInputs, cell: number): boolean {
  if (inputs.lakeIds[cell] >= 0) {
    return true;
  }

  return inputs.riverStrength[cell] === 0 && hasWater(inputs.waterSurface[cell], inputs.heights[cell]);
}

function isNearLakeShore(inputs: ClimateInputs, column: number, row: number, height: number): boolean {
  const { grid } = inputs;

  for (let rowOffset = -3; rowOffset <= 3; rowOffset += 1) {
    for (let columnOffset = -3; columnOffset <= 3; columnOffset += 1) {
      const neighborColumn = column + columnOffset;
      const neighborRow = row + rowOffset;

      if (!grid.contains(neighborColumn, neighborRow)) {
        continue;
      }

      const neighbor = grid.index(neighborColumn, neighborRow);

      if (isStillWater(inputs, neighbor) && height < inputs.waterSurface[neighbor] + 2.6) {
        return true;
      }
    }
  }

  return false;
}

interface ShoreQuery {
  cell: number;
  column: number;
  height: number;
  isWater: boolean;
  row: number;
  waterDistance: number;
}

function isOnLakeShore(inputs: ClimateInputs, shore: ShoreQuery): boolean {
  if (shore.isWater || shore.waterDistance > 2 || inputs.riverStrength[shore.cell] !== 0) {
    return false;
  }

  return isNearLakeShore(inputs, shore.column, shore.row, shore.height);
}

function groundFor(biome: BiomeIndex, cell: CellClimate, waterLevel: number): GroundIndex {
  if (cell.isWater) {
    return cell.height > waterLevel - 1.5 ? Ground.Sand : Ground.Rock;
  }

  if (biome === Biome.Steppe && cell.moisture > 0.44 && cell.temperature < 13) {
    return Ground.Meadow;
  }

  return BIOME_GROUND[biome];
}

export function buildClimate(inputs: ClimateInputs): ClimateResult {
  const { grid, heights, waterSurface } = inputs;

  const noise = createNoiseSampler(createRandom(inputs.seed * 13 + 5));
  const waterDistance = distanceToWater(grid, waterSurface, heights);
  const slopes = measureSlopes(grid, heights);
  const riverBanks = findRiverBanks(inputs, slopes.slope);
  const result: ClimateResult = {
    baseTemperature: new Float32Array(grid.cellCount),
    biome: new Uint8Array(grid.cellCount),
    ground: new Uint8Array(grid.cellCount),
    moisture: new Float32Array(grid.cellCount),
    variation: new Float32Array(grid.cellCount),
  };

  for (let row = 0; row < grid.cellsPerSide; row += 1) {
    for (let column = 0; column < grid.cellsPerSide; column += 1) {
      const point = islandPointAt(grid, column, row);
      const cell = grid.index(column, row);
      const north = slopes.north[cell];
      const slope = slopes.slope[cell];

      const height = heights[cell];
      const desert = inputs.desert[cell];
      const moistureNoise = 0.28 * noise.fractal(point.x * 1.3 + 11, point.z * 1.3 - 7, { octaves: 4 });
      const waterInfluence = 0.36 * Math.exp(-waterDistance[cell] / 13);

      const temperature = baseTemperature(height, point.z, desert);
      const isWater = hasWater(waterSurface[cell], height);
      const moisture = saturate(0.5 + moistureNoise + waterInfluence + 0.14 * north - 0.8 * desert - 0.05 * point.z);

      const isNearShore = isOnLakeShore(inputs, {
        cell,
        column,
        height,
        isWater,
        row,
        waterDistance: waterDistance[cell],
      });

      const climate: CellClimate = {
        desert,
        height,
        isNearShore,
        isRiverBank: riverBanks[cell] === 1,
        isWater,
        moisture,
        slope,
        temperature,
      };

      const biome = classifyBiome(climate);

      result.biome[cell] = biome;
      result.ground[cell] = groundFor(biome, climate, waterSurface[cell]);
      result.baseTemperature[cell] = temperature;
      result.moisture[cell] = moisture;
      result.variation[cell] = noise.fractal(point.x * 9 + 3, point.z * 9 - 7, { octaves: 2 });
    }
  }

  return result;
}

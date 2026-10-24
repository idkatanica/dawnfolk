import { type ErodedRidgedOptions, GradientNoise, type NoiseGradient } from "../shared/gradient-noise.ts";
import { distanceToSegment, gaussian, lerp, saturate, smoothstep } from "../shared/math.ts";
import { createNoiseSampler, type NoiseSampler } from "../shared/noise.ts";
import { createRandom } from "../shared/random.ts";
import type { IslandShape } from "../world/island-shape.ts";
import type { WorldGrid } from "../world/world-grid.ts";

type Polyline = readonly (readonly [number, number])[];

const NORTHERN_RANGE: Polyline = [
  [-0.56, -0.34],
  [-0.42, -0.5],
  [-0.14, -0.44],
  [0.16, -0.52],
  [0.42, -0.44],
  [0.58, -0.5],
];

const EASTERN_RANGE: Polyline = [
  [0.54, -0.42],
  [0.5, -0.08],
  [0.56, 0.2],
];

const METERS_PER_ISLAND_UNIT = 2560;
const NORTHERN_REACH = 0.7;
const EASTERN_REACH = 0.48;
const CREST_ROUNDING = 0.05;
const SEGMENT_BLEND = 0.08;
const RANGE_BLEND = 0.1;
const CENTRAL_LAKE_DEPTH = 135;
const BOUNDARY_WOBBLE = 0.035;
const INLAND_START = 0.05;
const INLAND_END = 0.55;
const MESA_START = 0.1;
const MESA_END = 0.3;
const RIM_WIDTH = 0.2;
const UPPER_RIM_KNEE = 330;
const LOWER_RIM_KNEE = 200;
const RIM_SOFTNESS = 50;
const MESA_THRESHOLD = 0.12;
const CLIFF_WIDTH = 55;
const CLIFF_SHARE = 0.3;
const TALUS_WIDTH = 210;
const SHALLOWEST_MESA_PATTERN = 0.35;
const SHORE_HEIGHT = 185;
const SHORE_BELOW_INLAND = 15;
const OUTSIDE_SLOPE = 1500;
const DEEPEST_OUTSIDE_DROP = 200;

const RIDGE_HEIGHT = 420;
const RIDGE_FREQUENCY = 1.2;
const HILL_HEIGHT = 110;
const HILL_FREQUENCY = 2.1;

const MOUNTAIN_RIDGES: ErodedRidgedOptions = {
  damping: 6,
  gain: 0.45,
  octaves: 5,
  rounding: 0.03,
  slopeScale: (RIDGE_HEIGHT * RIDGE_FREQUENCY) / METERS_PER_ISLAND_UNIT,
};

const HILL_RIDGES: ErodedRidgedOptions = {
  damping: 4,
  gain: 0.42,
  octaves: 5,
  rounding: 0.06,
  slopeScale: (HILL_HEIGHT * HILL_FREQUENCY) / METERS_PER_ISLAND_UNIT,
};

export interface IslandPoint {
  x: number;
  z: number;
}

export function islandPointAt(grid: WorldGrid, column: number, row: number): IslandPoint {
  return { x: grid.centerX(column) / grid.halfSize, z: grid.centerZ(row) / grid.halfSize };
}

interface ReliefSample {
  coastDistance: number;
  desert: number;
  height: number;
}

export interface Relief {
  basinDepthAt: (point: IslandPoint) => number;
  boundaryDistanceAt: (point: IslandPoint) => number;
  sampleAt: (point: IslandPoint) => ReliefSample;
}

interface ReliefNoise {
  desert: NoiseSampler;
  detail: GradientNoise;
  primary: NoiseSampler;
  sample: NoiseGradient;
  secondary: NoiseSampler;
  shape: GradientNoise;
}

function desertMask(noise: NoiseSampler, point: IslandPoint): number {
  const warpedX = point.x + 0.22 * noise.fractal(point.x * 1.4 + 2, point.z * 1.4 - 5, { octaves: 3 });
  const warpedZ = point.z + 0.18 * noise.fractal(point.x * 1.4 - 7, point.z * 1.4 + 3, { octaves: 3 });

  return smoothstep(-0.05, 0.5, warpedX) * smoothstep(0.12, 0.62, warpedZ);
}

function warpPoint(noise: NoiseSampler, point: IslandPoint, octaves: number, amount: number): IslandPoint {
  const shiftX = noise.fractal(point.x * 1.1 + 5.3, point.z * 1.1 - 3.1, { octaves });
  const shiftZ = noise.fractal(point.x * 1.1 - 8.2, point.z * 1.1 + 6.4, { octaves });

  return { x: point.x + amount * shiftX, z: point.z + amount * shiftZ };
}

function distanceToBoundary(noise: NoiseSampler, point: IslandPoint): number {
  const wobble = BOUNDARY_WOBBLE * noise.fractal(point.x * 3.2 + 17, point.z * 3.2 - 4, { octaves: 2 });

  return 1 - Math.max(Math.abs(point.x), Math.abs(point.z)) + wobble;
}

function smoothMinimum(first: number, second: number, smoothness: number): number {
  const blend = Math.max(smoothness - Math.abs(first - second), 0) / smoothness;

  return Math.min(first, second) - (blend * blend * smoothness) / 4;
}

function rangeProfile(point: IslandPoint, range: Polyline, reach: number): number {
  let distance = Number.POSITIVE_INFINITY;

  for (let index = 1; index < range.length; index += 1) {
    distance = smoothMinimum(
      distance,
      distanceToSegment(point.x, point.z, range[index - 1], range[index]),
      SEGMENT_BLEND
    );
  }

  const rounded = Math.sqrt(distance * distance + CREST_ROUNDING * CREST_ROUNDING) - CREST_ROUNDING;

  return saturate(1 - rounded / reach) ** 1.6;
}

function mountainMask(outline: IslandPoint): number {
  const northern = rangeProfile(outline, NORTHERN_RANGE, NORTHERN_REACH);
  const eastern = 0.8 * rangeProfile(outline, EASTERN_RANGE, EASTERN_REACH);

  return -smoothMinimum(-northern, -eastern, RANGE_BLEND);
}

function rimHeight(height: number): number {
  if (height > UPPER_RIM_KNEE) {
    return UPPER_RIM_KNEE + RIM_SOFTNESS * Math.tanh((height - UPPER_RIM_KNEE) / RIM_SOFTNESS);
  }

  if (height < LOWER_RIM_KNEE) {
    return LOWER_RIM_KNEE - RIM_SOFTNESS * Math.tanh((LOWER_RIM_KNEE - height) / RIM_SOFTNESS);
  }

  return height;
}

function escarpmentProfile(insideMeters: number): number {
  if (insideMeters >= 0) {
    return 1;
  }

  if (insideMeters >= -CLIFF_WIDTH) {
    return 1 + (CLIFF_SHARE * insideMeters) / CLIFF_WIDTH;
  }

  const downTalus = saturate((-insideMeters - CLIFF_WIDTH) / TALUS_WIDTH);

  return (1 - CLIFF_SHARE) * (1 - downTalus) ** 1.6;
}

function desertPlateau(noise: ReliefNoise, point: IslandPoint, mesaShare: number): number {
  const pattern = noise.shape.fractal(point.x * 2.4 + 30, point.z * 2.4 - 12, 3, 0.42, noise.sample);
  const plain = 330 + 35 * noise.primary.fractal(point.x * 3 - 9, point.z * 3 + 1, { octaves: 3 });
  const tableTop = 545 + 35 * noise.primary.fractal(point.x * 6 + 3, point.z * 6 - 4, { octaves: 2 });

  const steepness = Math.max(SHALLOWEST_MESA_PATTERN, 2.4 * Math.hypot(pattern.gradientX, pattern.gradientZ));

  const insideMeters = ((pattern.value - MESA_THRESHOLD) / steepness) * METERS_PER_ISLAND_UNIT;

  return plain + (tableTop - plain) * mesaShare * escarpmentProfile(insideMeters);
}

function centralLake(point: IslandPoint): number {
  return gaussian(point.x * 0.8, point.z, 0, 0.1, 0.17);
}

function boundaryDistance(noise: ReliefNoise, island: IslandShape, point: IslandPoint, coastDistance: number): number {
  if (island.kind === "square") {
    return distanceToBoundary(noise.secondary, point);
  }

  return coastDistance;
}

function landformHeight(noise: ReliefNoise, point: IslandPoint, boundary: number, desert: number): number {
  const warped = warpPoint(noise.primary, point, 3, 0.13);
  const outline = warpPoint(noise.primary, point, 1, 0.07);
  const lake = centralLake(point);

  const inland = smoothstep(INLAND_START, INLAND_END, boundary);
  const ridges = noise.shape.erodedRidged(
    warped.x * RIDGE_FREQUENCY + 1.3,
    warped.z * RIDGE_FREQUENCY - 7.1,
    MOUNTAIN_RIDGES
  );
  const hills = noise.detail.erodedRidged(warped.x * HILL_FREQUENCY - 4, warped.z * HILL_FREQUENCY + 2, HILL_RIDGES);

  const mountains = mountainMask(outline) * inland;

  const foothills = (1 - mountains) * (1 - lake) * (1 - desert);
  const hillShare = (0.3 + 0.7 * foothills) * (0.35 + 0.65 * smoothstep(0, 0.5, mountains + 0.25));

  const tilt = 300 - 95 * point.z + 40 * point.x;
  const rolling = 70 * noise.primary.fractal(point.x * 0.9 + 2.2, point.z * 0.9 + 9.1, { octaves: 4 });
  const massif = 560 * mountains;
  const peaks = RIDGE_HEIGHT * mountains * ridges;
  const northWestMassif = 160 * gaussian(point.x, point.z, -0.42, -0.42, 0.24) * (0.45 + ridges) * inland;
  const hillCover = HILL_HEIGHT * hills * hillShare * (0.45 + 0.55 * inland);
  const southWestHills = 90 * gaussian(point.x, point.z, -0.55, 0.55, 0.45) * hills * inland;

  const height = tilt + rolling + massif + peaks + northWestMassif + hillCover + southWestHills;

  const desertLandform = smoothstep(0.25, 0.65, desert) * (1 - mountains * 0.85);

  const landform =
    desertLandform <= 0.001
      ? height
      : lerp(height, desertPlateau(noise, point, smoothstep(MESA_START, MESA_END, boundary)), desertLandform);

  return lerp(rimHeight(landform), landform, smoothstep(0, RIM_WIDTH, boundary));
}

function shoreHeight(noise: ReliefNoise, point: IslandPoint, inland: number): number {
  const shore = SHORE_HEIGHT + 40 * noise.secondary.fractal(point.x * 3.2 + 17, point.z * 3.2 - 21, { octaves: 3 });

  return Math.min(shore, inland - SHORE_BELOW_INLAND);
}

function coastalHeight(noise: ReliefNoise, point: IslandPoint, inland: number, coastDistance: number): number {
  const shore = shoreHeight(noise, point, inland);

  if (coastDistance <= 0) {
    return shore + Math.max(coastDistance * OUTSIDE_SLOPE, -DEEPEST_OUTSIDE_DROP);
  }

  const width = 0.07 + 0.11 * smoothstep(shore, shore + 900, inland);
  const cliffs = noise.secondary.ridged(point.x * 5.5 - 13, point.z * 5.5 + 4, { octaves: 3 });

  return lerp(shore, inland, smoothstep(0, width * (0.7 + 0.6 * cliffs), coastDistance));
}

function reliefSample(noise: ReliefNoise, island: IslandShape, point: IslandPoint): ReliefSample {
  const coastDistance = island.coastDistanceAt(point.x, point.z);
  const boundary = boundaryDistance(noise, island, point, coastDistance);
  const desert = desertMask(noise.desert, point);
  const landform = landformHeight(noise, point, boundary, desert);

  if (island.kind === "square") {
    return { coastDistance, desert, height: landform };
  }

  return { coastDistance, desert, height: coastalHeight(noise, point, landform, boundary) };
}

export function createRelief(seed: number, island: IslandShape): Relief {
  const random = createRandom(seed);

  const desert = createNoiseSampler(random.derive(1));
  const primary = createNoiseSampler(random.derive(2));
  const secondary = createNoiseSampler(random.derive(3));
  const shape = new GradientNoise(random.derive(4));
  const detail = new GradientNoise(random.derive(5));

  const noise: ReliefNoise = {
    desert,
    detail,
    primary,
    sample: { gradientX: 0, gradientZ: 0, value: 0 },
    secondary,
    shape,
  };

  return {
    basinDepthAt: (point) => CENTRAL_LAKE_DEPTH * centralLake(point),
    boundaryDistanceAt: (point) => boundaryDistance(noise, island, point, island.coastDistanceAt(point.x, point.z)),
    sampleAt: (point) => reliefSample(noise, island, point),
  };
}

import { distanceToPolyline, gaussian, lerp, smoothstep } from "../shared/math.ts";
import { createNoiseSampler, type NoiseSampler } from "../shared/noise.ts";
import { createRandom } from "../shared/random.ts";
import type { WorldGrid } from "../world/world-grid.ts";

type Polyline = readonly (readonly [number, number])[];

const NORTHERN_RANGE: Polyline = [
  [-1.2, -0.48],
  [-0.72, -0.7],
  [-0.28, -0.6],
  [0.18, -0.76],
  [0.6, -0.64],
  [1.2, -0.8],
];

const EASTERN_RANGE: Polyline = [
  [0.8, -0.58],
  [0.7, -0.12],
  [0.8, 0.24],
];

export interface IslandPoint {
  x: number;
  z: number;
}

export function islandPointAt(grid: WorldGrid, column: number, row: number): IslandPoint {
  return { x: grid.centerX(column) / grid.halfSize, z: grid.centerZ(row) / grid.halfSize };
}

interface Relief {
  desertAt: (point: IslandPoint) => number;
  heightAt: (point: IslandPoint) => number;
}

interface ReliefNoise {
  desert: NoiseSampler;
  primary: NoiseSampler;
  secondary: NoiseSampler;
}

function desertMask(noise: NoiseSampler, point: IslandPoint): number {
  const warpedX = point.x + 0.22 * noise.fractal(point.x * 1.4 + 2, point.z * 1.4 - 5, { octaves: 3 });
  const warpedZ = point.z + 0.18 * noise.fractal(point.x * 1.4 - 7, point.z * 1.4 + 3, { octaves: 3 });

  return smoothstep(-0.05, 0.5, warpedX) * smoothstep(0.12, 0.62, warpedZ);
}

function warpPoint(noise: NoiseSampler, point: IslandPoint): IslandPoint {
  const shiftX = noise.fractal(point.x * 1.1 + 5.3, point.z * 1.1 - 3.1, { octaves: 3 });
  const shiftZ = noise.fractal(point.x * 1.1 - 8.2, point.z * 1.1 + 6.4, { octaves: 3 });

  return { x: point.x + 0.13 * shiftX, z: point.z + 0.13 * shiftZ };
}

function mountainMask(warped: IslandPoint): number {
  const northern = smoothstep(0.5, 0.03, distanceToPolyline(warped.x, warped.z, NORTHERN_RANGE));
  const eastern = smoothstep(0.34, 0.03, distanceToPolyline(warped.x, warped.z, EASTERN_RANGE));

  return smoothstep(0, 1, Math.max(northern, 0.72 * eastern));
}

function desertPlateau(noise: ReliefNoise, point: IslandPoint): number {
  const mesaPattern = noise.secondary.fractal(point.x * 2.6 + 30, point.z * 2.6 - 12, { octaves: 4 });
  const tableTop = 560 + 40 * noise.primary.fractal(point.x * 6 + 3, point.z * 6 - 4, { octaves: 2 });
  const plain = 330 + 35 * noise.primary.fractal(point.x * 3 - 9, point.z * 3 + 1, { octaves: 3 });
  const erosionGrooves = 22 * noise.secondary.ridged(point.x * 9, point.z * 9, { octaves: 3 });

  const mesa = smoothstep(0.1, 0.17, mesaPattern);

  return lerp(plain, tableTop, mesa) + erosionGrooves;
}

function reliefHeight(noise: ReliefNoise, point: IslandPoint): number {
  const warped = warpPoint(noise.primary, point);
  const lake = gaussian(point.x * 0.8, point.z, 0, 0.1, 0.17);
  const desert = desertMask(noise.desert, point);

  const mountains = mountainMask(warped);
  const ridges = noise.primary.ridged(warped.x * 1.45 + 1.3, warped.z * 1.45 - 7.1, { gain: 0.48, octaves: 6 });
  const hills = noise.secondary.ridged(warped.x * 2.6 - 4, warped.z * 2.6 + 2, { octaves: 5 });

  const foothills = (1 - mountains) * (1 - lake) * (1 - desert);

  const tilt = 270 - 120 * point.z + 55 * point.x;
  const rolling = 85 * noise.primary.fractal(point.x * 0.9 + 2.2, point.z * 0.9 + 9.1, { octaves: 4 });
  const peaks = mountains * (260 + 960 * ridges);
  const northWestMassif = 320 * gaussian(point.x, point.z, -0.78, -0.82, 0.32) * (0.5 + ridges);
  const hillCover = 150 * hills * (0.3 + 0.7 * foothills) * (0.35 + 0.65 * smoothstep(0, 0.5, mountains + 0.25));
  const southWestHills = 110 * gaussian(point.x, point.z, -0.55, 0.55, 0.45) * hills;

  const height = tilt + rolling + peaks + northWestMassif + hillCover + southWestHills - 135 * lake;

  if (desert <= 0.001) {
    return height;
  }

  return lerp(height, desertPlateau(noise, point), desert * (1 - mountains * 0.85));
}

export function createRelief(seed: number): Relief {
  const random = createRandom(seed);

  const noise: ReliefNoise = {
    desert: createNoiseSampler(random.derive(1)),
    primary: createNoiseSampler(random.derive(2)),
    secondary: createNoiseSampler(random.derive(3)),
  };

  return {
    desertAt: (point) => desertMask(noise.desert, point),
    heightAt: (point) => reliefHeight(noise, point),
  };
}

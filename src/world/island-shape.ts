import { clamp } from "../shared/math.ts";
import { createNoiseSampler, type NoiseSampler } from "../shared/noise.ts";
import { createRandom } from "../shared/random.ts";
import type { WorldGrid } from "./world-grid.ts";

const MEAN_REACH = 0.915;
const SHORTEST_REACH = 0.74;
const LONGEST_REACH = 0.972;
const COVE_DEPTH = 0.022;

export interface IslandShape {
  coastDistanceAt: (x: number, z: number) => number;
}

function coastReach(noise: NoiseSampler, angle: number): number {
  const directionX = Math.cos(angle);
  const directionZ = Math.sin(angle);

  const lobes = noise.fractal(directionX * 1.3 + 4.1, directionZ * 1.3 - 2.7, { octaves: 2 });
  const bays = noise.fractal(directionX * 3.6 - 8.3, directionZ * 3.6 + 5.2, { octaves: 3 });
  const headlands = noise.ridged(directionX * 7.5 + 1.9, directionZ * 7.5 + 6.6, { octaves: 2 });

  return clamp(MEAN_REACH + 0.07 * lobes + 0.035 * bays - 0.025 * headlands, SHORTEST_REACH, LONGEST_REACH);
}

export function createIslandShape(seed: number): IslandShape {
  const noise = createNoiseSampler(createRandom(seed * 31 + 17).derive(1));

  return {
    coastDistanceAt: (x, z) => {
      const reach = coastReach(noise, Math.atan2(z, x));
      const coves = COVE_DEPTH * noise.fractal(x * 9 - 3.4, z * 9 + 7.7, { octaves: 2 });

      return Math.min(reach - Math.hypot(x, z) + coves, LONGEST_REACH - Math.max(Math.abs(x), Math.abs(z)));
    },
  };
}

export function measureCoastDistances(grid: WorldGrid, shape: IslandShape): Float32Array {
  const distances = new Float32Array(grid.cellCount);

  for (let row = 0; row < grid.cellsPerSide; row += 1) {
    for (let column = 0; column < grid.cellsPerSide; column += 1) {
      const x = grid.centerX(column) / grid.halfSize;
      const z = grid.centerZ(row) / grid.halfSize;

      distances[grid.index(column, row)] = shape.coastDistanceAt(x, z) * grid.halfSize;
    }
  }

  return distances;
}

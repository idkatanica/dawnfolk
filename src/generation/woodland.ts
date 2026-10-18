import { Biome } from "../content/biomes.ts";
import { Ground } from "../content/grounds.ts";
import { lerp, smoothstep } from "../shared/math.ts";
import { createNoiseSampler, type NoiseSampler } from "../shared/noise.ts";
import { createRandom } from "../shared/random.ts";
import type { TerrainData } from "../world/terrain-data.ts";
import { isWaterCell } from "../world/terrain-sampling.ts";
import type { WorldGrid } from "../world/world-grid.ts";

const WOODED_BIOMES: ReadonlySet<number> = new Set([Biome.Forest, Biome.Taiga]);
const GLADE_SPAN = 640;
const GLADE_OPEN = -0.47;
const GLADE_WOODED = -0.35;
const STAND_SPAN = 170;
const SPARSE_STAND = -0.3;
const DENSE_STAND = 0.12;
const SPARSEST_STAND = 0.55;
const BANK_SPAN = 420;
const NARROWEST_BANK = 20;
const WIDEST_BANK = 80;
const OPEN_BANK_SHARE = 0.35;
const MEADOW_WOODLAND = 0.3;
const DIAGONAL = Math.SQRT2;

function waterDistances(terrain: TerrainData, grid: WorldGrid): Float32Array {
  const size = grid.cellsPerSide;
  const distances = new Float32Array(grid.cellCount).fill(Number.POSITIVE_INFINITY);

  for (let cell = 0; cell < grid.cellCount; cell += 1) {
    if (isWaterCell(terrain, cell)) {
      distances[cell] = 0;
    }
  }

  function relax(cell: number, column: number, row: number, cost: number): void {
    if (!grid.contains(column, row)) {
      return;
    }

    distances[cell] = Math.min(distances[cell], distances[grid.index(column, row)] + cost);
  }

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const cell = grid.index(column, row);

      relax(cell, column - 1, row, 1);
      relax(cell, column, row - 1, 1);
      relax(cell, column - 1, row - 1, DIAGONAL);
      relax(cell, column + 1, row - 1, DIAGONAL);
    }
  }

  for (let row = size - 1; row >= 0; row -= 1) {
    for (let column = size - 1; column >= 0; column -= 1) {
      const cell = grid.index(column, row);

      relax(cell, column + 1, row, 1);
      relax(cell, column, row + 1, 1);
      relax(cell, column + 1, row + 1, DIAGONAL);
      relax(cell, column - 1, row + 1, DIAGONAL);
    }
  }

  return distances.map((distance) => distance * grid.cellSize);
}

function standDensity(noise: NoiseSampler, x: number, z: number, waterDistance: number): number {
  const glade = smoothstep(GLADE_OPEN, GLADE_WOODED, noise.fractal(x / GLADE_SPAN, z / GLADE_SPAN, { octaves: 3 }));

  const stand = lerp(
    SPARSEST_STAND,
    1,
    smoothstep(SPARSE_STAND, DENSE_STAND, noise.fractal(x / STAND_SPAN + 37.1, z / STAND_SPAN - 11.7, { octaves: 2 }))
  );

  const bankWidth = lerp(
    NARROWEST_BANK,
    WIDEST_BANK,
    smoothstep(-0.3, 0.3, noise.fractal(x / BANK_SPAN - 21.3, z / BANK_SPAN + 54.9, { octaves: 2 }))
  );

  const bank = smoothstep(bankWidth * OPEN_BANK_SHARE, bankWidth, waterDistance);

  return glade * stand * bank;
}

export function openWoodland(terrain: TerrainData, grid: WorldGrid, seed: number): void {
  const noise = createNoiseSampler(createRandom(seed * 41 + 13));
  const distances = waterDistances(terrain, grid);

  for (let cell = 0; cell < grid.cellCount; cell += 1) {
    if (!WOODED_BIOMES.has(terrain.biome[cell])) {
      continue;
    }

    const density = standDensity(noise, grid.cellCenterX(cell), grid.cellCenterZ(cell), distances[cell]);

    terrain.woodland[cell] = density;

    if (density < MEADOW_WOODLAND && terrain.ground[cell] === Ground.Forest) {
      terrain.ground[cell] = Ground.Meadow;
    }
  }
}

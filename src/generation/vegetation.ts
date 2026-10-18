import { isBiomeIndex } from "../content/biomes.ts";
import { PLANTING_RULES, plantSpeciesDefinition } from "../content/plants.ts";
import { FULL_TURN, hashToUnit } from "../shared/math.ts";
import { createRandom, type RandomSource } from "../shared/random.ts";
import type { TerrainData } from "../world/terrain-data.ts";
import { isWaterCell, touchesWaterCell } from "../world/terrain-sampling.ts";
import type { VegetationStore } from "../world/vegetation-store.ts";
import type { WorldGrid } from "../world/world-grid.ts";

export const INITIAL_PLANT_DAY = -999;

export function plantHeight(species: number, random: RandomSource, heightScale: number): number {
  const [shortest, tallest] = plantSpeciesDefinition(species).heightRange;

  return random.between(shortest, tallest) * heightScale;
}

const BIOME_BLEND_CELLS = 3;

function blendedBiome(grid: WorldGrid, terrain: TerrainData, cell: number, seed: number): number {
  const column = grid.columnOf(cell);
  const row = grid.rowOf(cell);
  const reach = BIOME_BLEND_CELLS * 2 + 1;

  const neighborColumn = column + Math.floor(hashToUnit(column, row, seed) * reach) - BIOME_BLEND_CELLS;
  const neighborRow = row + Math.floor(hashToUnit(row, column, seed + 1) * reach) - BIOME_BLEND_CELLS;

  if (!grid.contains(neighborColumn, neighborRow)) {
    return terrain.biome[cell];
  }

  const neighbor = grid.index(neighborColumn, neighborRow);

  if (!isBiomeIndex(terrain.biome[neighbor]) || isWaterCell(terrain, neighbor)) {
    return terrain.biome[cell];
  }

  return terrain.biome[neighbor];
}

export function plantInitialVegetation(
  store: VegetationStore,
  grid: WorldGrid,
  terrain: TerrainData,
  seed: number
): void {
  const random = createRandom(seed * 3 + 1);

  for (let cell = 0; cell < grid.cellCount; cell += 1) {
    if (touchesWaterCell(terrain, grid, cell)) {
      continue;
    }

    const biome = blendedBiome(grid, terrain, cell, seed);

    if (!isBiomeIndex(biome)) {
      continue;
    }

    const isOnEdge = grid.isOnEdge(cell);
    const clearing = 0.45 + 0.9 * (0.5 + 0.5 * terrain.variation[cell]);
    const column = grid.columnOf(cell);
    const row = grid.rowOf(cell);

    for (const rule of PLANTING_RULES[biome]) {
      const isStone = plantSpeciesDefinition(rule.species).form === "stone";

      const chance = isStone ? rule.chancePerCell : rule.chancePerCell * clearing;

      if (!random.chance(chance)) {
        continue;
      }

      const plant = {
        bornDay: INITIAL_PLANT_DAY,
        height: plantHeight(rule.species, random, rule.heightScale),
        rotation: random.next() * FULL_TURN,
        seed: random.next(),
        species: rule.species,
        x: grid.centerX(column) + random.between(-0.42, 0.42) * grid.cellSize,
        z: grid.centerZ(row) + random.between(-0.42, 0.42) * grid.cellSize,
      };

      if (!isOnEdge) {
        store.add(plant);
      }
    }
  }
}

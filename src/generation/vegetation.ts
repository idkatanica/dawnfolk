import { isBiomeIndex } from "../content/biomes.ts";
import { groundDefinition } from "../content/grounds.ts";
import {
  canGrowAt,
  isTreeSpecies,
  PLANTING_RULES,
  type PlantingRule,
  plantSpeciesDefinition,
  ROCK_RULES,
} from "../content/plants.ts";
import { FULL_TURN, hashToUnit } from "../shared/math.ts";
import { createRandom, type RandomSource } from "../shared/random.ts";
import { isOnIsland } from "../world/coast.ts";
import { hasRoomToGrow } from "../world/footing.ts";
import type { TerrainData } from "../world/terrain-data.ts";
import { isWaterCell, touchesWaterCell } from "../world/terrain-sampling.ts";
import type { PlantPlacement, VegetationStore } from "../world/vegetation-store.ts";
import type { WorldGrid } from "../world/world-grid.ts";

export const INITIAL_PLANT_DAY = -999;
const BIOME_BLEND_CELLS = 3;

export function plantHeight(species: number, random: RandomSource, heightScale: number): number {
  const [shortest, tallest] = plantSpeciesDefinition(species).heightRange;

  return random.between(shortest, tallest) * heightScale;
}

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

  if (isWaterCell(terrain, neighbor)) {
    return terrain.biome[cell];
  }

  return terrain.biome[neighbor];
}

interface PlantingOdds {
  readonly chancePerCell: number;
  readonly species: number;
}

function plantingChance(rule: PlantingOdds, clearing: number, holdsTrees: boolean): number {
  if (plantSpeciesDefinition(rule.species).form === "stone") {
    return rule.chancePerCell;
  }

  if (!holdsTrees && isTreeSpecies(rule.species)) {
    return 0;
  }

  return rule.chancePerCell * clearing;
}

function sow(rule: PlantingRule, random: RandomSource, grid: WorldGrid, cell: number): PlantPlacement {
  return {
    bornDay: INITIAL_PLANT_DAY,
    height: plantHeight(rule.species, random, rule.heightScale),
    rotation: random.next() * FULL_TURN,
    seed: random.next(),
    species: rule.species,
    x: grid.cellCenterX(cell) + random.between(-0.42, 0.42) * grid.cellSize,
    z: grid.cellCenterZ(cell) + random.between(-0.42, 0.42) * grid.cellSize,
  };
}

export function plantInitialVegetation(
  store: VegetationStore,
  grid: WorldGrid,
  terrain: TerrainData,
  seed: number
): void {
  const random = createRandom(seed * 3 + 1);
  const rocks = createRandom(seed * 3 + 2);

  function plantWhereRoom(plant: PlantPlacement): void {
    if (hasRoomToGrow(terrain, grid, plant.x, plant.z, plant.species)) {
      store.add(plant);
    }
  }

  for (let cell = 0; cell < grid.cellCount; cell += 1) {
    if (touchesWaterCell(terrain, grid, cell) || !isOnIsland(terrain.coastDistance, cell)) {
      continue;
    }

    const biome = blendedBiome(grid, terrain, cell, seed);

    if (!isBiomeIndex(biome)) {
      continue;
    }

    const temperature = terrain.baseTemperature[cell];
    const clearing = 0.45 + 0.9 * (0.5 + 0.5 * terrain.variation[cell]);
    const { holdsTrees } = groundDefinition(terrain.ground[cell]);

    for (const rule of PLANTING_RULES[biome]) {
      if (canGrowAt(rule, temperature) && random.chance(plantingChance(rule, clearing, holdsTrees))) {
        plantWhereRoom(sow(rule, random, grid, cell));
      }
    }

    for (const rule of ROCK_RULES[biome]) {
      if (canGrowAt(rule, temperature) && rocks.chance(rule.chancePerCell)) {
        plantWhereRoom(sow(rule, rocks, grid, cell));
      }
    }
  }
}

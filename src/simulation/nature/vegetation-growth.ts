import { Biome, isBiomeIndex } from "../../content/biomes.ts";
import { plantSpeciesDefinition, regrowingSpecies } from "../../content/plants.ts";
import { isGrowingSeason } from "../../content/seasons.ts";
import type { WorldRules } from "../../content/world-rules.ts";
import { plantHeight } from "../../generation/vegetation.ts";
import { FULL_TURN, saturate } from "../../shared/math.ts";
import type { RandomSource } from "../../shared/random.ts";
import { NO_BUILDING, type WorldState } from "../world/world-state.ts";

export const SNAG_LIFETIME_DAYS = 4;

const REGROWTH_VISITS_PER_DAY = 2000;
const BERRY_UPDATE_DAYS = 0.05;
const SCORCH_BLOCKING_REGROWTH = 0.3;
const MEADOW_REGROWTH_CHANCE = 0.15;
const REGROWING_BIOMES: ReadonlySet<number> = new Set([Biome.Forest, Biome.Swamp, Biome.Taiga]);

interface GrowthConditions {
  day: number;
  season: number;
}

export function berryGrowthPerDay(season: number): number {
  if (season < 0.2) {
    return 0;
  }

  if (season < 2.4) {
    return 0.8;
  }

  if (season < 3) {
    return -0.2;
  }

  return -2;
}

function berryChange(season: number, days: number, rules: WorldRules): number {
  const growth = berryGrowthPerDay(season);

  if (growth <= 0) {
    return growth * days;
  }

  return growth * rules.nature.berryGrowth * days;
}

export class VegetationGrowthSystem {
  readonly #world: WorldState;
  #berryDays = 0;
  #visitBudget = 0;

  constructor(world: WorldState) {
    this.#world = world;
  }

  update(days: number, conditions: GrowthConditions, rules: WorldRules, random: RandomSource): void {
    this.#removeOldSnags(conditions.day);
    this.#regrow(days, conditions, rules, random);
    this.#berryDays += days;

    if (this.#berryDays < BERRY_UPDATE_DAYS) {
      return;
    }

    this.#growBerries(this.#berryDays, conditions.season, rules);
    this.#berryDays = 0;
  }

  #removeOldSnags(day: number): void {
    for (const index of this.#world.vegetation.takeBurntBefore(day - SNAG_LIFETIME_DAYS)) {
      this.#world.removePlant(index);
    }
  }

  #regrow(days: number, conditions: GrowthConditions, rules: WorldRules, random: RandomSource): void {
    const multiplier = rules.nature.forestRegrowth;

    if (multiplier <= 0 || !isGrowingSeason(conditions.season)) {
      return;
    }

    this.#visitBudget += days * REGROWTH_VISITS_PER_DAY * multiplier;

    while (this.#visitBudget >= 1) {
      this.#visitBudget -= 1;
      this.#tryToSprout(random.integer(0, this.#world.grid.cellCount), conditions.day, random);
    }
  }

  #tryToSprout(cell: number, day: number, random: RandomSource): void {
    const world = this.#world;

    if (!this.#canSprout(cell, random)) {
      return;
    }

    const biome = world.terrain.biome[cell];

    if (!isBiomeIndex(biome)) {
      return;
    }

    const candidates = regrowingSpecies(biome);

    if (candidates.length === 0) {
      return;
    }

    const { grid } = world;

    const species = random.pick(candidates);

    world.plant({
      bornDay: day,
      height: plantHeight(species, random, 1),
      rotation: random.next() * FULL_TURN,
      seed: random.next(),
      species,
      x: grid.cellCenterX(cell) + random.between(-0.35, 0.35) * grid.cellSize,
      z: grid.cellCenterZ(cell) + random.between(-0.35, 0.35) * grid.cellSize,
    });
  }

  #canSprout(cell: number, random: RandomSource): boolean {
    const world = this.#world;
    const biome = world.terrain.biome[cell];

    if (world.grid.isOnEdge(cell) || world.touchesWater(cell)) {
      return false;
    }

    if (world.occupancy[cell] !== NO_BUILDING || world.isBurning(cell)) {
      return false;
    }

    if (world.fields.scorch[cell] > SCORCH_BLOCKING_REGROWTH || world.vegetation.countTreesInCell(cell) > 0) {
      return false;
    }

    if (REGROWING_BIOMES.has(biome)) {
      return true;
    }

    return biome === Biome.Meadow && random.chance(MEADOW_REGROWTH_CHANCE);
  }

  #growBerries(days: number, season: number, rules: WorldRules): void {
    const { vegetation } = this.#world;

    const change = berryChange(season, days, rules);

    if (change === 0) {
      return;
    }

    for (let index = 0; index < vegetation.count; index += 1) {
      if (vegetation.isAlive(index) && plantSpeciesDefinition(vegetation.species[index]).givesBerries) {
        vegetation.setFruit(index, saturate(vegetation.fruit[index] + change));
      }
    }
  }
}

import { describe, expect, it } from "vitest";
import { createRandom } from "../shared/random.ts";
import { ANIMALS } from "./animals.ts";
import { BIOMES, Biome } from "./biomes.ts";
import { BUILDINGS } from "./buildings.ts";
import { currentEra, ERAS } from "./eras.ts";
import { GROUNDS, Ground, seasonalGroundColor } from "./grounds.ts";
import { personName, tribeIdentity } from "./names.ts";
import { describeParameters } from "./parameters.ts";
import { isTreeSpecies, PLANT_SPECIES, PLANTING_RULES, PlantSpecies, regrowingSpecies } from "./plants.ts";
import { defaultPowerParameters, POWER_ORDER, POWERS, powersInCategory, readPowerParameters } from "./powers.ts";
import { seasonName, seasonTemperatureOffset } from "./seasons.ts";
import { nextTechnology, TECHNOLOGIES, type TechnologyId } from "./technologies.ts";
import { WEATHER, WEATHER_KINDS } from "./weather.ts";
import { DEFAULT_WORLD_RULES, readWorldRules } from "./world-rules.ts";

const STEEPEST_FOOTING = 1.05;

describe("indexed content", () => {
  it("lists biomes in the order of their indices", () => {
    expect(BIOMES.map((biome) => biome.index)).toEqual(BIOMES.map((_biome, position) => position));
    expect(BIOMES).toHaveLength(Object.keys(Biome).length);
  });

  it("lists grounds in the order of their indices", () => {
    expect(GROUNDS.map((ground) => ground.index)).toEqual(GROUNDS.map((_ground, position) => position));
    expect(GROUNDS).toHaveLength(Object.keys(Ground).length);
  });

  it("lists plant species in the order of their indices", () => {
    expect(PLANT_SPECIES.map((species) => species.index)).toEqual(PLANT_SPECIES.map((_species, position) => position));
    expect(PLANT_SPECIES).toHaveLength(Object.keys(PlantSpecies).length);
  });

  it("plants every biome except water", () => {
    for (const biome of BIOMES) {
      const rules = PLANTING_RULES[biome.index];

      expect(rules.length > 0).toBe(biome.index !== Biome.Water);
    }
  });

  it("regrows only living trees", () => {
    expect(regrowingSpecies(Biome.Forest, 10)).not.toContain(PlantSpecies.Bush);
    expect(regrowingSpecies(Biome.Forest, 10)).not.toContain(PlantSpecies.DeadTree);
    expect(regrowingSpecies(Biome.Desert, 20)).toEqual([PlantSpecies.Acacia, PlantSpecies.Palm]);
  });

  it("asks trees for gentler ground than bushes and keeps everything off cliffs", () => {
    const trees = PLANT_SPECIES.filter((species) => isTreeSpecies(species.index));
    const undergrowth = PLANT_SPECIES.filter((species) => species.form === "shrub" || species.form === "succulent");
    const steepestTree = Math.max(...trees.map((species) => species.steepestSlope));
    const gentlestUndergrowth = Math.min(...undergrowth.map((species) => species.steepestSlope));

    expect(steepestTree).toBeLessThan(gentlestUndergrowth);

    for (const species of PLANT_SPECIES) {
      expect(species.steepestSlope, species.name).toBeGreaterThan(0.3);
      expect(species.steepestSlope, species.name).toBeLessThanOrEqual(STEEPEST_FOOTING);
    }

    for (const building of Object.values(BUILDINGS)) {
      expect(building.steepestSlope).toBeLessThan(steepestTree);
    }
  });

  it("keeps warm-weather trees out of cold places", () => {
    expect(regrowingSpecies(Biome.Beach, 15)).toContain(PlantSpecies.Palm);
    expect(regrowingSpecies(Biome.Beach, 5)).not.toContain(PlantSpecies.Palm);
    expect(regrowingSpecies(Biome.Steppe, 5)).not.toContain(PlantSpecies.Acacia);
  });
});

describe("seasons and grounds", () => {
  it("names seasons in order", () => {
    expect([0, 1, 2, 3, 4.5].map(seasonName)).toEqual(["Spring", "Summer", "Autumn", "Winter", "Spring"]);
  });

  it("is warmest in mid summer and coldest in mid winter", () => {
    expect(seasonTemperatureOffset(1.5)).toBeCloseTo(10);
    expect(seasonTemperatureOffset(3.5)).toBeCloseTo(-10);
  });

  it("blends ground colours at the end of a season", () => {
    const midSummer = seasonalGroundColor(Ground.Meadow, 1.2);
    const lateSummer = seasonalGroundColor(Ground.Meadow, 1.95);

    expect(midSummer).toEqual([0.48, 0.48, 0.3]);
    expect(lateSummer[0]).toBeGreaterThan(midSummer[0]);
  });

  it("grows grass on soft ground and none on bare stone or eternal snow", () => {
    const covers = GROUNDS.map((ground) => ground.grass);

    expect(covers.every((cover) => cover >= 0 && cover <= 1)).toBe(true);
    expect(GROUNDS[Ground.Meadow].grass).toBe(1);
    expect(GROUNDS[Ground.Forest].grass).toBeLessThan(GROUNDS[Ground.Meadow].grass);
    expect([Ground.Rock, Ground.RedRock, Ground.Snow].map((index) => GROUNDS[index].grass)).toEqual([0, 0, 0]);
  });
});

describe("powers", () => {
  it("orders every power exactly once", () => {
    expect([...POWER_ORDER].sort()).toEqual(Object.keys(POWERS).sort());
  });

  it("gives every parameter a label and a sane range", () => {
    for (const powerId of POWER_ORDER) {
      for (const field of describeParameters(POWERS[powerId].parameters)) {
        expect(field.metadata.label.length).toBeGreaterThan(0);

        if (field.metadata.kind === "range") {
          expect(field.metadata.minimum).toBeLessThan(field.metadata.maximum);
          expect(field.metadata.defaultValue).toBeGreaterThanOrEqual(field.metadata.minimum);
          expect(field.metadata.defaultValue).toBeLessThanOrEqual(field.metadata.maximum);
        }
      }
    }
  });

  it("groups powers by category", () => {
    expect(powersInCategory("elements")).toEqual([
      "fire",
      "lightning",
      "rain",
      "snow",
      "explosion",
      "meteor",
      "earthquake",
    ]);
  });

  it("falls back to defaults for invalid parameters", () => {
    expect(defaultPowerParameters("fire")).toEqual({ intensity: 60, radius: 25 });
    expect(readPowerParameters("fire", { intensity: 400, radius: 30 })).toEqual({ intensity: 60, radius: 25 });
    expect(readPowerParameters("fire", { intensity: 40, radius: 30 })).toEqual({ intensity: 40, radius: 30 });
  });
});

describe("world rules", () => {
  it("default every rule to neutral", () => {
    expect(DEFAULT_WORLD_RULES.fire.spreadSpeed).toBe(1);
    expect(DEFAULT_WORLD_RULES.storms.lightningIgnition).toBe(75);
  });

  it("fill missing groups with defaults", () => {
    expect(readWorldRules({ fire: { spreadSpeed: 2 } }).fire.spreadSpeed).toBe(2);
    expect(readWorldRules({ fire: { spreadSpeed: 2 } }).water.rainStrength).toBe(1);
  });

  it("reject broken rules", () => {
    expect(readWorldRules({ fire: { spreadSpeed: "fast" } })).toEqual(DEFAULT_WORLD_RULES);
  });
});

describe("technologies", () => {
  it("unlock in order of their requirements", () => {
    const known = new Set<TechnologyId>();
    const order: TechnologyId[] = [];

    for (let next = nextTechnology(known); next !== undefined; next = nextTechnology(known)) {
      known.add(next.id);
      order.push(next.id);
    }

    expect(order).toEqual(TECHNOLOGIES.map((technology) => technology.id));
  });

  it("name the era after the latest milestone", () => {
    expect(currentEra(new Set()).name).toBe("Wanderers");
    expect(currentEra(new Set<TechnologyId>(["fire", "spear"])).name).toBe("Stone Age");
    expect(currentEra(new Set<TechnologyId>(["fire", "farming", "copper", "bronze"])).name).toBe("Bronze Age");
  });

  it("climbs a ladder of eras, each opened by a technology learned after the previous one", () => {
    const order = TECHNOLOGIES.map((technology) => technology.id);
    const keys = ERAS.map((era) => era.unlockedBy).filter((technology) => technology !== null);

    expect(ERAS.map((era) => era.name)).toEqual([
      "Wanderers",
      "Stone Age",
      "Neolithic",
      "Copper Age",
      "Bronze Age",
      "Iron Age",
    ]);
    expect(keys.map((technology) => order.indexOf(technology))).toEqual(
      [...keys.map((technology) => order.indexOf(technology))].sort((first, second) => first - second)
    );
  });

  it("asks for ore before the metal ages", () => {
    const needs = TECHNOLOGIES.filter((technology) => technology.needs !== null).map((technology) => technology.id);

    expect(needs).toEqual(["copper", "bronze", "iron"]);
  });
});

describe("other content", () => {
  it("defines weather for every kind with odds for each season", () => {
    for (const kind of WEATHER_KINDS) {
      expect(WEATHER[kind].seasonalOdds).toHaveLength(4);
    }
  });

  it("gives animals and buildings positive costs and stats", () => {
    for (const animal of Object.values(ANIMALS)) {
      expect(animal.runSpeed).toBeGreaterThan(animal.walkSpeed);
    }

    for (const building of Object.values(BUILDINGS)) {
      expect(building.work).toBeGreaterThan(0);
    }
  });

  it("names tribes and people deterministically", () => {
    expect(tribeIdentity(0).name).toBe("Bear Clan");
    expect(tribeIdentity(10).name).toBe("Bear Clan 2");
    expect(personName(createRandom(4), true)).toBe(personName(createRandom(4), true));
  });
});

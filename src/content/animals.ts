import { Biome, type BiomeIndex } from "./biomes.ts";

export const ANIMAL_KINDS = ["deer", "mammoth"] as const;

export type AnimalKind = (typeof ANIMAL_KINDS)[number];

interface AnimalDefinition {
  favouriteBiomes: readonly BiomeIndex[];
  fleeDistance: number;
  food: number;
  health: number;
  herdSizeRange: readonly [number, number];
  maximumHerdSize: number;
  name: string;
  runSpeed: number;
  walkSpeed: number;
}

export const ANIMALS: Readonly<Record<AnimalKind, AnimalDefinition>> = {
  deer: {
    favouriteBiomes: [Biome.Meadow, Biome.Forest, Biome.Steppe, Biome.Taiga, Biome.Scrub],
    fleeDistance: 55,
    food: 10,
    health: 1,
    herdSizeRange: [3, 6],
    maximumHerdSize: 10,
    name: "Deer",
    runSpeed: 10,
    walkSpeed: 3.2,
  },
  mammoth: {
    favouriteBiomes: [Biome.Tundra, Biome.Taiga, Biome.Steppe, Biome.Glacier],
    fleeDistance: 30,
    food: 45,
    health: 5,
    herdSizeRange: [2, 4],
    maximumHerdSize: 7,
    name: "Mammoth",
    runSpeed: 5.2,
    walkSpeed: 1.9,
  },
};

import { Biome, type BiomeIndex } from "./biomes.ts";

export const ANIMAL_KINDS = ["deer", "mammoth"] as const;

export type AnimalKind = (typeof ANIMAL_KINDS)[number];

interface AnimalDefinition {
  abundance: number;
  favouriteBiomes: readonly BiomeIndex[];
  fleeDistance: number;
  food: number;
  health: number;
  herdSizeRange: readonly [number, number];
  hitChance: number;
  huntingPartySize: number | null;
  maximumHerdSize: number;
  name: string;
  pastureRange: readonly [number, number];
  restingActivity: string;
  runSpeed: number;
  seeksHighGround: boolean;
  walkSpeed: number;
}

export const ANIMALS: Readonly<Record<AnimalKind, AnimalDefinition>> = {
  deer: {
    abundance: 3,
    favouriteBiomes: [Biome.Meadow, Biome.Forest, Biome.Steppe, Biome.Taiga, Biome.Scrub],
    fleeDistance: 55,
    food: 10,
    health: 1,
    herdSizeRange: [3, 6],
    hitChance: 0.32,
    huntingPartySize: 1,
    maximumHerdSize: 10,
    name: "Deer",
    pastureRange: [80, 340],
    restingActivity: "Grazing",
    runSpeed: 10,
    seeksHighGround: false,
    walkSpeed: 3.2,
  },
  mammoth: {
    abundance: 2.4,
    favouriteBiomes: [Biome.Tundra, Biome.Taiga, Biome.Steppe, Biome.Glacier],
    fleeDistance: 30,
    food: 45,
    health: 5,
    herdSizeRange: [2, 4],
    hitChance: 0.1,
    huntingPartySize: 6,
    maximumHerdSize: 7,
    name: "Mammoth",
    pastureRange: [80, 340],
    restingActivity: "Grazing",
    runSpeed: 5.2,
    seeksHighGround: false,
    walkSpeed: 1.9,
  },
};

const VOWELS: ReadonlySet<string> = new Set(["a", "e", "i", "o", "u"]);

export function animalWithArticle(kind: AnimalKind): string {
  const name = ANIMALS[kind].name.toLowerCase();

  return VOWELS.has(name.charAt(0)) ? `an ${name}` : `a ${name}`;
}

export function animalsAt(biome: number): readonly AnimalKind[] {
  return ANIMAL_KINDS.filter((kind) => ANIMALS[kind].favouriteBiomes.some((favourite) => favourite === biome));
}

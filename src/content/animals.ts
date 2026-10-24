import { Biome, type BiomeIndex } from "./biomes.ts";

export const ANIMAL_KINDS = ["deer", "mammoth", "ibex", "wolf", "hare"] as const;

export type AnimalKind = (typeof ANIMAL_KINDS)[number];

interface Breeding {
  litterSize: readonly [number, number];
  perDay: number;
  season: readonly [number, number];
}

interface AnimalDefinition {
  abundance: number;
  breeding: Breeding;
  edgeBiomes: readonly BiomeIndex[];
  favouriteBiomes: readonly BiomeIndex[];
  fleeDistance: number;
  food: number;
  health: number;
  herdSizeRange: readonly [number, number];
  hitChance: number;
  huntingPartySize: number | null;
  isSmallGame: boolean;
  lifespanDays: readonly [number, number] | null;
  maximumHerdSize: number;
  name: string;
  pastureRange: readonly [number, number];
  restingActivity: string;
  runSpeed: number;
  seeksHighGround: boolean;
  walkSpeed: number;
}

const SPRING_CALVING: Breeding = { litterSize: [1, 1], perDay: 0.6, season: [0.2, 1.2] };

export const ANIMALS: Readonly<Record<AnimalKind, AnimalDefinition>> = {
  deer: {
    abundance: 3,
    breeding: SPRING_CALVING,
    edgeBiomes: [],
    favouriteBiomes: [Biome.Meadow, Biome.Forest, Biome.Steppe, Biome.Taiga, Biome.Scrub],
    fleeDistance: 55,
    food: 10,
    health: 1,
    herdSizeRange: [3, 6],
    hitChance: 0.32,
    huntingPartySize: 1,
    isSmallGame: false,
    lifespanDays: null,
    maximumHerdSize: 10,
    name: "Deer",
    pastureRange: [80, 340],
    restingActivity: "Grazing",
    runSpeed: 10,
    seeksHighGround: false,
    walkSpeed: 3.2,
  },
  hare: {
    abundance: 0,
    breeding: { litterSize: [1, 3], perDay: 0.5, season: [0.1, 2.2] },
    edgeBiomes: [Biome.Forest],
    favouriteBiomes: [Biome.Meadow, Biome.Steppe, Biome.Scrub],
    fleeDistance: 40,
    food: 3,
    health: 1,
    herdSizeRange: [2, 4],
    hitChance: 0.26,
    huntingPartySize: 1,
    isSmallGame: true,
    lifespanDays: [16, 34],
    maximumHerdSize: 7,
    name: "Hare",
    pastureRange: [40, 160],
    restingActivity: "Nibbling grass",
    runSpeed: 10.5,
    seeksHighGround: false,
    walkSpeed: 1.6,
  },
  ibex: {
    abundance: 2,
    breeding: SPRING_CALVING,
    edgeBiomes: [],
    favouriteBiomes: [Biome.Alpine, Biome.Mesa, Biome.Tundra],
    fleeDistance: 60,
    food: 8,
    health: 1,
    herdSizeRange: [3, 6],
    hitChance: 0.24,
    huntingPartySize: 1,
    isSmallGame: false,
    lifespanDays: null,
    maximumHerdSize: 9,
    name: "Ibex",
    pastureRange: [60, 260],
    restingActivity: "Grazing",
    runSpeed: 9,
    seeksHighGround: true,
    walkSpeed: 2.6,
  },
  mammoth: {
    abundance: 2.4,
    breeding: SPRING_CALVING,
    edgeBiomes: [],
    favouriteBiomes: [Biome.Tundra, Biome.Taiga, Biome.Steppe, Biome.Glacier],
    fleeDistance: 30,
    food: 45,
    health: 5,
    herdSizeRange: [2, 4],
    hitChance: 0.1,
    huntingPartySize: 6,
    isSmallGame: false,
    lifespanDays: null,
    maximumHerdSize: 7,
    name: "Mammoth",
    pastureRange: [80, 340],
    restingActivity: "Grazing",
    runSpeed: 5.2,
    seeksHighGround: false,
    walkSpeed: 1.9,
  },
  wolf: {
    abundance: 1,
    breeding: SPRING_CALVING,
    edgeBiomes: [],
    favouriteBiomes: [Biome.Taiga, Biome.Tundra, Biome.Forest, Biome.Steppe],
    fleeDistance: 80,
    food: 6,
    health: 1,
    herdSizeRange: [3, 6],
    hitChance: 0.2,
    huntingPartySize: null,
    isSmallGame: false,
    lifespanDays: null,
    maximumHerdSize: 8,
    name: "Wolf",
    pastureRange: [180, 600],
    restingActivity: "Sniffing around",
    runSpeed: 11,
    seeksHighGround: false,
    walkSpeed: 3.6,
  },
};

const VOWELS: ReadonlySet<string> = new Set(["a", "e", "i", "o", "u"]);

export function animalWithArticle(kind: AnimalKind): string {
  const name = ANIMALS[kind].name.toLowerCase();

  return VOWELS.has(name.charAt(0)) ? `an ${name}` : `a ${name}`;
}

export function animalsAt(biome: number): readonly AnimalKind[] {
  return ANIMAL_KINDS.filter(
    (kind) => !ANIMALS[kind].isSmallGame && ANIMALS[kind].favouriteBiomes.some((favourite) => favourite === biome)
  );
}

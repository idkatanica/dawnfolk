import { Biome, type BiomeIndex } from "./biomes.ts";

export const PlantSpecies = {
  Birch: 3,
  Boulder: 8,
  Bush: 6,
  Cactus: 7,
  Maple: 5,
  Oak: 2,
  Pine: 1,
  Spruce: 0,
  Willow: 4,
} as const;

export type PlantSpeciesIndex = (typeof PlantSpecies)[keyof typeof PlantSpecies];

export type PlantForm = "broadleaf" | "conifer" | "shrub" | "succulent" | "stone";

export interface PlantSpeciesDefinition {
  canopyFuel: number;
  form: PlantForm;
  givesBerries: boolean;
  heightRange: readonly [number, number];
  index: PlantSpeciesIndex;
  name: string;
  wood: number;
}

export const PLANT_SPECIES: readonly PlantSpeciesDefinition[] = [
  {
    canopyFuel: 2.6,
    form: "conifer",
    givesBerries: false,
    heightRange: [16, 32],
    index: PlantSpecies.Spruce,
    name: "Spruce",
    wood: 3,
  },
  {
    canopyFuel: 2.2,
    form: "conifer",
    givesBerries: false,
    heightRange: [18, 30],
    index: PlantSpecies.Pine,
    name: "Pine",
    wood: 3,
  },
  {
    canopyFuel: 2.4,
    form: "broadleaf",
    givesBerries: false,
    heightRange: [12, 21],
    index: PlantSpecies.Oak,
    name: "Oak",
    wood: 4,
  },
  {
    canopyFuel: 1.7,
    form: "broadleaf",
    givesBerries: false,
    heightRange: [14, 24],
    index: PlantSpecies.Birch,
    name: "Birch",
    wood: 2,
  },
  {
    canopyFuel: 1.6,
    form: "broadleaf",
    givesBerries: false,
    heightRange: [9, 15],
    index: PlantSpecies.Willow,
    name: "Willow",
    wood: 2,
  },
  {
    canopyFuel: 2.1,
    form: "broadleaf",
    givesBerries: false,
    heightRange: [12, 20],
    index: PlantSpecies.Maple,
    name: "Maple",
    wood: 3,
  },
  {
    canopyFuel: 0.5,
    form: "shrub",
    givesBerries: true,
    heightRange: [1.6, 2.8],
    index: PlantSpecies.Bush,
    name: "Berry bush",
    wood: 0,
  },
  {
    canopyFuel: 0.2,
    form: "succulent",
    givesBerries: false,
    heightRange: [2.5, 5.5],
    index: PlantSpecies.Cactus,
    name: "Cactus",
    wood: 0,
  },
  {
    canopyFuel: 0,
    form: "stone",
    givesBerries: false,
    heightRange: [1.2, 4],
    index: PlantSpecies.Boulder,
    name: "Boulder",
    wood: 0,
  },
];

export function plantSpeciesDefinition(index: number): PlantSpeciesDefinition {
  const definition = PLANT_SPECIES[index];

  if (definition === undefined) {
    throw new RangeError(`Unknown plant species ${index}`);
  }

  return definition;
}

export function isTreeSpecies(index: number): boolean {
  const { form } = plantSpeciesDefinition(index);

  return form === "broadleaf" || form === "conifer";
}

export interface PlantingRule {
  chancePerCell: number;
  heightScale: number;
  species: PlantSpeciesIndex;
}

export const PLANTING_RULES: Readonly<Record<BiomeIndex, readonly PlantingRule[]>> = {
  [Biome.Alpine]: [
    { chancePerCell: 0.045, heightScale: 1, species: PlantSpecies.Boulder },
    { chancePerCell: 0.02, heightScale: 0.45, species: PlantSpecies.Spruce },
  ],
  [Biome.Beach]: [
    { chancePerCell: 0.004, heightScale: 1, species: PlantSpecies.Boulder },
    { chancePerCell: 0.03, heightScale: 0.9, species: PlantSpecies.Willow },
  ],
  [Biome.Desert]: [
    { chancePerCell: 0.022, heightScale: 1, species: PlantSpecies.Cactus },
    { chancePerCell: 0.012, heightScale: 1, species: PlantSpecies.Boulder },
  ],
  [Biome.Forest]: [
    { chancePerCell: 0.36, heightScale: 1, species: PlantSpecies.Oak },
    { chancePerCell: 0.28, heightScale: 1, species: PlantSpecies.Birch },
    { chancePerCell: 0.16, heightScale: 1, species: PlantSpecies.Maple },
    { chancePerCell: 0.1, heightScale: 1, species: PlantSpecies.Pine },
    { chancePerCell: 0.14, heightScale: 1, species: PlantSpecies.Bush },
    { chancePerCell: 0.12, heightScale: 0.8, species: PlantSpecies.Oak },
  ],
  [Biome.Glacier]: [{ chancePerCell: 0.01, heightScale: 1, species: PlantSpecies.Boulder }],
  [Biome.Meadow]: [
    { chancePerCell: 0.03, heightScale: 1, species: PlantSpecies.Oak },
    { chancePerCell: 0.025, heightScale: 1, species: PlantSpecies.Birch },
    { chancePerCell: 0.015, heightScale: 1, species: PlantSpecies.Maple },
    { chancePerCell: 0.08, heightScale: 1, species: PlantSpecies.Bush },
    { chancePerCell: 0.02, heightScale: 1, species: PlantSpecies.Pine },
  ],
  [Biome.Mesa]: [{ chancePerCell: 0.02, heightScale: 1.2, species: PlantSpecies.Boulder }],
  [Biome.Scrub]: [
    { chancePerCell: 0.42, heightScale: 1, species: PlantSpecies.Bush },
    { chancePerCell: 0.06, heightScale: 1, species: PlantSpecies.Pine },
    { chancePerCell: 0.05, heightScale: 0.85, species: PlantSpecies.Oak },
  ],
  [Biome.Steppe]: [
    { chancePerCell: 0.035, heightScale: 1, species: PlantSpecies.Pine },
    { chancePerCell: 0.03, heightScale: 0.9, species: PlantSpecies.Oak },
    { chancePerCell: 0.035, heightScale: 1, species: PlantSpecies.Bush },
  ],
  [Biome.Swamp]: [
    { chancePerCell: 0.22, heightScale: 0.9, species: PlantSpecies.Willow },
    { chancePerCell: 0.12, heightScale: 0.9, species: PlantSpecies.Birch },
    { chancePerCell: 0.16, heightScale: 1, species: PlantSpecies.Bush },
  ],
  [Biome.Taiga]: [
    { chancePerCell: 0.9, heightScale: 1, species: PlantSpecies.Spruce },
    { chancePerCell: 0.3, heightScale: 0.85, species: PlantSpecies.Spruce },
    { chancePerCell: 0.1, heightScale: 1, species: PlantSpecies.Pine },
    { chancePerCell: 0.05, heightScale: 1, species: PlantSpecies.Birch },
    { chancePerCell: 0.04, heightScale: 1, species: PlantSpecies.Bush },
  ],
  [Biome.Tundra]: [
    { chancePerCell: 0.06, heightScale: 0.35, species: PlantSpecies.Spruce },
    { chancePerCell: 0.04, heightScale: 0.8, species: PlantSpecies.Bush },
    { chancePerCell: 0.025, heightScale: 1, species: PlantSpecies.Boulder },
  ],
  [Biome.Water]: [],
};

export function regrowingSpecies(biome: BiomeIndex): readonly PlantSpeciesIndex[] {
  return PLANTING_RULES[biome].filter((rule) => isTreeSpecies(rule.species)).map((rule) => rule.species);
}

export const Biome = {
  Alpine: 2,
  Beach: 11,
  Desert: 9,
  Forest: 5,
  Glacier: 1,
  Meadow: 6,
  Mesa: 12,
  Scrub: 8,
  Steppe: 7,
  Swamp: 10,
  Taiga: 4,
  Tundra: 3,
  Water: 0,
} as const;

export type BiomeIndex = (typeof Biome)[keyof typeof Biome];

const BIOME_INDICES: ReadonlySet<number> = new Set(Object.values(Biome));

export function isBiomeIndex(value: number): value is BiomeIndex {
  return BIOME_INDICES.has(value);
}

export interface BiomeDefinition {
  index: BiomeIndex;
  mapColor: string;
  name: string;
}

export const BIOMES: readonly BiomeDefinition[] = [
  { index: Biome.Water, mapColor: "#4d7d9e", name: "Water" },
  { index: Biome.Glacier, mapColor: "#e9eff5", name: "Glacier" },
  { index: Biome.Alpine, mapColor: "#9b968e", name: "Alpine rock" },
  { index: Biome.Tundra, mapColor: "#a8a27f", name: "Tundra" },
  { index: Biome.Taiga, mapColor: "#3d5838", name: "Taiga" },
  { index: Biome.Forest, mapColor: "#5f7d3c", name: "Broadleaf forest" },
  { index: Biome.Meadow, mapColor: "#97a75c", name: "Meadow" },
  { index: Biome.Steppe, mapColor: "#cfb57c", name: "Dry steppe" },
  { index: Biome.Scrub, mapColor: "#a39d6d", name: "Scrubland" },
  { index: Biome.Desert, mapColor: "#dfb97f", name: "Desert" },
  { index: Biome.Swamp, mapColor: "#4f5b38", name: "Swamp" },
  { index: Biome.Beach, mapColor: "#dacba2", name: "Shore" },
  { index: Biome.Mesa, mapColor: "#b9714c", name: "Mesas" },
];

export function biomeDefinition(index: number): BiomeDefinition {
  const definition = BIOMES[index];

  if (definition === undefined) {
    throw new RangeError(`Unknown biome ${index}`);
  }

  return definition;
}

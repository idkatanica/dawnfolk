import type { TechnologyId } from "./technologies.ts";

export const ERA_IDS = ["wanderers", "stoneAge", "neolithic", "copperAge", "bronzeAge", "ironAge"] as const;

export type EraId = (typeof ERA_IDS)[number];

export interface EraDefinition {
  description: string;
  id: EraId;
  index: number;
  name: string;
  unlockedBy: TechnologyId | null;
}

export const ERAS: readonly EraDefinition[] = [
  {
    description: "Foragers sleeping under the open sky.",
    id: "wanderers",
    index: 0,
    name: "Wanderers",
    unlockedBy: null,
  },
  {
    description: "Hide tents around the fire, spears and flint.",
    id: "stoneAge",
    index: 1,
    name: "Stone Age",
    unlockedBy: "fire",
  },
  {
    description: "Round huts, fields of grain, kilns and granaries.",
    id: "neolithic",
    index: 2,
    name: "Neolithic",
    unlockedBy: "farming",
  },
  {
    description: "Longhouses, mines in the hills and smelting furnaces.",
    id: "copperAge",
    index: 3,
    name: "Copper Age",
    unlockedBy: "copper",
  },
  {
    description: "Bronze tools and blades, workshops and a palisade.",
    id: "bronzeAge",
    index: 4,
    name: "Bronze Age",
    unlockedBy: "bronze",
  },
  {
    description: "Forges, iron tools, stone houses and walls.",
    id: "ironAge",
    index: 5,
    name: "Iron Age",
    unlockedBy: "iron",
  },
];

export const ERA_COUNT = ERAS.length;

export function eraDefinition(id: EraId): EraDefinition {
  const definition = ERAS.find((era) => era.id === id);

  if (definition === undefined) {
    throw new RangeError(`Unknown era ${id}`);
  }

  return definition;
}

export function currentEra(known: ReadonlySet<TechnologyId>): EraDefinition {
  let [era] = ERAS;

  for (const candidate of ERAS) {
    if (candidate.unlockedBy === null || known.has(candidate.unlockedBy)) {
      era = candidate;
    }
  }

  return era;
}

export function nextEra(era: EraDefinition): EraDefinition | null {
  const following = ERAS[era.index + 1];

  if (following === undefined) {
    return null;
  }

  return following;
}

export function isEraReached(known: ReadonlySet<TechnologyId>, id: EraId): boolean {
  return currentEra(known).index >= eraDefinition(id).index;
}

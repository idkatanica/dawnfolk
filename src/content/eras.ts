import type { TechnologyId } from "./technologies.ts";

const ERA_IDS = ["wanderers", "stoneAge", "neolithic", "copperAge", "bronzeAge", "ironAge"] as const;

export type EraId = (typeof ERA_IDS)[number];

export interface EraDefinition {
  id: EraId;
  index: number;
  name: string;
  unlockedBy: TechnologyId | null;
}

export const ERAS: readonly EraDefinition[] = [
  {
    id: "wanderers",
    index: 0,
    name: "Wanderers",
    unlockedBy: null,
  },
  {
    id: "stoneAge",
    index: 1,
    name: "Stone Age",
    unlockedBy: "fire",
  },
  {
    id: "neolithic",
    index: 2,
    name: "Neolithic",
    unlockedBy: "farming",
  },
  {
    id: "copperAge",
    index: 3,
    name: "Copper Age",
    unlockedBy: "copper",
  },
  {
    id: "bronzeAge",
    index: 4,
    name: "Bronze Age",
    unlockedBy: "bronze",
  },
  {
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

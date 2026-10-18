export const TECHNOLOGY_IDS = ["fire", "shelter", "spear", "fishing", "storage", "huts", "farming", "totem"] as const;

export type TechnologyId = (typeof TECHNOLOGY_IDS)[number];

export interface TechnologyDefinition {
  cost: number;
  description: string;
  id: TechnologyId;
  name: string;
  requires: readonly TechnologyId[];
}

export const TECHNOLOGIES: readonly TechnologyDefinition[] = [
  {
    cost: 40,
    description: "A campfire keeps people warm at night and in winter, cooks food and keeps beasts away.",
    id: "fire",
    name: "Fire",
    requires: [],
  },
  {
    cost: 70,
    description: "Shelters of branches and hides: warm sleep and room for children.",
    id: "shelter",
    name: "Shelters",
    requires: ["fire"],
  },
  {
    cost: 105,
    description: "Hunters track deer and even mammoths.",
    id: "spear",
    name: "Spears",
    requires: ["fire"],
  },
  {
    cost: 150,
    description: "Food from lakes and rivers all year round.",
    id: "fishing",
    name: "Fishing",
    requires: ["spear"],
  },
  {
    cost: 200,
    description: "A storehouse: food spoils slower and winter is easier to survive.",
    id: "storage",
    name: "Storage",
    requires: ["shelter"],
  },
  {
    cost: 270,
    description: "Sturdy homes of logs and stone instead of shelters.",
    id: "huts",
    name: "Huts",
    requires: ["shelter", "storage"],
  },
  {
    cost: 360,
    description: "Fields near the camp: sown in spring, harvested in autumn.",
    id: "farming",
    name: "Farming",
    requires: ["huts"],
  },
  {
    cost: 450,
    description: "A sacred totem. Faith grows and people stay calmer.",
    id: "totem",
    name: "Totem",
    requires: ["huts"],
  },
];

export interface EraDefinition {
  name: string;
  unlockedBy: TechnologyId | "start";
}

export const ERAS: readonly EraDefinition[] = [
  { name: "Wanderers", unlockedBy: "start" },
  { name: "Fire keepers", unlockedBy: "fire" },
  { name: "Hunters", unlockedBy: "spear" },
  { name: "Settlers", unlockedBy: "huts" },
  { name: "Farmers", unlockedBy: "farming" },
];

export function technologyDefinition(id: TechnologyId): TechnologyDefinition {
  const definition = TECHNOLOGIES.find((technology) => technology.id === id);

  if (definition === undefined) {
    throw new RangeError(`Unknown technology ${id}`);
  }

  return definition;
}

export function nextTechnology(known: ReadonlySet<TechnologyId>): TechnologyDefinition | undefined {
  return TECHNOLOGIES.find(
    (technology) => !known.has(technology.id) && technology.requires.every((required) => known.has(required))
  );
}

export function currentEra(known: ReadonlySet<TechnologyId>): EraDefinition {
  let [era] = ERAS;

  for (const candidate of ERAS) {
    if (candidate.unlockedBy === "start" || known.has(candidate.unlockedBy)) {
      era = candidate;
    }
  }

  if (era === undefined) {
    throw new RangeError("No eras are defined");
  }

  return era;
}

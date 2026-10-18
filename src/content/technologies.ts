import type { ResourceKind } from "./resources.ts";

const TECHNOLOGY_IDS = [
  "fire",
  "shelter",
  "spear",
  "fishing",
  "storage",
  "archery",
  "huts",
  "pottery",
  "farming",
  "totem",
  "weaving",
  "orchards",
  "mining",
  "copper",
  "ploughing",
  "bronze",
  "forestry",
  "iron",
  "masonry",
] as const;

export type TechnologyId = (typeof TECHNOLOGY_IDS)[number];

export interface MaterialNeed {
  amount: number;
  resource: ResourceKind;
}

export interface TechnologyDefinition {
  cost: number;
  description: string;
  id: TechnologyId;
  name: string;
  needs: MaterialNeed | null;
  requires: readonly TechnologyId[];
}

export const TECHNOLOGIES: readonly TechnologyDefinition[] = [
  {
    cost: 40,
    description: "A campfire keeps people warm at night and in winter, cooks food and keeps beasts away.",
    id: "fire",
    name: "Fire",
    needs: null,
    requires: [],
  },
  {
    cost: 60,
    description: "Shelters of branches and hides: warm sleep and room for children.",
    id: "shelter",
    name: "Shelters",
    needs: null,
    requires: ["fire"],
  },
  {
    cost: 90,
    description: "Hunters track deer and even mammoths with stone-tipped spears.",
    id: "spear",
    name: "Spears",
    needs: null,
    requires: ["fire"],
  },
  {
    cost: 125,
    description: "Food from lakes and rivers all year round.",
    id: "fishing",
    name: "Fishing",
    needs: null,
    requires: ["spear"],
  },
  {
    cost: 160,
    description: "A storehouse: food spoils slower and winter is easier to survive.",
    id: "storage",
    name: "Storage",
    needs: null,
    requires: ["shelter"],
  },
  {
    cost: 190,
    description: "Bows and arrows bring down game from a safe distance.",
    id: "archery",
    name: "Archery",
    needs: null,
    requires: ["spear"],
  },
  {
    cost: 220,
    description: "Sturdy round huts of daub and thatch instead of shelters.",
    id: "huts",
    name: "Huts",
    needs: null,
    requires: ["shelter", "storage"],
  },
  {
    cost: 250,
    description: "Clay dug by the water is fired in a kiln into pots that keep food fresh.",
    id: "pottery",
    name: "Pottery",
    needs: null,
    requires: ["huts"],
  },
  {
    cost: 280,
    description: "Fields of wheat and barley near the camp: sown in spring, harvested in autumn.",
    id: "farming",
    name: "Farming",
    needs: null,
    requires: ["huts", "pottery"],
  },
  {
    cost: 330,
    description: "A sacred totem. Faith grows and people stay calmer.",
    id: "totem",
    name: "Totem",
    needs: null,
    requires: ["huts"],
  },
  {
    cost: 370,
    description: "Flax is grown and spun into linen for lighter clothes.",
    id: "weaving",
    name: "Weaving",
    needs: null,
    requires: ["farming"],
  },
  {
    cost: 410,
    description: "Apple, pear and plum trees and berry bushes are planted by the camp.",
    id: "orchards",
    name: "Orchards",
    needs: null,
    requires: ["farming"],
  },
  {
    cost: 450,
    description: "Green-stained rock in the hills is dug out of a mine.",
    id: "mining",
    name: "Mining",
    needs: null,
    requires: ["farming"],
  },
  {
    cost: 510,
    description: "Copper ore is smelted in a furnace and cast into tools.",
    id: "copper",
    name: "Copper smelting",
    needs: { amount: 6, resource: "copperOre" },
    requires: ["mining"],
  },
  {
    cost: 570,
    description: "Fenced fields are ploughed for carrots, turnips and more grain.",
    id: "ploughing",
    name: "Ploughing",
    needs: null,
    requires: ["copper"],
  },
  {
    cost: 630,
    description: "Copper melted with tin gives hard bronze for blades and tools.",
    id: "bronze",
    name: "Bronze",
    needs: { amount: 4, resource: "tinOre" },
    requires: ["copper"],
  },
  {
    cost: 700,
    description: "Woodlots are planted and tended, and felled trees replanted.",
    id: "forestry",
    name: "Forestry",
    needs: null,
    requires: ["bronze"],
  },
  {
    cost: 780,
    description: "Iron is forged from rusty ore: the hardest tools and weapons.",
    id: "iron",
    name: "Ironworking",
    needs: { amount: 6, resource: "ironOre" },
    requires: ["bronze"],
  },
  {
    cost: 880,
    description: "Houses and walls of dressed stone.",
    id: "masonry",
    name: "Masonry",
    needs: null,
    requires: ["iron"],
  },
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

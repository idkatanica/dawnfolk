import { Ground, type GroundIndex } from "./grounds.ts";
import type { MaterialKind } from "./resources.ts";
import type { TechnologyId } from "./technologies.ts";

export const MINED_DEPOSIT_KINDS = ["copper", "tin", "iron"] as const;

export type MinedDepositKind = (typeof MINED_DEPOSIT_KINDS)[number];

export const DEPOSIT_KINDS = [...MINED_DEPOSIT_KINDS, "clay"] as const;

export type DepositKind = (typeof DEPOSIT_KINDS)[number];

export interface DepositDefinition {
  ground: GroundIndex;
  name: string;
  perSquareKilometer: number;
  radius: number;
  reach: number;
  resource: MaterialKind;
  technology: TechnologyId;
}

export const DEPOSITS: Readonly<Record<DepositKind, DepositDefinition>> = {
  clay: {
    ground: Ground.Clay,
    name: "Clay bank",
    perSquareKilometer: 1.15,
    radius: 28,
    reach: 900,
    resource: "clay",
    technology: "pottery",
  },
  copper: {
    ground: Ground.CopperOre,
    name: "Copper vein",
    perSquareKilometer: 1.15,
    radius: 30,
    reach: 1500,
    resource: "copperOre",
    technology: "mining",
  },
  iron: {
    ground: Ground.IronOre,
    name: "Iron vein",
    perSquareKilometer: 1.15,
    radius: 34,
    reach: 1500,
    resource: "ironOre",
    technology: "bronze",
  },
  tin: {
    ground: Ground.TinOre,
    name: "Tin vein",
    perSquareKilometer: 0.92,
    radius: 26,
    reach: 1500,
    resource: "tinOre",
    technology: "copper",
  },
};

export function depositCode(kind: DepositKind): number {
  return DEPOSIT_KINDS.indexOf(kind) + 1;
}

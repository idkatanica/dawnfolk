import { DepositGround } from "./deposit-grounds.ts";
import type { GroundIndex } from "./grounds.ts";
import type { MaterialKind } from "./resources.ts";
import type { TechnologyId } from "./technologies.ts";

export const DEPOSIT_KINDS = ["copper", "tin", "iron", "clay"] as const;

export type DepositKind = (typeof DEPOSIT_KINDS)[number];

export interface DepositDefinition {
  countPerIsland: number;
  ground: GroundIndex;
  isMined: boolean;
  name: string;
  radius: number;
  reach: number;
  resource: MaterialKind;
  technology: TechnologyId;
}

export const DEPOSITS: Readonly<Record<DepositKind, DepositDefinition>> = {
  clay: {
    countPerIsland: 30,
    ground: DepositGround.Clay,
    isMined: false,
    name: "Clay bank",
    radius: 28,
    reach: 900,
    resource: "clay",
    technology: "pottery",
  },
  copper: {
    countPerIsland: 30,
    ground: DepositGround.CopperOre,
    isMined: true,
    name: "Copper vein",
    radius: 30,
    reach: 1200,
    resource: "copperOre",
    technology: "mining",
  },
  iron: {
    countPerIsland: 30,
    ground: DepositGround.IronOre,
    isMined: true,
    name: "Iron vein",
    radius: 34,
    reach: 1200,
    resource: "ironOre",
    technology: "bronze",
  },
  tin: {
    countPerIsland: 24,
    ground: DepositGround.TinOre,
    isMined: true,
    name: "Tin vein",
    radius: 26,
    reach: 1200,
    resource: "tinOre",
    technology: "copper",
  },
};

export function depositCode(kind: DepositKind): number {
  return DEPOSIT_KINDS.indexOf(kind) + 1;
}

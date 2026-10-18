import type { GroundDefinition } from "./grounds.ts";

export const DepositGround = {
  Clay: 15,
  CopperOre: 12,
  IronOre: 14,
  TinOre: 13,
} as const;

export const DEPOSIT_GROUNDS: readonly GroundDefinition[] = [
  {
    fertility: 0,
    flammability: 0,
    fuel: 0,
    grass: 0,
    holdsTrees: false,
    index: DepositGround.CopperOre,
    name: "Copper vein",
    seasonalColors: [
      [0.33, 0.5, 0.44],
      [0.34, 0.51, 0.45],
      [0.33, 0.5, 0.44],
      [0.33, 0.47, 0.43],
    ],
    walkSpeed: 0.75,
  },
  {
    fertility: 0,
    flammability: 0,
    fuel: 0,
    grass: 0,
    holdsTrees: false,
    index: DepositGround.TinOre,
    name: "Tin vein",
    seasonalColors: [
      [0.3, 0.29, 0.33],
      [0.31, 0.3, 0.34],
      [0.3, 0.29, 0.33],
      [0.31, 0.3, 0.34],
    ],
    walkSpeed: 0.75,
  },
  {
    fertility: 0,
    flammability: 0,
    fuel: 0,
    grass: 0,
    holdsTrees: false,
    index: DepositGround.IronOre,
    name: "Iron vein",
    seasonalColors: [
      [0.55, 0.27, 0.16],
      [0.56, 0.28, 0.17],
      [0.55, 0.27, 0.16],
      [0.51, 0.27, 0.18],
    ],
    walkSpeed: 0.75,
  },
  {
    fertility: 0.3,
    flammability: 0,
    fuel: 0,
    grass: 0.1,
    holdsTrees: false,
    index: DepositGround.Clay,
    name: "Clay bank",
    seasonalColors: [
      [0.6, 0.53, 0.43],
      [0.63, 0.55, 0.44],
      [0.6, 0.53, 0.43],
      [0.56, 0.52, 0.45],
    ],
    walkSpeed: 0.85,
  },
];

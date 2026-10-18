import { CultivatedSpecies } from "../../content/cultivated-plants.ts";
import type { PlantSpeciesIndex } from "../../content/plants.ts";
import type { FoliageKey } from "./plant-palette.ts";

const BARE_TWIGS = 0x7a_6a_44;
const BUDS = 0x8e_9a_4c;
const FRESH_LEAVES = 0x9c_c8_52;

function fruitTree(blossom: number, summer: number, autumn: number): readonly FoliageKey[] {
  return [
    { color: BARE_TWIGS, coverage: 0, season: 0 },
    { color: BUDS, coverage: 0.45, season: 0.07 },
    { color: blossom, coverage: 0.95, season: 0.14 },
    { color: blossom, coverage: 1, season: 0.4 },
    { color: FRESH_LEAVES, coverage: 1, season: 0.56 },
    { color: summer, coverage: 1, season: 1.1 },
    { color: summer, coverage: 1, season: 2.05 },
    { color: autumn, coverage: 1, season: 2.45 },
    { color: autumn, coverage: 0.5, season: 2.8 },
    { color: BARE_TWIGS, coverage: 0, season: 3.1 },
    { color: BARE_TWIGS, coverage: 0, season: 3.8 },
  ];
}

function berryBush(summer: number, autumn: number): readonly FoliageKey[] {
  return [
    { color: BUDS, coverage: 0.35, season: 0 },
    { color: FRESH_LEAVES, coverage: 0.9, season: 0.2 },
    { color: summer, coverage: 1, season: 0.6 },
    { color: summer, coverage: 1, season: 2.1 },
    { color: autumn, coverage: 1, season: 2.5 },
    { color: autumn, coverage: 0.5, season: 2.85 },
    { color: BARE_TWIGS, coverage: 0, season: 3.15 },
    { color: BARE_TWIGS, coverage: 0, season: 3.8 },
  ];
}

export const ORCHARD_FOLIAGE_KEYS = {
  [CultivatedSpecies.AppleTree]: fruitTree(0xf2_d2_da, 0x52_88_34, 0xb8_9a_38),
  [CultivatedSpecies.Blueberry]: berryBush(0x4c_7a_44, 0xb4_30_28),
  [CultivatedSpecies.Currant]: berryBush(0x66_98_3e, 0xc4_a0_38),
  [CultivatedSpecies.PearTree]: fruitTree(0xf6_f3_ea, 0x4e_86_36, 0xc0_52_2c),
  [CultivatedSpecies.PlumTree]: fruitTree(0xf4_e2_e8, 0x55_80_3a, 0xa4_4c_38),
  [CultivatedSpecies.Raspberry]: berryBush(0x5c_8e_3a, 0xb0_8a_2e),
} as const satisfies Readonly<Partial<Record<PlantSpeciesIndex, readonly FoliageKey[]>>>;

import { PlantSpecies, type PlantSpeciesIndex } from "../../content/plants.ts";
import { SEASON_COUNT } from "../../content/seasons.ts";
import { mixColors } from "../../shared/color.ts";
import { lerp } from "../../shared/math.ts";

interface FoliageLook {
  readonly color: number;
  readonly coverage: number;
}

interface FoliageKey {
  readonly color: number;
  readonly coverage: number;
  readonly season: number;
}

const BARE_BRANCHES = 0x7a_6a_44;
const BUDS = 0x8e_9a_4c;

function deciduous(summer: number, autumn: number): readonly FoliageKey[] {
  return [
    { color: BUDS, coverage: 0.4, season: 0 },
    { color: 0x9c_c8_52, coverage: 0.85, season: 0.2 },
    { color: 0x86_b8_48, coverage: 1, season: 0.45 },
    { color: summer, coverage: 1, season: 1.2 },
    { color: summer, coverage: 1, season: 2 },
    { color: autumn, coverage: 1, season: 2.45 },
    { color: autumn, coverage: 0.55, season: 2.8 },
    { color: BARE_BRANCHES, coverage: 0, season: 3.1 },
    { color: BARE_BRANCHES, coverage: 0, season: 3.75 },
  ];
}

function evergreen(summer: number, winter: number): readonly FoliageKey[] {
  return [
    { color: winter, coverage: 1, season: 0 },
    { color: summer, coverage: 1, season: 0.6 },
    { color: summer, coverage: 1, season: 2.4 },
    { color: winter, coverage: 1, season: 3.2 },
  ];
}

const LEAFLESS: readonly FoliageKey[] = [{ color: BARE_BRANCHES, coverage: 0, season: 0 }];

const FOLIAGE_KEYS: Readonly<Record<PlantSpeciesIndex, readonly FoliageKey[]>> = {
  [PlantSpecies.Acacia]: evergreen(0x76_93_42, 0x86_8c_4c),
  [PlantSpecies.Birch]: deciduous(0x6f_a8_40, 0xe0_b0_36),
  [PlantSpecies.Boulder]: evergreen(0x6f_8a_3e, 0x6a_6a_48),
  [PlantSpecies.Bush]: deciduous(0x4f_86_34, 0xa8_52_2a),
  [PlantSpecies.Cactus]: evergreen(0x4f_8a_4a, 0x4a_7c_46),
  [PlantSpecies.DeadTree]: LEAFLESS,
  [PlantSpecies.DesertShrub]: evergreen(0x8c_9a_68, 0x80_88_5e),
  [PlantSpecies.Maple]: deciduous(0x4e_8c_32, 0xc4_3e_24),
  [PlantSpecies.Oak]: deciduous(0x4a_7e_2e, 0xb0_6a_28),
  [PlantSpecies.Palm]: evergreen(0x58_94_3a, 0x52_86_3a),
  [PlantSpecies.Pine]: evergreen(0x3c_6a_38, 0x33_58_3c),
  [PlantSpecies.Poplar]: deciduous(0x5a_92_38, 0xe2_c0_38),
  [PlantSpecies.Spruce]: evergreen(0x2c_56_38, 0x27_48_3a),
  [PlantSpecies.Willow]: deciduous(0x82_a8_44, 0xbc_b0_46),
};

function wrapSeason(season: number): number {
  return ((season % SEASON_COUNT) + SEASON_COUNT) % SEASON_COUNT;
}

function interpolate(from: FoliageKey, to: FoliageKey, season: number, span: number): FoliageLook {
  const offset = wrapSeason(season - from.season);

  const amount = span <= 0 ? 0 : offset / span;

  return { color: mixColors(from.color, to.color, amount), coverage: lerp(from.coverage, to.coverage, amount) };
}

export function foliageLook(species: PlantSpeciesIndex, season: number): FoliageLook {
  const keys = FOLIAGE_KEYS[species];
  const current = wrapSeason(season);

  for (const [index, key] of keys.entries()) {
    const next = keys[(index + 1) % keys.length];

    const span = wrapSeason(next.season - key.season);

    if (wrapSeason(current - key.season) <= span) {
      return interpolate(key, next, current, span);
    }
  }

  return { color: keys[0].color, coverage: keys[0].coverage };
}

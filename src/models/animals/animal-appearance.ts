import type { AnimalKind } from "../../content/animals.ts";
import { colorFromPalette, mixColors, scaleColor } from "../../shared/color.ts";
import { lerp } from "../../shared/math.ts";
import { createRandom, type RandomSource } from "../../shared/random.ts";

export interface AnimalAppearance {
  readonly antlerSize: number;
  readonly coat: number;
  readonly coatLight: number;
  readonly hasAntlers: boolean;
  readonly hasSpots: boolean;
  readonly headScale: number;
  readonly legScale: number;
  readonly size: number;
  readonly tuskLength: number;
}

export interface AnimalAppearanceInput {
  readonly kind: AnimalKind;
  readonly seed: number;
  readonly youth: number;
}

const DEER_COATS: readonly number[] = [0x6e_4a_2e, 0x7a_4e_30, 0x8a_5a_36, 0x9a_6a_40, 0xa8_7a_4c];
const DEER_BELLY = 0xe0_cc_aa;
const MAMMOTH_COATS: readonly number[] = [0x3e_2a_1e, 0x4a_34_24, 0x5c_3e_28, 0x6a_4a_30, 0x7a_58_3a];

function youthScale(youth: number): number {
  return lerp(1, 0.42, youth);
}

function antlerChoice(random: RandomSource, youth: number): Pick<AnimalAppearance, "antlerSize" | "hasAntlers"> {
  const isStag = random.chance(0.45);
  const antlerSize = random.between(0.7, 1.2);

  return { antlerSize, hasAntlers: isStag && youth < 0.3 };
}

function deerAppearance(random: RandomSource, youth: number): AnimalAppearance {
  const coat = scaleColor(colorFromPalette(DEER_COATS, random.next()), random.between(0.92, 1.08));
  const size = random.between(0.9, 1.12) * youthScale(youth);

  return {
    ...antlerChoice(random, youth),
    coat,
    coatLight: mixColors(DEER_BELLY, coat, random.between(0.05, 0.25)),
    hasSpots: youth > 0.35,
    headScale: lerp(1, 1.32, youth),
    legScale: lerp(1, 1.14, youth),
    size,
    tuskLength: 0,
  };
}

function mammothAppearance(random: RandomSource, youth: number): AnimalAppearance {
  const coat = scaleColor(colorFromPalette(MAMMOTH_COATS, random.next()), random.between(0.9, 1.1));
  const size = random.between(0.9, 1.1) * youthScale(youth);

  return {
    antlerSize: 0,
    coat,
    coatLight: scaleColor(coat, 1.35),
    hasAntlers: false,
    hasSpots: false,
    headScale: lerp(1, 1.25, youth),
    legScale: lerp(1, 1.08, youth),
    size,
    tuskLength: random.between(0.65, 1.15) * (1 - youth * 0.8),
  };
}

export function animalAppearance(input: AnimalAppearanceInput): AnimalAppearance {
  const random = createRandom(Math.floor(input.seed * 2_147_483_647) + 7);

  if (input.kind === "deer") {
    return deerAppearance(random, input.youth);
  }

  return mammothAppearance(random, input.youth);
}

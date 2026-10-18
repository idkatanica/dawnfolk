const PART_MASK_BITS_PER_WORD = 24;

const PART_MASK_WORDS = 2;

export const MAXIMUM_PARTS = PART_MASK_BITS_PER_WORD * PART_MASK_WORDS;

export type PartMask = readonly [low: number, high: number];

export const EMPTY_PART_MASK: PartMask = [0, 0];

function hasBit(word: number, bit: number): boolean {
  return Math.floor(word / 2 ** bit) % 2 === 1;
}

export function withPart(mask: PartMask, part: number): PartMask {
  if (!Number.isInteger(part) || part < 0 || part >= MAXIMUM_PARTS) {
    throw new RangeError(`Part ${part} does not fit in a part mask`);
  }

  const [low, high] = mask;

  const wordIndex = Math.floor(part / PART_MASK_BITS_PER_WORD);
  const bit = part % PART_MASK_BITS_PER_WORD;

  if (wordIndex === 0) {
    return hasBit(low, bit) ? mask : [low + 2 ** bit, high];
  }

  return hasBit(high, bit) ? mask : [low, high + 2 ** bit];
}

export function maskOf(parts: Iterable<number>): PartMask {
  let mask = EMPTY_PART_MASK;

  for (const part of parts) {
    mask = withPart(mask, part);
  }

  return mask;
}

export function hasPart(mask: PartMask, part: number): boolean {
  const [low, high] = mask;

  const wordIndex = Math.floor(part / PART_MASK_BITS_PER_WORD);
  const bit = part % PART_MASK_BITS_PER_WORD;

  return hasBit(wordIndex === 0 ? low : high, bit);
}

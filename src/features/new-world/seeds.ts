export const LARGEST_SEED = 999_999;

export function randomSeed(): number {
  return 1 + Math.floor(Math.random() * LARGEST_SEED);
}

export function readSeed(text: string): number | null {
  const seed = Number(text.trim());

  if (!Number.isInteger(seed) || seed < 1 || seed > LARGEST_SEED) {
    return null;
  }

  return seed;
}

export const SEASONS = ["Spring", "Summer", "Autumn", "Winter"] as const;

export type SeasonName = (typeof SEASONS)[number];

export const SEASON_COUNT = SEASONS.length;

export function seasonName(season: number): SeasonName {
  const name = SEASONS[Math.floor(season) % SEASON_COUNT];

  if (name === undefined) {
    throw new RangeError(`Season ${season} is outside the year`);
  }

  return name;
}

export function seasonTemperatureOffset(season: number): number {
  return 10 * Math.cos((2 * Math.PI * (season - 1.5)) / SEASON_COUNT);
}

export function isWinter(season: number): boolean {
  return season >= 3;
}

export function isGrowingSeason(season: number): boolean {
  return season >= 0.2 && season < 2.6;
}

export const WEATHER_KINDS = [
  "clear",
  "cloudy",
  "overcast",
  "fog",
  "rain",
  "storm",
  "snow",
  "blizzard",
  "heat",
] as const;

export type WeatherKind = (typeof WEATHER_KINDS)[number];

interface WeatherDefinition {
  cloudCover: number;
  fog: number;
  name: string;
  precipitation: number;
  seasonalOdds: readonly [number, number, number, number];
  storm: number;
  temperatureOffset: number;
  windFactor: number;
}

export const WEATHER: Readonly<Record<WeatherKind, WeatherDefinition>> = {
  blizzard: {
    cloudCover: 1,
    fog: 0.5,
    name: "Blizzard",
    precipitation: 1,
    seasonalOdds: [0, 0, 0.1, 0.9],
    storm: 0.2,
    temperatureOffset: -8,
    windFactor: 2.4,
  },
  clear: {
    cloudCover: 0.12,
    fog: 0,
    name: "Clear",
    precipitation: 0,
    seasonalOdds: [3, 4, 2.6, 2.4],
    storm: 0,
    temperatureOffset: 1.5,
    windFactor: 0.8,
  },
  cloudy: {
    cloudCover: 0.5,
    fog: 0,
    name: "Cloudy",
    precipitation: 0,
    seasonalOdds: [2.4, 2, 2.4, 2],
    storm: 0,
    temperatureOffset: 0,
    windFactor: 1,
  },
  fog: {
    cloudCover: 0.6,
    fog: 1,
    name: "Fog",
    precipitation: 0,
    seasonalOdds: [0.8, 0.2, 1.4, 0.8],
    storm: 0,
    temperatureOffset: -1,
    windFactor: 0.2,
  },
  heat: {
    cloudCover: 0.04,
    fog: 0,
    name: "Heatwave",
    precipitation: 0,
    seasonalOdds: [0.2, 1.6, 0.4, 0],
    storm: 0,
    temperatureOffset: 9,
    windFactor: 0.6,
  },
  overcast: {
    cloudCover: 0.92,
    fog: 0.1,
    name: "Overcast",
    precipitation: 0,
    seasonalOdds: [1.2, 0.6, 1.6, 1.8],
    storm: 0,
    temperatureOffset: -1.5,
    windFactor: 1.1,
  },
  rain: {
    cloudCover: 0.95,
    fog: 0.15,
    name: "Rain",
    precipitation: 0.75,
    seasonalOdds: [2, 1.1, 2.2, 0.4],
    storm: 0,
    temperatureOffset: -2,
    windFactor: 1.3,
  },
  snow: {
    cloudCover: 0.95,
    fog: 0.2,
    name: "Snow",
    precipitation: 0.7,
    seasonalOdds: [0.3, 0, 0.5, 2.6],
    storm: 0,
    temperatureOffset: -6,
    windFactor: 1.1,
  },
  storm: {
    cloudCover: 1,
    fog: 0.1,
    name: "Thunderstorm",
    precipitation: 1,
    seasonalOdds: [0.6, 1.2, 0.5, 0],
    storm: 1,
    temperatureOffset: -3,
    windFactor: 2,
  },
};

export const SNOWFALL_TEMPERATURE = 0.5;

export function isSnowfallWeather(kind: WeatherKind): boolean {
  return kind === "snow" || kind === "blizzard";
}

export function fallsAsSnow(kind: WeatherKind, temperature: number): boolean {
  return isSnowfallWeather(kind) || temperature < SNOWFALL_TEMPERATURE;
}

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

export interface WeatherDefinition {
  cloudCover: number;
  fog: number;
  kind: WeatherKind;
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
    kind: "blizzard",
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
    kind: "clear",
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
    kind: "cloudy",
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
    kind: "fog",
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
    kind: "heat",
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
    kind: "overcast",
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
    kind: "rain",
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
    kind: "snow",
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
    kind: "storm",
    name: "Thunderstorm",
    precipitation: 1,
    seasonalOdds: [0.6, 1.2, 0.5, 0],
    storm: 1,
    temperatureOffset: -3,
    windFactor: 2,
  },
};

export function isWeatherKind(value: string): value is WeatherKind {
  return Object.hasOwn(WEATHER, value);
}

import type { WeatherView } from "../simulation/frame.ts";

const METERS_PER_KILOMETER = 1000;
const SECONDS_PER_HOUR = 3600;

export interface Wind {
  readonly directionX: number;
  readonly directionZ: number;
  readonly metersPerSecond: number;
}

export function windOf(weather: WeatherView): Wind {
  return {
    directionX: weather.windX,
    directionZ: weather.windZ,
    metersPerSecond: (weather.windSpeed * METERS_PER_KILOMETER) / SECONDS_PER_HOUR,
  };
}

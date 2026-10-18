import { sunDirection } from "../../shared/astronomy.ts";
import { clamp } from "../../shared/math.ts";
import type { Calendar } from "./calendar.ts";
import type { WeatherSystem } from "./weather.ts";

const HEATWAVE_DROUGHT = 0.35;
const SUMMER_PEAK_SEASON = 1.6;

export interface Environment {
  airTemperatureOffset: number;
  day: number;
  drought: number;
  hours: number;
  isNight: boolean;
  isTimeFrozen: boolean;
  precipitation: number;
  season: number;
  sunlight: number;
  windSpeed: number;
  windX: number;
  windZ: number;
}

export function droughtLevel(season: number, precipitation: number, isHeatwave: boolean): number {
  const summer = Math.max(0, Math.cos((2 * Math.PI * (season - SUMMER_PEAK_SEASON)) / 4));
  const heat = isHeatwave ? HEATWAVE_DROUGHT : 0;

  return clamp(0.42 + 0.35 * summer - 0.7 * precipitation + heat, 0, 1);
}

export function describeEnvironment(calendar: Calendar, weather: WeatherSystem): Environment {
  const { season } = calendar;
  const { state } = weather;
  const wind = weather.windVector();
  const sun = sunDirection(calendar.hours, calendar.season);

  const airTemperatureOffset =
    calendar.seasonalTemperatureOffset() + calendar.diurnalTemperatureOffset() + weather.airTemperatureOffset;

  return {
    airTemperatureOffset,
    day: calendar.day,
    drought: droughtLevel(season, state.precipitation, state.kind === "heat"),
    hours: calendar.hours,
    isNight: calendar.isNight,
    isTimeFrozen: calendar.isTimeFrozen,
    precipitation: state.precipitation,
    season,
    sunlight: Math.max(0, sun.y) * (1 - state.cloudCover),
    windSpeed: state.windSpeed,
    windX: wind.x,
    windZ: wind.z,
  };
}

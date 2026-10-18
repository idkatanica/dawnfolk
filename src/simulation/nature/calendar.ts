import { SEASON_COUNT, seasonName, seasonTemperatureOffset } from "../../content/seasons.ts";
import { fractionalPart } from "../../shared/math.ts";

export const DEFAULT_DAY_SECONDS = 240;
export const DEFAULT_DAYS_PER_SEASON = 3;
export const MINIMUM_DAY_SECONDS = 60;
export const MAXIMUM_DAY_SECONDS = 1800;

const START_TIME_OF_DAY = 0.36;
const HOURS_PER_DAY = 24;
const WARMEST_HOUR = 15;
const DIURNAL_AMPLITUDE = 4.5;

export interface CalendarState {
  day: number;
  daySeconds: number;
  daysPerSeason: number;
  isTimeFrozen: boolean;
}

export const DEFAULT_CALENDAR: CalendarState = {
  day: START_TIME_OF_DAY,
  daySeconds: DEFAULT_DAY_SECONDS,
  daysPerSeason: DEFAULT_DAYS_PER_SEASON,
  isTimeFrozen: false,
};

export interface CalendarView extends CalendarState {
  dayOfSeason: number;
  hours: number;
  season: number;
  seasonName: string;
  year: number;
}

export class Calendar {
  day: number;
  daySeconds: number;
  daysPerSeason: number;
  isTimeFrozen: boolean;

  constructor(state: CalendarState = DEFAULT_CALENDAR) {
    this.day = state.day;
    this.daySeconds = state.daySeconds;
    this.daysPerSeason = state.daysPerSeason;
    this.isTimeFrozen = state.isTimeFrozen;
  }

  get timeOfDay(): number {
    return fractionalPart(this.day);
  }

  get hours(): number {
    return this.timeOfDay * HOURS_PER_DAY;
  }

  get yearLength(): number {
    return this.daysPerSeason * SEASON_COUNT;
  }

  get season(): number {
    return (this.day / this.daysPerSeason) % SEASON_COUNT;
  }

  get year(): number {
    return Math.floor(this.day / this.yearLength) + 1;
  }

  get dayOfSeason(): number {
    return Math.floor(this.day % this.daysPerSeason) + 1;
  }

  get isNight(): boolean {
    return this.hours >= 21 || this.hours < 5.5;
  }

  advance(gameSeconds: number): number {
    if (this.isTimeFrozen || gameSeconds <= 0) {
      return 0;
    }

    const days = gameSeconds / this.daySeconds;

    this.day += days;

    return days;
  }

  setHours(hours: number): void {
    this.day = Math.floor(this.day) + fractionalPart(hours / HOURS_PER_DAY);
  }

  setSeason(season: number): void {
    const { timeOfDay } = this;
    const yearStart = this.day - (this.day % this.yearLength);

    this.day = Math.floor(yearStart + season * this.daysPerSeason + 0.001) + timeOfDay;
  }

  setDaysPerSeason(daysPerSeason: number): void {
    const { season, timeOfDay } = this;
    const completedYears = Math.floor(this.day / this.yearLength);

    this.daysPerSeason = daysPerSeason;
    this.day = completedYears * this.yearLength + Math.floor(season * daysPerSeason) + timeOfDay;
  }

  diurnalTemperatureOffset(): number {
    return DIURNAL_AMPLITUDE * Math.cos((2 * Math.PI * (this.hours - WARMEST_HOUR)) / HOURS_PER_DAY);
  }

  seasonalTemperatureOffset(): number {
    return seasonTemperatureOffset(this.season);
  }

  saveState(): CalendarState {
    return {
      day: this.day,
      daySeconds: this.daySeconds,
      daysPerSeason: this.daysPerSeason,
      isTimeFrozen: this.isTimeFrozen,
    };
  }

  view(): CalendarView {
    return {
      ...this.saveState(),
      dayOfSeason: this.dayOfSeason,
      hours: this.hours,
      season: this.season,
      seasonName: seasonName(this.season),
      year: this.year,
    };
  }
}

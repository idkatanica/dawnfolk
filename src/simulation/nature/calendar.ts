import { SEASON_COUNT, seasonName, seasonTemperatureOffset } from "../../content/seasons.ts";
import { FULL_TURN, fractionalPart } from "../../shared/math.ts";

export const DEFAULT_DAY_SECONDS = 240;
export const MINIMUM_DAY_SECONDS = 60;
export const MAXIMUM_DAY_SECONDS = 1800;
export const MINIMUM_DAYS_PER_SEASON = 1;
export const MAXIMUM_DAYS_PER_SEASON = 30;

const DEFAULT_DAYS_PER_SEASON = 3;
const START_TIME_OF_DAY = 0.36;
const HOURS_PER_DAY = 24;
const WARMEST_HOUR = 15;
const DIURNAL_AMPLITUDE = 4.5;

interface CalendarState {
  day: number;
  daySeconds: number;
  daysPerSeason: number;
  isTimeFrozen: boolean;
}

export interface CalendarSnapshot extends CalendarState {
  anchorDate: number;
  anchorDay: number;
}

export interface CalendarView extends CalendarState {
  dayOfSeason: number;
  hours: number;
  season: number;
  seasonName: string;
  year: number;
}

export class Calendar {
  day = START_TIME_OF_DAY;
  daySeconds = DEFAULT_DAY_SECONDS;
  daysPerSeason = DEFAULT_DAYS_PER_SEASON;
  isTimeFrozen: boolean;
  #anchorDate = 0;
  #anchorDay = 0;

  constructor() {
    this.isTimeFrozen = false;
  }

  get date(): number {
    return this.#anchorDate + (this.day - this.#anchorDay);
  }

  get timeOfDay(): number {
    return fractionalPart(this.date);
  }

  get hours(): number {
    return this.timeOfDay * HOURS_PER_DAY;
  }

  get yearLength(): number {
    return this.daysPerSeason * SEASON_COUNT;
  }

  get season(): number {
    return (this.date / this.daysPerSeason) % SEASON_COUNT;
  }

  get year(): number {
    return Math.floor(this.date / this.yearLength) + 1;
  }

  get dayOfSeason(): number {
    return Math.floor(this.date % this.daysPerSeason) + 1;
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
    this.#setDate(Math.floor(this.date) + fractionalPart(hours / HOURS_PER_DAY));
  }

  setSeason(season: number): void {
    const { date, timeOfDay } = this;

    const yearStart = date - (date % this.yearLength);

    this.#setDate(Math.floor(yearStart + season * this.daysPerSeason + 0.001) + timeOfDay);
  }

  setDaysPerSeason(daysPerSeason: number): void {
    const { season, timeOfDay } = this;

    const completedYears = Math.floor(this.date / this.yearLength);

    this.daysPerSeason = daysPerSeason;
    this.#setDate(completedYears * this.yearLength + Math.floor(season * daysPerSeason) + timeOfDay);
  }

  snapshot(): CalendarSnapshot {
    return {
      anchorDate: this.#anchorDate,
      anchorDay: this.#anchorDay,
      day: this.day,
      daySeconds: this.daySeconds,
      daysPerSeason: this.daysPerSeason,
      isTimeFrozen: this.isTimeFrozen,
    };
  }

  restore(snapshot: CalendarSnapshot): void {
    this.day = snapshot.day;
    this.daySeconds = snapshot.daySeconds;
    this.daysPerSeason = snapshot.daysPerSeason;
    this.isTimeFrozen = snapshot.isTimeFrozen;
    this.#anchorDate = snapshot.anchorDate;
    this.#anchorDay = snapshot.anchorDay;
  }

  diurnalTemperatureOffset(): number {
    return DIURNAL_AMPLITUDE * Math.cos((FULL_TURN * (this.hours - WARMEST_HOUR)) / HOURS_PER_DAY);
  }

  seasonalTemperatureOffset(): number {
    return seasonTemperatureOffset(this.season);
  }

  view(): CalendarView {
    return {
      day: this.day,
      dayOfSeason: this.dayOfSeason,
      daySeconds: this.daySeconds,
      daysPerSeason: this.daysPerSeason,
      hours: this.hours,
      isTimeFrozen: this.isTimeFrozen,
      season: this.season,
      seasonName: seasonName(this.season),
      year: this.year,
    };
  }

  #setDate(date: number): void {
    this.#anchorDate = date;
    this.#anchorDay = this.day;
  }
}

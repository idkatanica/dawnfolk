import { SEASON_COUNT } from "../../content/seasons.ts";
import { MAXIMUM_WIND_SPEED, WEATHER, WEATHER_KINDS, type WeatherKind } from "../../content/weather.ts";
import type { WorldRules } from "../../content/world-rules.ts";
import { clamp, lerp } from "../../shared/math.ts";
import type { RandomSource } from "../../shared/random.ts";

const EASING_PER_SECOND = 0.12;
const SETTLED_DIFFERENCE = 0.002;
const STORM_LIGHTNING_THRESHOLD = 0.5;

export interface WeatherState {
  cloudCover: number;
  fog: number;
  gust: number;
  isAutomatic: boolean;
  kind: WeatherKind;
  lightningCountdown: number;
  nextChangeInDays: number;
  precipitation: number;
  storm: number;
  temperatureOffset: number;
  userTemperatureOffset: number;
  windBaseSpeed: number;
  windDirection: number;
  windSpeed: number;
}

interface WindVector {
  x: number;
  z: number;
}

export interface WeatherTick {
  day: number;
  elapsedDays: number;
  elapsedSeconds: number;
  season: number;
}

interface WeatherUpdate {
  changedTo: WeatherKind | null;
  lightningStrikes: number;
}

export function pickSeasonalWeather(season: number, random: RandomSource): WeatherKind {
  const seasonIndex = Math.floor(season) % SEASON_COUNT;

  const odds = WEATHER_KINDS.map((kind) => WEATHER[kind].seasonalOdds[seasonIndex]);

  let remaining = random.next() * odds.reduce((total, chance) => total + chance, 0);

  for (const [index, kind] of WEATHER_KINDS.entries()) {
    remaining -= odds[index];

    if (remaining <= 0) {
      return kind;
    }
  }

  return "clear";
}

function easeTowards(current: number, target: number, amount: number): number {
  const eased = lerp(current, target, amount);

  if (Math.abs(target - eased) < SETTLED_DIFFERENCE) {
    return target;
  }

  return eased;
}

function precipitationEasingFactor(current: number, target: number): number {
  if (target > current) {
    return 0.6;
  }

  return 1.2;
}

export class WeatherSystem {
  state: WeatherState = {
    cloudCover: 0.15,
    fog: 0,
    gust: 1,
    isAutomatic: true,
    kind: "clear",
    lightningCountdown: 2,
    nextChangeInDays: 0.6,
    precipitation: 0,
    storm: 0,
    temperatureOffset: 0,
    userTemperatureOffset: 0,
    windBaseSpeed: 14,
    windDirection: 225,
    windSpeed: 14,
  };

  get name(): string {
    return WEATHER[this.state.kind].name;
  }

  get airTemperatureOffset(): number {
    return this.state.temperatureOffset + this.state.userTemperatureOffset;
  }

  snapshot(): WeatherState {
    return { ...this.state };
  }

  restore(snapshot: WeatherState): void {
    this.state = { ...snapshot };
  }

  setKind(kind: WeatherKind): void {
    this.state.kind = kind;
    this.state.isAutomatic = false;
  }

  setAutomatic(): void {
    this.state.isAutomatic = true;
    this.state.nextChangeInDays = 0.2;
  }

  setWind(direction: number, baseSpeed: number, windStrength: number): void {
    this.state.windDirection = direction;
    this.state.windBaseSpeed = baseSpeed;
    this.#updateWindSpeed(windStrength);
  }

  setUserTemperatureOffset(offset: number): void {
    this.state.userTemperatureOffset = offset;
  }

  windVector(): WindVector {
    const towards = ((this.state.windDirection + 180) * Math.PI) / 180;

    return { x: Math.sin(towards), z: -Math.cos(towards) };
  }

  update(tick: WeatherTick, rules: WorldRules, random: RandomSource): WeatherUpdate {
    const changedTo = this.#changeAutomatically(tick, random);

    this.#easeTowardsKind(tick, rules);

    return { changedTo, lightningStrikes: this.#countLightning(tick.elapsedSeconds, rules, random) };
  }

  #changeAutomatically(tick: WeatherTick, random: RandomSource): WeatherKind | null {
    if (!this.state.isAutomatic) {
      return null;
    }

    this.state.nextChangeInDays -= tick.elapsedDays;

    if (this.state.nextChangeInDays > 0) {
      return null;
    }

    this.state.nextChangeInDays = 0.25 + random.next() * 0.6;

    const kind = pickSeasonalWeather(tick.season, random);

    if (kind === this.state.kind) {
      return null;
    }

    this.state.kind = kind;

    return kind;
  }

  #easeTowardsKind(tick: WeatherTick, rules: WorldRules): void {
    const { state } = this;

    const target = WEATHER[state.kind];
    const easing = 1 - Math.exp(-tick.elapsedSeconds * EASING_PER_SECOND);

    const precipitationEasing = easing * precipitationEasingFactor(state.precipitation, target.precipitation);
    const gustTarget = target.windFactor * (0.85 + 0.3 * Math.sin(tick.day * 40));

    state.cloudCover = easeTowards(state.cloudCover, target.cloudCover, easing);
    state.precipitation = easeTowards(state.precipitation, target.precipitation, precipitationEasing);
    state.storm = easeTowards(state.storm, target.storm, easing);
    state.fog = easeTowards(state.fog, target.fog, easing * 0.7);
    state.temperatureOffset = easeTowards(state.temperatureOffset, target.temperatureOffset, easing * 0.5);
    state.gust = easeTowards(state.gust, gustTarget, easing);
    this.#updateWindSpeed(rules.storms.windStrength);
  }

  #updateWindSpeed(windStrength: number): void {
    const { state } = this;

    state.windSpeed = clamp(state.windBaseSpeed * state.gust * windStrength, 0, MAXIMUM_WIND_SPEED);
  }

  #countLightning(gameSeconds: number, rules: WorldRules, random: RandomSource): number {
    const { state } = this;

    const frequency = rules.storms.lightningFrequency;

    if (state.storm <= STORM_LIGHTNING_THRESHOLD || frequency <= 0) {
      return 0;
    }

    state.lightningCountdown -= gameSeconds;

    let strikes = 0;

    while (state.lightningCountdown <= 0) {
      state.lightningCountdown += (2.5 + (random.next() * 7) / state.storm) / frequency;
      strikes += 1;
    }

    return strikes;
  }
}

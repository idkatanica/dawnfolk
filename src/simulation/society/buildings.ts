import { BUILDINGS, type BuildingKind } from "../../content/buildings.ts";
import type { RandomSource } from "../../shared/random.ts";
import { NEIGHBOR_OFFSETS } from "../../world/world-grid.ts";
import type { IdentifierSource } from "../identifiers.ts";
import type { FireSystem } from "../nature/fire.ts";
import { NO_BUILDING, type WorldState } from "../world/world-state.ts";

const CATCHING_FIRE = 0.15;
const BURN_DAMAGE_FACTOR = 1.1;
const SOAKED_GROUND = 0.6;
const HEAVY_RAIN = 0.5;
const CAMPFIRE_FUEL_PER_DAY = 0.9;
const CAMPFIRE_RAIN = 0.4;
const ESCAPE_DROUGHT = 0.55;
const ESCAPE_WIND = 20;
const LIT_CAMPFIRE_FUEL = 0.02;

export type BuildingLossReason = "abandoned" | "burnt" | "destroyed" | "replaced";

export type BuildingIncidentKind = "campfireEscaped" | "caughtFire";

export interface Building {
  burningSeconds: number;
  cell: number;
  fuel: number;
  health: number;
  id: number;
  isRetiring: boolean;
  kind: BuildingKind;
  progress: number;
  rotation: number;
  seed: number;
  tribeId: number;
  x: number;
  z: number;
}

export interface BuildingLoss {
  building: Building;
  reason: BuildingLossReason;
}

export interface BuildingIncident {
  building: Building;
  kind: BuildingIncidentKind;
}

export interface BuildingPlacement {
  kind: BuildingKind;
  rotation: number;
  tribeId: number;
  x: number;
  z: number;
}

export interface BuildingWeather {
  drought: number;
  precipitation: number;
  windSpeed: number;
}

export interface BuildingTick {
  days: number;
  fire: FireSystem;
  random: RandomSource;
  seconds: number;
  weather: BuildingWeather;
}

export function isComplete(building: Building): boolean {
  return building.progress >= 1;
}

export function isCampfireLit(building: Building | null): boolean {
  if (building === null || !isComplete(building)) {
    return false;
  }

  return building.fuel > LIT_CAMPFIRE_FUEL;
}

export class BuildingSystem {
  readonly #identifiers: IdentifierSource;
  readonly #world: WorldState;
  readonly #buildings: Building[] = [];
  #incidents: BuildingIncident[] = [];
  #losses: BuildingLoss[] = [];

  constructor(world: WorldState, identifiers: IdentifierSource) {
    this.#world = world;
    this.#identifiers = identifiers;
  }

  get all(): readonly Building[] {
    return this.#buildings;
  }

  add(placement: BuildingPlacement, random: RandomSource): Building {
    const cell = this.#world.grid.cellAt(placement.x, placement.z);

    const building: Building = {
      ...placement,
      burningSeconds: 0,
      cell,
      fuel: 1,
      health: BUILDINGS[placement.kind].health,
      id: this.#identifiers.next(),
      isRetiring: false,
      progress: 0,
      seed: random.next(),
    };

    if (cell >= 0) {
      this.#world.occupancy[cell] = building.id;
    }

    this.#buildings.push(building);

    return building;
  }

  find(id: number | null): Building | null {
    const building = this.#buildings.find((candidate) => candidate.id === id);

    if (building === undefined) {
      return null;
    }

    return building;
  }

  remove(building: Building, reason: BuildingLossReason): void {
    const index = this.#buildings.indexOf(building);

    if (index < 0) {
      return;
    }

    this.#buildings.splice(index, 1);
    this.#releaseCell(building);
    this.#losses.push({ building, reason });
  }

  takeLosses(): BuildingLoss[] {
    const losses = this.#losses;

    this.#losses = [];

    return losses;
  }

  takeIncidents(): BuildingIncident[] {
    const incidents = this.#incidents;

    this.#incidents = [];

    return incidents;
  }

  nearest(x: number, z: number, radius: number): Building | null {
    let nearest: Building | null = null;
    let nearestDistance = radius * radius;

    for (const building of this.#buildings) {
      const distanceSquared = (building.x - x) ** 2 + (building.z - z) ** 2;

      if (distanceSquared < nearestDistance) {
        nearest = building;
        nearestDistance = distanceSquared;
      }
    }

    return nearest;
  }

  setAlight(building: Building): void {
    if (building.kind === "campfire") {
      return;
    }

    building.burningSeconds = Math.max(building.burningSeconds, BUILDINGS[building.kind].burnTime);
  }

  damageArea(x: number, z: number, radius: number, damage: number, ignites: boolean): void {
    for (const building of [...this.#buildings]) {
      const closeness = 1 - Math.hypot(building.x - x, building.z - z) / radius;

      if (closeness > 0) {
        this.#damage(building, damage * closeness, ignites && closeness > 0.2);
      }
    }
  }

  update(tick: BuildingTick): void {
    for (const building of [...this.#buildings]) {
      if (building.cell >= 0) {
        this.#updateBuilding(building, tick);
      }
    }
  }

  #releaseCell(building: Building): void {
    if (building.cell < 0 || this.#world.occupancy[building.cell] !== building.id) {
      return;
    }

    this.#world.occupancy[building.cell] = NO_BUILDING;
  }

  #damage(building: Building, damage: number, ignites: boolean): void {
    building.health -= damage;

    if (ignites) {
      this.setAlight(building);
    }

    if (building.health <= 0) {
      this.remove(building, "destroyed");
    }
  }

  #updateBuilding(building: Building, tick: BuildingTick): void {
    this.#catchWildfire(building);

    if (building.burningSeconds > 0) {
      this.#burn(building, tick);

      return;
    }

    if (building.kind === "campfire" && isComplete(building)) {
      this.#tendCampfire(building, tick);
    }
  }

  #catchWildfire(building: Building): void {
    const isExposed = building.kind !== "campfire" && isComplete(building) && building.burningSeconds <= 0;

    if (!isExposed || this.#world.fields.fire[building.cell] <= CATCHING_FIRE) {
      return;
    }

    this.setAlight(building);
    this.#incidents.push({ building, kind: "caughtFire" });
  }

  #burn(building: Building, tick: BuildingTick): void {
    const definition = BUILDINGS[building.kind];
    const isDoused =
      this.#world.fields.wetness[building.cell] > SOAKED_GROUND || tick.weather.precipitation > HEAVY_RAIN;

    building.burningSeconds -= tick.seconds * (isDoused ? 3 : 1);
    building.health -= tick.seconds * (definition.health / definition.burnTime) * BURN_DAMAGE_FACTOR;
    tick.fire.addHeat(building.cell, 0.03 * tick.seconds);

    if (tick.random.chance(tick.seconds * 0.3)) {
      tick.fire.addHeat(this.#randomNeighbor(building.cell, tick.random), 0.12);
    }

    if (building.health <= 0) {
      this.#world.fields.scorch[building.cell] = 1;
      this.#world.markSurfaceCell(building.cell);
      this.remove(building, "burnt");

      return;
    }

    building.burningSeconds = Math.max(0, building.burningSeconds);
  }

  #tendCampfire(building: Building, tick: BuildingTick): void {
    const fuelUsed = tick.days * CAMPFIRE_FUEL_PER_DAY + rainDamage(tick);

    building.fuel = Math.max(0, building.fuel - fuelUsed);

    if (building.fuel > 0 && isEscapeWeather(tick.weather)) {
      this.#tryToEscape(building, tick);
    }
  }

  #tryToEscape(building: Building, tick: BuildingTick): void {
    const { weather } = tick;

    const escapeChance = tick.seconds * 0.0004 * weather.drought * (weather.windSpeed / 30);

    if (!tick.random.chance(escapeChance)) {
      return;
    }

    if (tick.fire.ignite(this.#randomNeighbor(building.cell, tick.random), 0.3)) {
      this.#incidents.push({ building, kind: "campfireEscaped" });
    }
  }

  #randomNeighbor(cell: number, random: RandomSource): number {
    const { grid } = this.#world;
    const offset = random.pick(NEIGHBOR_OFFSETS);

    const column = grid.columnOf(cell) + offset.column;
    const row = grid.rowOf(cell) + offset.row;

    if (!grid.contains(column, row)) {
      return cell;
    }

    return grid.index(column, row);
  }
}

function rainDamage(tick: BuildingTick): number {
  const { precipitation } = tick.weather;

  if (precipitation <= CAMPFIRE_RAIN) {
    return 0;
  }

  if (!tick.random.chance(tick.seconds * 0.02 * precipitation)) {
    return 0;
  }

  return CAMPFIRE_RAIN;
}

function isEscapeWeather(weather: BuildingWeather): boolean {
  return weather.drought > ESCAPE_DROUGHT && weather.windSpeed > ESCAPE_WIND;
}

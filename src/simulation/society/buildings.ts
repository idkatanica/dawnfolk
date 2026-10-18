import { BUILDINGS, type BuildingKind, isFlammable } from "../../content/buildings.ts";
import { distanceSquared } from "../../shared/math.ts";
import type { RandomSource } from "../../shared/random.ts";
import { NEIGHBOR_OFFSETS } from "../../world/world-grid.ts";
import type { IdentifierSource } from "../identifiers.ts";
import type { FireSystem } from "../nature/fire.ts";
import { NO_BUILDING, type WorldState } from "../world/world-state.ts";
import { footprintCells } from "./footprints.ts";

const CATCHING_FIRE = 0.15;
const BURN_DAMAGE_FACTOR = 1.1;
const SOAKED_GROUND = 0.6;
const HEAVY_RAIN = 0.5;
const CAMPFIRE_FUEL_PER_DAY = 0.9;
const CAMPFIRE_RAIN = 0.4;
const ESCAPE_DROUGHT = 0.55;
const ESCAPE_WIND = 20;
const LIT_CAMPFIRE_FUEL = 0.02;

type BuildingLossReason = "abandoned" | "burnt" | "destroyed" | "replaced";

export type BuildingIncidentKind = "campfireEscaped" | "caughtFire";

export interface Building {
  burningSeconds: number;
  cell: number;
  cells: readonly number[];
  depositId: number;
  extent: number;
  fuel: number;
  health: number;
  id: number;
  isRetiring: boolean;
  kind: BuildingKind;
  progress: number;
  replacesId: number | null;
  rotation: number;
  seed: number;
  style: number;
  tribeId: number;
  x: number;
  z: number;
}

export const NO_DEPOSIT = -1;

export interface BuildingLoss {
  building: Building;
  reason: BuildingLossReason;
}

interface BuildingIncident {
  building: Building;
  kind: BuildingIncidentKind;
}

interface BuildingPlacement {
  depositId?: number;
  extent?: number;
  kind: BuildingKind;
  rotation: number;
  style?: number;
  tribeId: number;
  x: number;
  z: number;
}

interface BuildingWeather {
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
    const { grid } = this.#world;

    const cell = grid.cellAt(placement.x, placement.z);
    const covered = footprintCells(grid, placement.x, placement.z, BUILDINGS[placement.kind].footprint);
    const id = this.#identifiers.next();

    const cells = covered.filter((candidate) => this.#world.occupancy[candidate] === NO_BUILDING);

    for (const occupied of cells) {
      this.#world.occupancy[occupied] = id;
    }

    const building: Building = {
      burningSeconds: 0,
      cell,
      cells,
      depositId: placement.depositId === undefined ? NO_DEPOSIT : placement.depositId,
      extent: placement.extent === undefined ? 0 : placement.extent,
      fuel: 1,
      health: BUILDINGS[placement.kind].health,
      id,
      isRetiring: false,
      kind: placement.kind,
      progress: 0,
      replacesId: null,
      rotation: placement.rotation,
      seed: random.next(),
      style: placement.style === undefined ? 0 : placement.style,
      tribeId: placement.tribeId,
      x: placement.x,
      z: placement.z,
    };

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
      const squaredDistance = distanceSquared(x, z, building.x, building.z);

      if (squaredDistance < nearestDistance) {
        nearest = building;
        nearestDistance = squaredDistance;
      }
    }

    return nearest;
  }

  setAlight(building: Building): void {
    if (!isFlammable(building.kind)) {
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
    for (const cell of building.cells) {
      if (this.#world.occupancy[cell] === building.id) {
        this.#world.occupancy[cell] = NO_BUILDING;
      }
    }
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
    const isExposed = isFlammable(building.kind) && isComplete(building) && building.burningSeconds <= 0;

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

import { groundDefinition } from "../../content/grounds.ts";
import type { GeneratedWorld } from "../../generation/world-generator.ts";
import { clamp } from "../../shared/math.ts";
import { type CellRegion, RegionChangeTracker, RowChangeTracker } from "../../world/change-tracking.ts";
import { hasRoomFromCoast, isOnIsland } from "../../world/coast.ts";
import { canGrowWild, canStandOn, isOpenGround, slopeAt } from "../../world/footing.ts";
import type { IslandShapeKind } from "../../world/island-shape.ts";
import { type Monument, type MonumentCondition, MonumentDamage } from "../../world/monuments.ts";
import type { TerrainData } from "../../world/terrain-data.ts";
import {
  isWaterAtPoint,
  isWaterCell,
  sampleHeight,
  sampleSurface,
  touchesWaterCell,
} from "../../world/terrain-sampling.ts";
import { NO_PLANT, type PlantPlacement, type VegetationStore } from "../../world/vegetation-store.ts";
import { NO_WATER, type WaterFeatures } from "../../world/water.ts";
import { WorldGrid } from "../../world/world-grid.ts";
import { CellSet } from "./cell-set.ts";

export const NO_BUILDING = -1;
export const MONUMENT_GROUND = -2;
export const SNOW_CAPACITY = 1.2;

const MAXIMUM_TERRAIN_HEIGHT = 3200;
const TERRAIN_LAPSE_RATE = 6.5 / 1000;
const LOWEST_EDIT_BELOW_ORIGINAL = 60;
const WALKABLE_SLOPE = 1.15;

export interface SurfaceFields {
  crop: Float32Array;
  fire: Float32Array;
  fuel: Float32Array;
  heat: Float32Array;
  scorch: Float32Array;
  snow: Float32Array;
  wetness: Float32Array;
}

function createSurfaceFields(cellCount: number, ground: Uint8Array): SurfaceFields {
  const fuel = new Float32Array(cellCount);

  for (let cell = 0; cell < cellCount; cell += 1) {
    fuel[cell] = groundDefinition(ground[cell]).fuel;
  }

  return {
    crop: new Float32Array(cellCount),
    fire: new Float32Array(cellCount),
    fuel,
    heat: new Float32Array(cellCount),
    scorch: new Float32Array(cellCount),
    snow: new Float32Array(cellCount),
    wetness: new Float32Array(cellCount),
  };
}

export class WorldState {
  readonly canopyFuel: Float32Array;
  readonly disturbedDay: Float32Array;
  readonly fields: SurfaceFields;
  readonly grid: WorldGrid;
  readonly groundChanges: RowChangeTracker;
  readonly heightChanges = new RegionChangeTracker();
  readonly initialCanopyFuel: Float32Array;
  readonly lowestHeight: number;
  readonly monumentConditions: readonly MonumentCondition[];
  readonly monuments: readonly Monument[];
  readonly occupancy: Int32Array;
  readonly recovering: CellSet;
  readonly seed: number;
  readonly shape: IslandShapeKind;
  readonly surfaceChanges: RowChangeTracker;
  readonly terrain: TerrainData;
  readonly vegetation: VegetationStore;
  heightVersion = 0;
  water: WaterFeatures;
  waterVersion = 0;
  #hasSuddenHeightEdit = false;

  constructor(generated: GeneratedWorld) {
    this.grid = new WorldGrid(generated.dimensions);
    this.seed = generated.seed;
    this.shape = generated.shape;
    this.terrain = generated.terrain;
    this.vegetation = generated.vegetation;
    this.water = generated.water;
    this.monuments = generated.monuments;
    this.monumentConditions = generated.monuments.map(() => ({ damage: MonumentDamage.Standing, isDrowned: false }));
    this.fields = createSurfaceFields(this.grid.cellCount, generated.terrain.ground);
    this.occupancy = new Int32Array(this.grid.cellCount).fill(NO_BUILDING);
    this.canopyFuel = new Float32Array(this.grid.cellCount);
    this.initialCanopyFuel = new Float32Array(this.grid.cellCount);
    this.disturbedDay = new Float32Array(this.grid.cellCount);
    this.recovering = new CellSet(this.grid.cellCount);
    this.surfaceChanges = new RowChangeTracker(this.grid.cellsPerSide);
    this.groundChanges = new RowChangeTracker(this.grid.cellsPerSide);
    this.lowestHeight = lowestValue(generated.terrain.height);

    for (let cell = 0; cell < this.grid.cellCount; cell += 1) {
      this.refreshCanopy(cell);
    }

    for (const monument of this.monuments) {
      for (const cell of monument.cells) {
        this.occupancy[cell] = MONUMENT_GROUND;
      }
    }
  }

  heightAt(x: number, z: number): number {
    return sampleHeight(this.terrain.height, this.grid, x, z);
  }

  surfaceAt(x: number, z: number): number {
    return sampleSurface(this.terrain, this.grid, x, z);
  }

  isOnIsland(cell: number): boolean {
    return isOnIsland(this.terrain.coastDistance, cell);
  }

  isWater(cell: number): boolean {
    return isWaterCell(this.terrain, cell);
  }

  touchesWater(cell: number): boolean {
    return touchesWaterCell(this.terrain, this.grid, cell);
  }

  isWaterAt(x: number, z: number): boolean {
    return isWaterAtPoint(this.terrain, this.grid, x, z);
  }

  waterDepth(cell: number): number {
    const waterSurface = this.terrain.waterSurface[cell];

    if (waterSurface === NO_WATER) {
      return 0;
    }

    return Math.max(0, waterSurface - this.terrain.height[cell]);
  }

  slope(cell: number): number {
    return slopeAt(this.terrain.height, this.grid, cell);
  }

  isOpenGround(cell: number): boolean {
    return isOpenGround(this.terrain, this.grid, cell);
  }

  canPlace(cell: number, steepestSlope: number): boolean {
    return canStandOn(this.terrain, this.grid, cell, steepestSlope) && this.occupancy[cell] === NO_BUILDING;
  }

  canGrowWild(cell: number, species: number): boolean {
    return canGrowWild(this.terrain, this.grid, cell, species) && this.occupancy[cell] === NO_BUILDING;
  }

  temperature(cell: number, airTemperatureOffset: number): number {
    return this.terrain.baseTemperature[cell] + airTemperatureOffset;
  }

  isWalkable(cell: number): boolean {
    if (!this.isOnIsland(cell) || this.isWater(cell)) {
      return false;
    }

    if (this.isObstructed(cell)) {
      return false;
    }

    return this.slope(cell) < WALKABLE_SLOPE;
  }

  isObstructed(cell: number): boolean {
    return cell >= 0 && this.occupancy[cell] === MONUMENT_GROUND;
  }

  isObstructedAt(x: number, z: number): boolean {
    return this.isObstructed(this.grid.cellAt(x, z));
  }

  isObstructedBetween(fromX: number, fromZ: number, toX: number, toZ: number): boolean {
    if (this.isObstructedAt(fromX, fromZ)) {
      return false;
    }

    return this.grid.cellsAlong(fromX, fromZ, toX, toZ).some((cell) => this.isObstructed(cell));
  }

  isWalkableAt(x: number, z: number): boolean {
    return this.isWalkable(this.grid.cellAt(x, z));
  }

  isBurning(cell: number): boolean {
    return this.fields.fire[cell] > 0;
  }

  markDisturbed(cell: number, day: number): void {
    if (cell < 0) {
      return;
    }

    this.disturbedDay[cell] = day;
    this.recovering.add(cell);
  }

  markSurfaceCell(cell: number): void {
    this.surfaceChanges.markRow(this.grid.rowOf(cell));
  }

  setGround(cell: number, ground: number): void {
    if (this.terrain.ground[cell] === ground) {
      return;
    }

    this.terrain.ground[cell] = ground;
    this.fields.fuel[cell] = groundDefinition(ground).fuel;
    this.groundChanges.markRow(this.grid.rowOf(cell));
  }

  setCrop(cell: number, growth: number): void {
    if (Math.abs(this.fields.crop[cell] - growth) < 0.02) {
      return;
    }

    this.fields.crop[cell] = growth;
    this.groundChanges.markRow(this.grid.rowOf(cell));
  }

  setHeight(cell: number, height: number): void {
    const previous = this.terrain.height[cell];
    const next = clamp(height, this.lowestHeight - LOWEST_EDIT_BELOW_ORIGINAL, MAXIMUM_TERRAIN_HEIGHT);

    this.terrain.height[cell] = next;
    this.terrain.baseTemperature[cell] -= TERRAIN_LAPSE_RATE * (next - previous);
  }

  finishHeightEdit(region: CellRegion): void {
    this.heightChanges.markRegion(region);
    this.heightVersion += 1;
  }

  finishSuddenHeightEdit(region: CellRegion): void {
    this.finishHeightEdit(region);
    this.#hasSuddenHeightEdit = true;
  }

  takeSuddenHeightEdit(): boolean {
    const isSudden = this.#hasSuddenHeightEdit;

    this.#hasSuddenHeightEdit = false;

    return isSudden;
  }

  plant(placement: PlantPlacement): number {
    if (!hasRoomFromCoast(this.terrain.coastDistance, this.grid, placement.x, placement.z)) {
      return NO_PLANT;
    }

    const index = this.vegetation.add(placement);

    if (index >= 0) {
      this.refreshCanopy(this.vegetation.cell[index]);
    }

    return index;
  }

  removePlant(index: number): void {
    const cell = this.vegetation.cell[index];

    this.vegetation.remove(index);

    if (cell >= 0) {
      this.refreshCanopy(cell);
    }
  }

  fellPlant(index: number, day: number, rotation: number): void {
    const cell = this.vegetation.cell[index];

    this.vegetation.fell(index, day, rotation);

    if (cell >= 0) {
      this.refreshCanopy(cell);
    }
  }

  clearPlants(cell: number, includesStones: boolean): void {
    if (!this.vegetation.hasPlantsInCell(cell)) {
      return;
    }

    this.vegetation.clearCell(cell, includesStones);
    this.refreshCanopy(cell);
  }

  refreshCanopy(cell: number): void {
    const fuel = this.vegetation.canopyFuelInCell(cell);

    this.canopyFuel[cell] = fuel;

    if (this.isBurning(cell)) {
      this.initialCanopyFuel[cell] = Math.max(this.initialCanopyFuel[cell], fuel);

      return;
    }

    this.initialCanopyFuel[cell] = fuel;
  }

  replaceWater(water: WaterFeatures): void {
    this.water = water;
    this.markWaterChanged();
  }

  markWaterChanged(): void {
    this.waterVersion += 1;
  }
}

function lowestValue(values: Float32Array): number {
  let lowest = Number.POSITIVE_INFINITY;

  for (const value of values) {
    lowest = Math.min(lowest, value);
  }

  return lowest;
}

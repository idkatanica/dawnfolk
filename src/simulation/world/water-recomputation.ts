import { computeHydrology } from "../../generation/hydrology.ts";
import type { CellRegion } from "../../world/change-tracking.ts";
import type { WorldState } from "./world-state.ts";

const QUIET_SECONDS_BEFORE_RECOMPUTE = 0.7;
const PATCH_MARGIN_CELLS = 2;

export class WaterRecomputation {
  readonly #world: WorldState;
  #observedHeightVersion: number;
  #quietSeconds: number | null = null;

  constructor(world: WorldState) {
    this.#world = world;
    this.#observedHeightVersion = world.heightVersion;
  }

  get isPending(): boolean {
    return this.#quietSeconds !== null;
  }

  update(realSeconds: number): boolean {
    if (this.#world.heightVersion !== this.#observedHeightVersion) {
      this.#observedHeightVersion = this.#world.heightVersion;
      this.#quietSeconds = 0;

      return false;
    }

    if (this.#quietSeconds === null) {
      return false;
    }

    this.#quietSeconds += realSeconds;

    if (this.#quietSeconds < QUIET_SECONDS_BEFORE_RECOMPUTE) {
      return false;
    }

    this.recompute();

    return true;
  }

  recompute(): void {
    const { grid, terrain } = this.#world;

    const uncarvedHeights = new Float32Array(grid.cellCount);

    for (let cell = 0; cell < grid.cellCount; cell += 1) {
      uncarvedHeights[cell] = terrain.height[cell] + terrain.carving[cell];
    }

    const carvedHeights = uncarvedHeights.slice();

    const hydrology = computeHydrology(carvedHeights, grid, terrain.dryness, terrain.coastDistance);

    const changedRegion = this.#applyCarving(uncarvedHeights, carvedHeights);

    terrain.waterSurface.set(hydrology.waterSurface);
    terrain.riverStrength.set(hydrology.riverStrength);
    this.#settleWater();
    this.#world.replaceWater(hydrology.features);

    if (changedRegion !== null) {
      this.#world.finishHeightEdit(changedRegion);
    }

    this.#world.surfaceChanges.markAll();
    this.#observedHeightVersion = this.#world.heightVersion;
    this.#quietSeconds = null;
  }

  #applyCarving(uncarvedHeights: Float32Array, carvedHeights: Float32Array): CellRegion | null {
    const world = this.#world;
    const { grid, terrain } = world;

    let firstColumn = grid.cellsPerSide;
    let firstRow = grid.cellsPerSide;
    let lastColumn = -1;
    let lastRow = -1;

    for (let cell = 0; cell < grid.cellCount; cell += 1) {
      const previousHeight = terrain.height[cell];

      terrain.carving[cell] = uncarvedHeights[cell] - carvedHeights[cell];
      world.setHeight(cell, carvedHeights[cell]);

      if (terrain.height[cell] === previousHeight) {
        continue;
      }

      const column = grid.columnOf(cell);
      const row = grid.rowOf(cell);

      firstColumn = Math.min(firstColumn, column);
      firstRow = Math.min(firstRow, row);
      lastColumn = Math.max(lastColumn, column);
      lastRow = Math.max(lastRow, row);
    }

    if (lastRow < 0) {
      return null;
    }

    return {
      firstColumn: Math.max(0, firstColumn - PATCH_MARGIN_CELLS),
      firstRow: Math.max(0, firstRow - PATCH_MARGIN_CELLS),
      lastColumn: Math.min(grid.cellsPerSide - 1, lastColumn + PATCH_MARGIN_CELLS),
      lastRow: Math.min(grid.cellsPerSide - 1, lastRow + PATCH_MARGIN_CELLS),
    };
  }

  #settleWater(): void {
    const world = this.#world;
    const { fields } = world;

    for (let cell = 0; cell < world.grid.cellCount; cell += 1) {
      if (world.touchesWater(cell)) {
        world.clearPlants(cell, false);
      }

      if (!world.isWater(cell)) {
        continue;
      }

      fields.fire[cell] = 0;
      fields.heat[cell] = 0;
      fields.snow[cell] = 0;
      fields.wetness[cell] = 1;
    }
  }
}

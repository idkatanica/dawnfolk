import { computeHydrology } from "../../generation/hydrology.ts";
import type { WorldState } from "./world-state.ts";

const QUIET_SECONDS_BEFORE_RECOMPUTE = 0.7;

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

    const uncarvedHeights = terrain.height.map((height, cell) => height + terrain.carving[cell]);

    const carvedHeights = Float32Array.from(uncarvedHeights);

    const hydrology = computeHydrology(carvedHeights, grid, terrain.dryness, terrain.coastDistance);

    for (let cell = 0; cell < grid.cellCount; cell += 1) {
      terrain.carving[cell] = uncarvedHeights[cell] - carvedHeights[cell];
      this.#world.setHeight(cell, carvedHeights[cell]);
    }

    terrain.waterSurface.set(hydrology.waterSurface);
    terrain.riverStrength.set(hydrology.riverStrength);
    this.#settleWater();
    this.#world.replaceWater(hydrology.features);
    this.#world.finishHeightEdit({
      firstColumn: 0,
      firstRow: 0,
      lastColumn: grid.cellsPerSide - 1,
      lastRow: grid.cellsPerSide - 1,
    });
    this.#world.surfaceChanges.markAll();
    this.#observedHeightVersion = this.#world.heightVersion;
    this.#quietSeconds = null;
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

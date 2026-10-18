import { Ground, groundDefinition } from "../../content/grounds.ts";
import { SNOWFALL_TEMPERATURE } from "../../content/weather.ts";
import type { WorldRules } from "../../content/world-rules.ts";
import { SNOW_CAPACITY, type WorldState } from "../world/world-state.ts";

export const ROWS_PER_TICK = 32;

const PRECIPITATION_THRESHOLD = 0.02;
const ETERNAL_SNOW_COVER = 0.45;
const ICE_TEMPERATURE = -2;
const WARM_GROUND_TEMPERATURE = 3;

export interface SurfaceConditions {
  airTemperatureOffset: number;
  isSnowfall: boolean;
  precipitation: number;
  sunlight: number;
}

interface SurfaceStep {
  conditions: SurfaceConditions;
  days: number;
  rules: WorldRules;
  seconds: number;
}

export class SurfaceSystem {
  readonly #world: WorldState;
  #nextRow = 0;

  constructor(world: WorldState) {
    this.#world = world;
  }

  update(seconds: number, days: number, conditions: SurfaceConditions, rules: WorldRules): void {
    const { cellsPerSide } = this.#world.grid;

    const firstRow = this.#nextRow;

    const lastRow = Math.min(cellsPerSide, firstRow + ROWS_PER_TICK) - 1;
    const rowsPerPass = cellsPerSide / ROWS_PER_TICK;

    const step: SurfaceStep = { conditions, days: days * rowsPerPass, rules, seconds: seconds * rowsPerPass };

    for (let row = firstRow; row <= lastRow; row += 1) {
      this.#updateRow(row, step);
    }

    this.#world.surfaceChanges.markRows(firstRow, lastRow);
    this.#nextRow = (lastRow + 1) % cellsPerSide;
  }

  #updateRow(row: number, step: SurfaceStep): void {
    const { grid } = this.#world;

    const firstCell = grid.index(0, row);

    for (let cell = firstCell; cell < firstCell + grid.cellsPerSide; cell += 1) {
      const temperature = this.#world.temperature(cell, step.conditions.airTemperatureOffset);

      if (this.#world.isWater(cell)) {
        this.#updateWater(cell, temperature, step);

        continue;
      }

      this.#updatePrecipitation(cell, temperature, step);
      this.#updateMeltAndDrying(cell, temperature, step);
      this.#recoverFromFire(cell, temperature, step);
    }
  }

  #updateWater(cell: number, temperature: number, step: SurfaceStep): void {
    const { fields } = this.#world;

    fields.wetness[cell] = 1;

    if (temperature < ICE_TEMPERATURE) {
      fields.snow[cell] = Math.min(1, fields.snow[cell] + 0.002 * step.seconds);

      return;
    }

    fields.snow[cell] = Math.max(0, fields.snow[cell] - 0.004 * step.seconds * Math.max(1, temperature));
  }

  #updatePrecipitation(cell: number, temperature: number, step: SurfaceStep): void {
    const { fields } = this.#world;
    const { precipitation } = step.conditions;

    if (precipitation <= PRECIPITATION_THRESHOLD) {
      return;
    }

    if (landsAsSnow(temperature, step.conditions)) {
      const snowfall = precipitation * 0.012 * step.seconds * step.rules.water.snowfall;

      fields.snow[cell] = Math.min(SNOW_CAPACITY, fields.snow[cell] + snowfall);

      return;
    }

    const soaking = precipitation * 0.05 * step.seconds * step.rules.water.rainStrength;

    fields.wetness[cell] = Math.min(1, fields.wetness[cell] + soaking);
  }

  #updateMeltAndDrying(cell: number, temperature: number, step: SurfaceStep): void {
    const { fields, terrain } = this.#world;
    const { precipitation, sunlight } = step.conditions;

    if (fields.snow[cell] > 0 && temperature > 0) {
      const isRaining = precipitation > PRECIPITATION_THRESHOLD && !landsAsSnow(temperature, step.conditions);

      const rainMelt = isRaining ? 0.004 : 0;

      const melt = (temperature * 0.0035 + sunlight * 0.003 + rainMelt) * step.seconds * step.rules.water.snowMelt;

      fields.snow[cell] = Math.max(0, fields.snow[cell] - melt);
      fields.wetness[cell] = Math.min(1, fields.wetness[cell] + 0.004 * step.seconds);
    }

    if (fields.wetness[cell] > 0 && precipitation < PRECIPITATION_THRESHOLD) {
      const evaporation = 0.0012 + Math.max(0, temperature) * 0.000_25 + sunlight * 0.001;

      fields.wetness[cell] = Math.max(0, fields.wetness[cell] - evaporation * step.seconds * step.rules.water.drying);
    }

    if (terrain.ground[cell] === Ground.Snow) {
      fields.snow[cell] = Math.max(fields.snow[cell], ETERNAL_SNOW_COVER);
    }
  }

  #recoverFromFire(cell: number, temperature: number, step: SurfaceStep): void {
    const { fields, terrain } = this.#world;

    if (fields.fire[cell] > 0) {
      return;
    }

    const { fuel } = groundDefinition(terrain.ground[cell]);

    const growthRate = temperature > WARM_GROUND_TEMPERATURE ? 1 : 0.2;

    if (fields.fuel[cell] < fuel) {
      fields.fuel[cell] = Math.min(fuel, fields.fuel[cell] + fuel * 0.35 * step.days * growthRate);
    }

    if (fields.scorch[cell] > 0) {
      fields.scorch[cell] = Math.max(0, fields.scorch[cell] - 0.22 * step.days);
    }
  }
}

function landsAsSnow(temperature: number, conditions: SurfaceConditions): boolean {
  return conditions.isSnowfall || temperature < SNOWFALL_TEMPERATURE;
}

import { GROUNDS, Ground } from "../../content/grounds.ts";
import { SNOWFALL_TEMPERATURE } from "../../content/weather.ts";
import type { WorldRules } from "../../content/world-rules.ts";
import type { TerrainData } from "../../world/terrain-data.ts";
import { hasWater } from "../../world/water.ts";
import { SNOW_CAPACITY, type SurfaceFields, type WorldState } from "../world/world-state.ts";

export const ROWS_PER_TICK = 32;

const SEGMENT_CELLS = 32;
const PRECIPITATION_THRESHOLD = 0.02;
const ETERNAL_SNOW_COVER = 0.45;
const ICE_TEMPERATURE = -2;
const WARM_GROUND_TEMPERATURE = 3;
const RAIN_MELT = 0.004;
const UNBUILT_MASK = -1;
const GROUND_FUEL = Float64Array.from(GROUNDS, (ground) => ground.fuel);
const STORED_GROUND_FUEL = Float32Array.from(GROUND_FUEL);
const WATER_WETNESS_BITS = floatBits(1);

export interface SurfaceConditions {
  airTemperatureOffset: number;
  isSnowfall: boolean;
  precipitation: number;
  sunlight: number;
}

interface SurfaceStep {
  airTemperatureOffset: number;
  days: number;
  dryingRate: number;
  iceGrowth: number;
  iceMelt: number;
  isDrying: boolean;
  isPrecipitating: boolean;
  isSnowfall: boolean;
  meltRate: number;
  meltWetting: number;
  scorchFading: number;
  seconds: number;
  snowfall: number;
  soaking: number;
  sunlightDrying: number;
  sunlightMelt: number;
}

function floatBits(value: number): number {
  return new Uint32Array(Float32Array.of(value).buffer)[0];
}

function bitsOf(values: Float32Array): Uint32Array {
  return new Uint32Array(values.buffer, values.byteOffset, values.length);
}

function surfaceStep(seconds: number, days: number, conditions: SurfaceConditions, rules: WorldRules): SurfaceStep {
  const { precipitation, sunlight } = conditions;
  const { water } = rules;

  return {
    airTemperatureOffset: conditions.airTemperatureOffset,
    days,
    dryingRate: water.drying,
    iceGrowth: 0.002 * seconds,
    iceMelt: 0.004 * seconds,
    isDrying: precipitation < PRECIPITATION_THRESHOLD,
    isPrecipitating: precipitation > PRECIPITATION_THRESHOLD,
    isSnowfall: conditions.isSnowfall,
    meltRate: water.snowMelt,
    meltWetting: 0.004 * seconds,
    scorchFading: 0.22 * days,
    seconds,
    snowfall: precipitation * 0.012 * seconds * water.snowfall,
    soaking: precipitation * 0.05 * seconds * water.rainStrength,
    sunlightDrying: sunlight * 0.001,
    sunlightMelt: sunlight * 0.003,
  };
}

export class SurfaceSystem {
  readonly #coldestWaterTemperature: Float32Array;
  readonly #maskHeightVersions: Float64Array;
  readonly #maskWaterVersions: Float64Array;
  readonly #scorchBits: Uint32Array;
  readonly #segmentsPerRow: number;
  readonly #snowBits: Uint32Array;
  readonly #waterCells: Uint8Array;
  readonly #wetnessBits: Uint32Array;
  readonly #world: WorldState;
  #nextRow = 0;

  constructor(world: WorldState) {
    const { cellCount, cellsPerSide } = world.grid;

    this.#world = world;
    this.#segmentsPerRow = Math.ceil(cellsPerSide / SEGMENT_CELLS);
    this.#coldestWaterTemperature = new Float32Array(this.#segmentsPerRow * cellsPerSide);
    this.#waterCells = new Uint8Array(cellCount);
    this.#maskHeightVersions = new Float64Array(cellsPerSide).fill(UNBUILT_MASK);
    this.#maskWaterVersions = new Float64Array(cellsPerSide).fill(UNBUILT_MASK);
    this.#snowBits = bitsOf(world.fields.snow);
    this.#wetnessBits = bitsOf(world.fields.wetness);
    this.#scorchBits = bitsOf(world.fields.scorch);
  }

  update(seconds: number, days: number, conditions: SurfaceConditions, rules: WorldRules): void {
    const { cellsPerSide } = this.#world.grid;

    const firstRow = this.#nextRow;

    const lastRow = Math.min(cellsPerSide, firstRow + ROWS_PER_TICK) - 1;
    const rowsPerPass = cellsPerSide / ROWS_PER_TICK;

    const step = surfaceStep(seconds * rowsPerPass, days * rowsPerPass, conditions, rules);

    for (let row = firstRow; row <= lastRow; row += 1) {
      if (this.#updateRow(row, step)) {
        this.#world.surfaceChanges.markRow(row);
      }
    }

    this.#nextRow = (lastRow + 1) % cellsPerSide;
  }

  #updateRow(row: number, step: SurfaceStep): boolean {
    const { cellsPerSide } = this.#world.grid;

    const rowStart = row * cellsPerSide;
    const rowEnd = rowStart + cellsPerSide;

    this.#refreshMasks(row);

    if (step.isPrecipitating) {
      return this.#updateCells(rowStart, rowEnd, step);
    }

    let isChanged = false;
    let unsettledStart = rowStart;

    for (let segmentInRow = 0; segmentInRow < this.#segmentsPerRow; segmentInRow += 1) {
      const segment = row * this.#segmentsPerRow + segmentInRow;
      const firstCell = rowStart + segmentInRow * SEGMENT_CELLS;
      const endCell = Math.min(rowEnd, firstCell + SEGMENT_CELLS);

      if (!this.#isSettled(segment, firstCell, endCell, step)) {
        continue;
      }

      if (this.#updateCells(unsettledStart, firstCell, step)) {
        isChanged = true;
      }

      unsettledStart = endCell;
    }

    if (this.#updateCells(unsettledStart, rowEnd, step)) {
      isChanged = true;
    }

    return isChanged;
  }

  #refreshMasks(row: number): void {
    const { grid, heightVersion, terrain, waterVersion } = this.#world;

    if (this.#maskHeightVersions[row] === heightVersion && this.#maskWaterVersions[row] === waterVersion) {
      return;
    }

    const { baseTemperature, height, waterSurface } = terrain;
    const waterCells = this.#waterCells;
    const rowStart = row * grid.cellsPerSide;
    const rowEnd = rowStart + grid.cellsPerSide;

    for (let segmentInRow = 0; segmentInRow < this.#segmentsPerRow; segmentInRow += 1) {
      const firstCell = rowStart + segmentInRow * SEGMENT_CELLS;
      const endCell = Math.min(rowEnd, firstCell + SEGMENT_CELLS);

      let coldest = Number.POSITIVE_INFINITY;

      for (let cell = firstCell; cell < endCell; cell += 1) {
        const isWater = hasWater(waterSurface[cell], height[cell]);

        waterCells[cell] = isWater ? 1 : 0;

        if (isWater) {
          coldest = Math.min(coldest, baseTemperature[cell]);
        }
      }

      this.#coldestWaterTemperature[row * this.#segmentsPerRow + segmentInRow] = coldest;
    }

    this.#maskHeightVersions[row] = heightVersion;
    this.#maskWaterVersions[row] = waterVersion;
  }

  #isSettled(segment: number, firstCell: number, endCell: number, step: SurfaceStep): boolean {
    if (this.#coldestWaterTemperature[segment] + step.airTemperatureOffset < ICE_TEMPERATURE) {
      return false;
    }

    const { fields, terrain } = this.#world;
    const { fuel } = fields;
    const { ground } = terrain;
    const waterCells = this.#waterCells;
    const snowBits = this.#snowBits;
    const wetnessBits = this.#wetnessBits;
    const scorchBits = this.#scorchBits;

    for (let cell = firstCell; cell < endCell; cell += 1) {
      const settledWetness = waterCells[cell] === 1 ? WATER_WETNESS_BITS : 0;

      if (snowBits[cell] !== 0 || scorchBits[cell] !== 0 || wetnessBits[cell] !== settledWetness) {
        return false;
      }
    }

    for (let cell = firstCell; cell < endCell; cell += 1) {
      const groundIndex = ground[cell];

      if (groundIndex === Ground.Snow || fuel[cell] < STORED_GROUND_FUEL[groundIndex]) {
        return false;
      }
    }

    return true;
  }

  #updateCells(firstCell: number, endCell: number, step: SurfaceStep): boolean {
    if (firstCell === endCell) {
      return false;
    }

    if (step.isPrecipitating) {
      return this.#updateWetCells(firstCell, endCell, step);
    }

    return this.#updateDryCells(firstCell, endCell, step);
  }

  #updateDryCells(firstCell: number, endCell: number, step: SurfaceStep): boolean {
    const { fields, terrain } = this.#world;
    const { snow, wetness } = fields;
    const { baseTemperature, ground } = terrain;
    const { airTemperatureOffset, isDrying, meltRate, seconds } = step;
    const waterCells = this.#waterCells;

    let isChanged = false;

    for (let cell = firstCell; cell < endCell; cell += 1) {
      if (waterCells[cell] === 1) {
        if (updateWaterCell(cell, fields, terrain, step)) {
          isChanged = true;
        }

        continue;
      }

      const temperature = baseTemperature[cell] + airTemperatureOffset;
      const snowBefore = snow[cell];
      const wetnessBefore = wetness[cell];

      let snowAfter = snowBefore;
      let wetnessAfter = wetnessBefore;

      if (snowAfter > 0 && temperature > 0) {
        const melt = (temperature * 0.0035 + step.sunlightMelt) * seconds * meltRate;

        snowAfter = Math.fround(Math.max(0, snowAfter - melt));
        wetnessAfter = Math.fround(Math.min(1, wetnessAfter + step.meltWetting));
      }

      if (wetnessAfter > 0 && isDrying) {
        const evaporation = 0.0012 + Math.max(0, temperature) * 0.000_25 + step.sunlightDrying;

        wetnessAfter = Math.fround(Math.max(0, wetnessAfter - evaporation * seconds * step.dryingRate));
      }

      if (ground[cell] === Ground.Snow) {
        snowAfter = Math.fround(Math.max(snowAfter, ETERNAL_SNOW_COVER));
      }

      if (snowAfter !== snowBefore || wetnessAfter !== wetnessBefore) {
        isChanged = true;
      }

      snow[cell] = snowAfter;
      wetness[cell] = wetnessAfter;

      if (recoverFromFire(cell, fields, terrain, step)) {
        isChanged = true;
      }
    }

    return isChanged;
  }

  #updateWetCells(firstCell: number, endCell: number, step: SurfaceStep): boolean {
    const { fields, terrain } = this.#world;
    const { snow, wetness } = fields;
    const { baseTemperature, ground } = terrain;
    const { airTemperatureOffset, isSnowfall, meltRate, seconds } = step;
    const waterCells = this.#waterCells;

    let isChanged = false;

    for (let cell = firstCell; cell < endCell; cell += 1) {
      if (waterCells[cell] === 1) {
        if (updateWaterCell(cell, fields, terrain, step)) {
          isChanged = true;
        }

        continue;
      }

      const temperature = baseTemperature[cell] + airTemperatureOffset;
      const snowBefore = snow[cell];
      const wetnessBefore = wetness[cell];

      let snowAfter = snowBefore;
      let wetnessAfter = wetnessBefore;
      let rainMelt = 0;

      if (isSnowfall || temperature < SNOWFALL_TEMPERATURE) {
        snowAfter = Math.fround(Math.min(SNOW_CAPACITY, snowAfter + step.snowfall));
      } else {
        wetnessAfter = Math.fround(Math.min(1, wetnessAfter + step.soaking));
        rainMelt = RAIN_MELT;
      }

      if (snowAfter > 0 && temperature > 0) {
        const melt = (temperature * 0.0035 + step.sunlightMelt + rainMelt) * seconds * meltRate;

        snowAfter = Math.fround(Math.max(0, snowAfter - melt));
        wetnessAfter = Math.fround(Math.min(1, wetnessAfter + step.meltWetting));
      }

      if (ground[cell] === Ground.Snow) {
        snowAfter = Math.fround(Math.max(snowAfter, ETERNAL_SNOW_COVER));
      }

      if (snowAfter !== snowBefore || wetnessAfter !== wetnessBefore) {
        isChanged = true;
      }

      snow[cell] = snowAfter;
      wetness[cell] = wetnessAfter;

      if (recoverFromFire(cell, fields, terrain, step)) {
        isChanged = true;
      }
    }

    return isChanged;
  }
}

function updateWaterCell(cell: number, fields: SurfaceFields, terrain: TerrainData, step: SurfaceStep): boolean {
  const { snow, wetness } = fields;

  const temperature = terrain.baseTemperature[cell] + step.airTemperatureOffset;
  const snowBefore = snow[cell];
  const wetnessBefore = wetness[cell];

  const snowAfter =
    temperature < ICE_TEMPERATURE
      ? Math.fround(Math.min(1, snowBefore + step.iceGrowth))
      : Math.fround(Math.max(0, snowBefore - step.iceMelt * Math.max(1, temperature)));

  snow[cell] = snowAfter;
  wetness[cell] = 1;

  return snowAfter !== snowBefore || wetnessBefore !== 1;
}

function recoverFromFire(cell: number, fields: SurfaceFields, terrain: TerrainData, step: SurfaceStep): boolean {
  const { fire, fuel, scorch } = fields;

  if (fire[cell] > 0) {
    return false;
  }

  const groundFuel = GROUND_FUEL[terrain.ground[cell]];
  const fuelBefore = fuel[cell];

  if (fuelBefore < groundFuel) {
    const growthRate = terrain.baseTemperature[cell] + step.airTemperatureOffset > WARM_GROUND_TEMPERATURE ? 1 : 0.2;

    fuel[cell] = Math.min(groundFuel, fuelBefore + groundFuel * 0.35 * step.days * growthRate);
  }

  const scorchBefore = scorch[cell];

  if (scorchBefore <= 0) {
    return false;
  }

  const scorchAfter = Math.fround(Math.max(0, scorchBefore - step.scorchFading));

  scorch[cell] = scorchAfter;

  return scorchAfter !== scorchBefore;
}

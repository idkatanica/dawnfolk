import { describe, expect, it } from "vitest";
import { Ground, groundDefinition } from "../../content/grounds.ts";
import { SNOWFALL_TEMPERATURE } from "../../content/weather.ts";
import { DEFAULT_WORLD_RULES, type WorldRules, worldRulesSchema } from "../../content/world-rules.ts";
import { centerCell, createTestWorld, floodCells } from "../testing/test-world.ts";
import { TICK_SECONDS } from "../tick.ts";
import { SNOW_CAPACITY, type WorldState } from "../world/world-state.ts";
import { ROWS_PER_TICK, type SurfaceConditions, SurfaceSystem } from "./surface.ts";

const DRY_NOON: SurfaceConditions = { airTemperatureOffset: 0, isSnowfall: false, precipitation: 0, sunlight: 0.8 };

function runSurface(
  world: WorldState,
  seconds: number,
  conditions: SurfaceConditions,
  rules: WorldRules = DEFAULT_WORLD_RULES
): void {
  const surface = new SurfaceSystem(world);

  for (let elapsed = 0; elapsed < seconds; elapsed += TICK_SECONDS) {
    surface.update(TICK_SECONDS, TICK_SECONDS / 240, conditions, rules);
  }
}

interface ReferenceStep {
  conditions: SurfaceConditions;
  days: number;
  seconds: number;
}

function referenceCell(world: WorldState, cell: number, step: ReferenceStep): void {
  const { fields, terrain } = world;
  const { airTemperatureOffset, isSnowfall, precipitation, sunlight } = step.conditions;
  const { water } = DEFAULT_WORLD_RULES;

  const temperature = world.temperature(cell, airTemperatureOffset);
  const landsAsSnow = isSnowfall || temperature < SNOWFALL_TEMPERATURE;

  if (world.isWater(cell)) {
    fields.wetness[cell] = 1;
    fields.snow[cell] =
      temperature < -2
        ? Math.min(1, fields.snow[cell] + 0.002 * step.seconds)
        : Math.max(0, fields.snow[cell] - 0.004 * step.seconds * Math.max(1, temperature));
    fields.scorch[cell] = Math.max(0, fields.scorch[cell] - 0.22 * step.days);

    return;
  }

  if (precipitation > 0.02 && landsAsSnow) {
    const snowfall = precipitation * 0.012 * step.seconds * water.snowfall;

    fields.snow[cell] = Math.min(SNOW_CAPACITY, fields.snow[cell] + snowfall);
  }

  if (precipitation > 0.02 && !landsAsSnow) {
    const soaking = precipitation * 0.05 * step.seconds * water.rainStrength;

    fields.wetness[cell] = Math.min(1, fields.wetness[cell] + soaking);
  }

  if (fields.snow[cell] > 0 && temperature > 0) {
    const rainMelt = precipitation > 0.02 && !landsAsSnow ? 0.004 : 0;

    const melt = (temperature * 0.0035 + sunlight * 0.003 + rainMelt) * step.seconds * water.snowMelt;

    fields.snow[cell] = Math.max(0, fields.snow[cell] - melt);
    fields.wetness[cell] = Math.min(1, fields.wetness[cell] + 0.004 * step.seconds);
  }

  if (fields.wetness[cell] > 0 && precipitation < 0.02) {
    const evaporation = 0.0012 + Math.max(0, temperature) * 0.000_25 + sunlight * 0.001;

    fields.wetness[cell] = Math.max(0, fields.wetness[cell] - evaporation * step.seconds * water.drying);
  }

  if (terrain.ground[cell] === Ground.Snow) {
    fields.snow[cell] = Math.max(fields.snow[cell], 0.45);
  }

  if (fields.fire[cell] > 0) {
    return;
  }

  const { fuel } = groundDefinition(terrain.ground[cell]);

  const growthRate = temperature > 3 ? 1 : 0.2;

  if (fields.fuel[cell] < fuel) {
    fields.fuel[cell] = Math.min(fuel, fields.fuel[cell] + fuel * 0.35 * step.days * growthRate);
  }

  if (fields.scorch[cell] > 0) {
    fields.scorch[cell] = Math.max(0, fields.scorch[cell] - 0.22 * step.days * growthRate);
  }
}

function referenceTick(world: WorldState, tick: number, conditions: SurfaceConditions): void {
  const { cellsPerSide } = world.grid;

  const rowsPerPass = cellsPerSide / ROWS_PER_TICK;
  const firstRow = (tick * ROWS_PER_TICK) % cellsPerSide;
  const step = { conditions, days: (TICK_SECONDS / 240) * rowsPerPass, seconds: TICK_SECONDS * rowsPerPass };

  for (let cell = firstRow * cellsPerSide; cell < (firstRow + ROWS_PER_TICK) * cellsPerSide; cell += 1) {
    referenceCell(world, cell, step);
  }
}

function createVariedWorld(): WorldState {
  const world = createTestWorld({ dimensions: { cellSize: 10, cellsPerSide: 96 } });
  const { fields, grid, terrain } = world;

  for (let cell = 0; cell < grid.cellCount; cell += 1) {
    const column = grid.columnOf(cell);
    const row = grid.rowOf(cell);

    terrain.baseTemperature[cell] = 7 - row * 0.15;

    if (row >= 10 && row < 22 && column >= 20 && column < 70) {
      floodCells(world, [cell], 3);
    }

    if (row >= 40 && row < 44 && column >= 60 && column < 70) {
      world.setGround(cell, Ground.Snow);
    }

    if (row >= 50 && row < 60) {
      world.setGround(cell, Ground.Forest);
    }

    if (row === 66 && column < 12) {
      fields.fuel[cell] = 0;
      fields.scorch[cell] = 1;
    }

    if (row === 75) {
      fields.fuel[cell] = groundDefinition(terrain.ground[cell]).fuel - 0.005;
    }

    if (row === 30 && column % 7 === 3) {
      fields.snow[cell] = 0.3;
    }

    if (row >= 80 && row < 84 && column >= 10 && column < 20) {
      floodCells(world, [cell], 2);
      fields.snow[cell] = 0.99;
    }

    if (row === 70 && column % 23 === 5) {
      fields.wetness[cell] = 0.6;
      fields.snow[cell] = 0.3;
    }
  }

  fields.scorch[grid.index(30, 15)] = 0.5;

  return world;
}

function firstDifferentCell(values: Float32Array, expected: Float32Array): number {
  const bits = new Uint32Array(values.buffer);
  const expectedBits = new Uint32Array(expected.buffer);

  return bits.findIndex((value, cell) => value !== expectedBits[cell]);
}

const WEATHER_SCHEDULE: readonly { conditions: SurfaceConditions; ticks: number }[] = [
  { conditions: DRY_NOON, ticks: 40 },
  { conditions: { airTemperatureOffset: 0, isSnowfall: false, precipitation: 0.6, sunlight: 0.2 }, ticks: 30 },
  { conditions: DRY_NOON, ticks: 200 },
  { conditions: { airTemperatureOffset: -10, isSnowfall: true, precipitation: 0.5, sunlight: 0 }, ticks: 30 },
  { conditions: { airTemperatureOffset: 8, isSnowfall: false, precipitation: 0, sunlight: 1 }, ticks: 300 },
  { conditions: { airTemperatureOffset: -20, isSnowfall: false, precipitation: 0.02, sunlight: 0 }, ticks: 60 },
  { conditions: { airTemperatureOffset: 4, isSnowfall: false, precipitation: 0, sunlight: 0.5 }, ticks: 300 },
];

describe("surface", () => {
  it("visits every row once per pass", () => {
    const world = createTestWorld();

    const surface = new SurfaceSystem(world);
    const passTicks = world.grid.cellsPerSide / ROWS_PER_TICK;

    world.fields.wetness.fill(0.5);

    for (let tick = 0; tick < passTicks; tick += 1) {
      surface.update(TICK_SECONDS, 0, DRY_NOON, DEFAULT_WORLD_RULES);
    }

    expect(world.surfaceChanges.takeRuns()).toEqual([{ firstRow: 0, rowCount: world.grid.cellsPerSide }]);
  });

  it("marks only the rows whose cover changed", () => {
    const world = createTestWorld();

    const surface = new SurfaceSystem(world);
    const cell = centerCell(world);
    const passTicks = world.grid.cellsPerSide / ROWS_PER_TICK;

    world.fields.scorch[cell] = 0.5;

    for (let tick = 0; tick < passTicks; tick += 1) {
      surface.update(TICK_SECONDS, TICK_SECONDS / 240, DRY_NOON, DEFAULT_WORLD_RULES);
    }

    expect(world.surfaceChanges.takeRuns()).toEqual([{ firstRow: world.grid.rowOf(cell), rowCount: 1 }]);
  });

  it("skips settled stretches without changing what a cell-by-cell sweep would do", () => {
    const swept = createVariedWorld();
    const reference = createVariedWorld();

    const surface = new SurfaceSystem(swept);

    let tick = 0;

    for (const { conditions, ticks } of WEATHER_SCHEDULE) {
      for (let end = tick + ticks; tick < end; tick += 1) {
        surface.update(TICK_SECONDS, TICK_SECONDS / 240, conditions, DEFAULT_WORLD_RULES);
        referenceTick(reference, tick, conditions);

        for (const field of ["fuel", "scorch", "snow", "wetness"] as const) {
          expect(firstDifferentCell(swept.fields[field], reference.fields[field])).toBe(-1);
        }
      }
    }

    expect(swept.fields.snow.some((snow) => snow > 0)).toBe(true);
    expect(swept.fields.wetness.some((wetness) => wetness > 0 && wetness < 1)).toBe(true);
  });

  it("piles up snow below freezing", () => {
    const world = createTestWorld({ baseTemperature: -8 });

    runSurface(world, 60, { airTemperatureOffset: 0, isSnowfall: false, precipitation: 0.8, sunlight: 0 });

    expect(world.fields.snow[centerCell(world)]).toBeGreaterThan(0.3);
    expect(world.fields.wetness[centerCell(world)]).toBe(0);
  });

  it("piles up snow faster when the snowfall rule is raised", () => {
    const heavyRules = worldRulesSchema.parse({ water: { snowfall: 3 } });
    const normal = createTestWorld({ baseTemperature: -8 });
    const heavy = createTestWorld({ baseTemperature: -8 });
    const snowing = { airTemperatureOffset: 0, isSnowfall: false, precipitation: 0.5, sunlight: 0 };

    runSurface(normal, 20, snowing);
    runSurface(heavy, 20, snowing, heavyRules);

    expect(heavy.fields.snow[centerCell(heavy)]).toBeGreaterThan(normal.fields.snow[centerCell(normal)] * 2);
  });

  it("lays snow from snowy weather just above freezing, where rain only wets", () => {
    const snowy = createTestWorld({ baseTemperature: 2 });
    const rainy = createTestWorld({ baseTemperature: 2 });

    runSurface(snowy, 60, { airTemperatureOffset: 0, isSnowfall: true, precipitation: 0.8, sunlight: 0 });
    runSurface(rainy, 60, { airTemperatureOffset: 0, isSnowfall: false, precipitation: 0.8, sunlight: 0 });

    expect(snowy.fields.snow[centerCell(snowy)]).toBeGreaterThan(0.1);
    expect(rainy.fields.snow[centerCell(rainy)]).toBe(0);
    expect(rainy.fields.wetness[centerCell(rainy)]).toBeGreaterThan(0.8);
  });

  it("melts snow in warm sunshine and wets the ground", () => {
    const world = createTestWorld({ baseTemperature: 12 });

    world.fields.snow.fill(0.6);
    runSurface(world, 120, DRY_NOON);

    expect(world.fields.snow[centerCell(world)]).toBe(0);
  });

  it("soaks the ground in rain and dries it in the sun", () => {
    const world = createTestWorld();

    runSurface(world, 30, { airTemperatureOffset: 0, isSnowfall: false, precipitation: 0.8, sunlight: 0 });

    const wetness = world.fields.wetness[centerCell(world)];

    runSurface(world, 300, DRY_NOON);

    expect(wetness).toBeGreaterThan(0.8);
    expect(world.fields.wetness[centerCell(world)]).toBeLessThan(wetness / 2);
  });

  it("keeps eternal snow on glaciers", () => {
    const world = createTestWorld({ ground: Ground.Snow });

    runSurface(world, 10, DRY_NOON);

    expect(world.fields.snow[centerCell(world)]).toBeGreaterThan(0.4);
  });

  it("freezes lakes in hard frost", () => {
    const world = createTestWorld({ baseTemperature: -12 });

    const cell = centerCell(world);

    floodCells(world, [cell], 4);
    runSurface(world, 300, { airTemperatureOffset: 0, isSnowfall: false, precipitation: 0, sunlight: 0 });

    expect(world.fields.snow[cell]).toBeGreaterThan(0.5);
    expect(world.fields.wetness[cell]).toBe(1);
  });

  it("regrows grass and fades scorch after a fire", () => {
    const world = createTestWorld();

    const cell = centerCell(world);

    world.fields.fuel[cell] = 0;
    world.fields.scorch[cell] = 1;
    runSurface(world, 240, DRY_NOON);

    expect(world.fields.fuel[cell]).toBeGreaterThan(0.2);
    expect(world.fields.fuel[cell]).toBeLessThanOrEqual(groundDefinition(Ground.Meadow).fuel);
    expect(world.fields.scorch[cell]).toBeLessThan(1);
  });

  it("keeps the ash longer while the ground is cold", () => {
    const warm = createTestWorld();
    const cold = createTestWorld({ baseTemperature: -5 });

    for (const world of [warm, cold]) {
      world.fields.fuel[centerCell(world)] = 0;
      world.fields.scorch[centerCell(world)] = 1;
      runSurface(world, 480, DRY_NOON);
    }

    expect(warm.fields.scorch[centerCell(warm)]).toBeLessThan(0.65);
    expect(cold.fields.scorch[centerCell(cold)]).toBeGreaterThan(0.9);
  });
});

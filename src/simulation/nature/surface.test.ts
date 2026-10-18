import { describe, expect, it } from "vitest";
import { Ground, groundDefinition } from "../../content/grounds.ts";
import { DEFAULT_WORLD_RULES, type WorldRules, worldRulesSchema } from "../../content/world-rules.ts";
import { centerCell, createTestWorld, floodCells } from "../testing/test-world.ts";
import type { WorldState } from "../world/world-state.ts";
import { ROWS_PER_TICK, type SurfaceConditions, SurfaceSystem } from "./surface.ts";

const TICK_SECONDS = 0.1;
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

describe("surface", () => {
  it("visits every row once per pass", () => {
    const world = createTestWorld();

    const surface = new SurfaceSystem(world);
    const passTicks = world.grid.cellsPerSide / ROWS_PER_TICK;

    for (let tick = 0; tick < passTicks; tick += 1) {
      surface.update(TICK_SECONDS, 0, DRY_NOON, DEFAULT_WORLD_RULES);
    }

    expect(world.surfaceChanges.takeRuns()).toEqual([{ firstRow: 0, rowCount: world.grid.cellsPerSide }]);
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
});

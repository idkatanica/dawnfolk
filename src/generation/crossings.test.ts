import { beforeAll, describe, expect, it } from "vitest";
import { HOP_WIDTH, isBrookCell } from "../world/brooks.ts";
import { type Crossing, crossingLength, crossingPointOf, isOnCrossing } from "../world/crossings.ts";
import type { IslandShapeKind } from "../world/island-shape.ts";
import { isWaterCell } from "../world/terrain-sampling.ts";
import { createTerrainData } from "../world/testing/terrain-fixtures.ts";
import type { River } from "../world/water.ts";
import { NO_WATER } from "../world/water.ts";
import { WorldGrid } from "../world/world-grid.ts";
import { planCrossings, refreshCrossings } from "./crossings.ts";
import { DEFAULT_GENERATION_OPTIONS } from "./generation-options.ts";
import { computeHydrology } from "./hydrology.ts";
import { type GeneratedWorld, generateWorld } from "./world-generator.ts";

const LONG_WIDE_STRETCH = 1000;
const WATERFALL_CLEARANCE = 100;
const LAKE_CLEARANCE = 25;
const COAST_CLEARANCE = 45;
const ON_RIVER = 18;
const SPACING_ALONG = 500;
const WIDEST_GAP = 900;
const WIDTH_MARGIN = 0.4;

const worlds = new Map<IslandShapeKind, GeneratedWorld>();

function worldOf(shape: IslandShapeKind): GeneratedWorld {
  const generated = worlds.get(shape);

  if (generated === undefined) {
    throw new Error(`No ${shape} world was generated`);
  }

  return generated;
}

function middleOf(crossing: Crossing): { x: number; z: number } {
  return { x: (crossing.startX + crossing.endX) / 2, z: (crossing.startZ + crossing.endZ) / 2 };
}

function wideStretch(river: River): number {
  return river.points.slice(1).reduce((sum, point, index) => {
    const previous = river.points[index];

    return point.width > HOP_WIDTH ? sum + Math.hypot(point.x - previous.x, point.z - previous.z) : sum;
  }, 0);
}

function positionsAlong(river: River, crossings: readonly Crossing[]): number[] {
  const positions: number[] = [];

  for (const crossing of crossings) {
    const middle = middleOf(crossing);

    let travelled = 0;
    let nearest = { along: 0, distance: Number.POSITIVE_INFINITY };

    for (const [index, point] of river.points.entries()) {
      if (index > 0) {
        travelled += Math.hypot(point.x - river.points[index - 1].x, point.z - river.points[index - 1].z);
      }

      const distance = Math.hypot(point.x - middle.x, point.z - middle.z);

      if (distance < nearest.distance) {
        nearest = { along: travelled, distance };
      }
    }

    if (nearest.distance < ON_RIVER) {
      positions.push(nearest.along);
    }
  }

  return positions.sort((first, second) => first - second);
}

function samplesAlong(crossing: Crossing): { x: number; z: number }[] {
  const length = crossingLength(crossing);

  return Array.from({ length: Math.ceil(length) + 1 }, (_, step) => {
    const amount = Math.min(0.999, Math.max(0.001, step / length));

    return {
      x: crossing.startX + (crossing.endX - crossing.startX) * amount,
      z: crossing.startZ + (crossing.endZ - crossing.startZ) * amount,
    };
  });
}

beforeAll(() => {
  worlds.set("round", generateWorld(7));
  worlds.set("square", generateWorld(3, { ...DEFAULT_GENERATION_OPTIONS, shape: "square" }));
}, 120_000);

describe.each(["round", "square"] as const)("crossings on a %s island", (shape) => {
  it("give most rivers that run too wide to hop for a long way a ford or a fallen log", () => {
    const { crossings, water } = worldOf(shape);

    const longRivers = water.rivers.filter((river) => wideStretch(river) > LONG_WIDE_STRETCH);
    const crossed = longRivers.filter((river) => positionsAlong(river, crossings).length > 0);

    expect(longRivers.length).toBeGreaterThan(0);
    expect(crossed.length / longRivers.length).toBeGreaterThan(0.8);
    expect(crossings.some((crossing) => crossing.kind === "ford")).toBe(true);
    expect(crossings.some((crossing) => crossing.kind === "log")).toBe(true);
  });

  it("leave brooks to be hopped and treat only rivers no wider than a hop as brooks", () => {
    const { crossings, dimensions, terrain, water } = worldOf(shape);
    const grid = new WorldGrid(dimensions);

    const pondCells = new Set(water.springs.flatMap((spring) => spring.cells));
    const cellOf = (point: { x: number; z: number }) => grid.cellAt(point.x, point.z);
    const points = water.rivers.flatMap((river) => river.points).filter((point) => !pondCells.has(cellOf(point)));

    const narrow = points.filter(
      (point) => point.width <= HOP_WIDTH - WIDTH_MARGIN && isWaterCell(terrain, cellOf(point))
    );
    const wide = points.filter(
      (point) => point.width >= HOP_WIDTH + WIDTH_MARGIN && isWaterCell(terrain, cellOf(point))
    );

    expect(narrow.filter((point) => isBrookCell(terrain, cellOf(point))).length / narrow.length).toBeGreaterThan(0.9);
    expect(wide.some((point) => isBrookCell(terrain, cellOf(point)))).toBe(false);
    expect(crossings.some((crossing) => isBrookCell(terrain, cellOf(middleOf(crossing))))).toBe(false);
  });

  it("space them five to eight hundred metres apart along a river", () => {
    const { crossings, water } = worldOf(shape);

    const gaps = water.rivers.flatMap((river) => {
      const positions = positionsAlong(river, crossings);

      return positions.slice(1).map((position, index) => position - positions[index]);
    });

    const sorted = [...gaps].sort((first, second) => first - second);

    expect(sorted.length).toBeGreaterThan(0);
    expect(sorted[0]).toBeGreaterThan(SPACING_ALONG * 0.9);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeLessThan(WIDEST_GAP);
  });

  it("span river water between two dry, gentle banks", () => {
    const { crossings, dimensions, terrain } = worldOf(shape);
    const grid = new WorldGrid(dimensions);

    for (const crossing of crossings) {
      const cells = samplesAlong(crossing).map((point) => grid.cellAt(point.x, point.z));

      const wet = cells.filter((cell) => isWaterCell(terrain, cell));
      const ends = [grid.cellAt(crossing.startX, crossing.startZ), grid.cellAt(crossing.endX, crossing.endZ)];

      expect(wet.length, `crossing ${crossing.id}`).toBeGreaterThan(0);
      expect(
        wet.every((cell) => terrain.riverStrength[cell] > 0),
        `crossing ${crossing.id}`
      ).toBe(true);
      expect(
        ends.some((cell) => isWaterCell(terrain, cell)),
        `crossing ${crossing.id}`
      ).toBe(false);
    }
  });

  it("keep away from waterfalls, lakes and the coast", () => {
    const { crossings, dimensions, terrain, water } = worldOf(shape);
    const grid = new WorldGrid(dimensions);

    function isStillWater(cell: number): boolean {
      return isWaterCell(terrain, cell) && terrain.riverStrength[cell] === 0;
    }

    for (const crossing of crossings) {
      const middle = middleOf(crossing);

      for (const waterfall of water.waterfalls) {
        expect(Math.hypot(waterfall.x - middle.x, waterfall.z - middle.z)).toBeGreaterThan(WATERFALL_CLEARANCE);
      }

      expect(grid.cellsInRadius(middle.x, middle.z, LAKE_CLEARANCE).some(isStillWater), `crossing ${crossing.id}`).toBe(
        false
      );

      for (const point of samplesAlong(crossing)) {
        expect(terrain.coastDistance[grid.cellAt(point.x, point.z)]).toBeGreaterThan(COAST_CLEARANCE);
      }
    }
  });

  it("lay fallen logs over narrow water and stepping stones over wider, shallow water", () => {
    const { crossings, dimensions, terrain } = worldOf(shape);
    const grid = new WorldGrid(dimensions);

    for (const crossing of crossings) {
      const wetPoints = samplesAlong(crossing).filter((point) => isWaterCell(terrain, grid.cellAt(point.x, point.z)));

      const alongs = wetPoints.map((point) => crossingPointOf(crossing, point.x, point.z).along);
      const span = Math.max(...alongs) - Math.min(...alongs);

      const deepest = Math.max(
        ...wetPoints.map((point) => {
          const cell = grid.cellAt(point.x, point.z);

          return terrain.waterSurface[cell] - terrain.height[cell];
        })
      );

      if (crossing.kind === "log") {
        expect(span, `log ${crossing.id}`).toBeLessThan(23);
      } else {
        expect(deepest, `ford ${crossing.id}`).toBeLessThan(4.05);
      }
    }
  });

  it("can be walked along from end to end", () => {
    for (const crossing of worldOf(shape).crossings) {
      expect(samplesAlong(crossing).every((point) => isOnCrossing(crossing, point.x, point.z))).toBe(true);
    }
  });

  it("keep every crossing that still spans its river when the water is worked out again", { timeout: 60_000 }, () => {
    const generated = worldOf(shape);
    const grid = new WorldGrid(generated.dimensions);
    const terrain = { ...generated.terrain, height: Float32Array.from(generated.terrain.height) };

    const hydrology = computeHydrology(Float32Array.from(terrain.height), grid, terrain.dryness, terrain.coastDistance);

    const refreshed = refreshCrossings(
      { grid, isBlocked: () => false, lakeIds: hydrology.lakeIds, terrain, water: generated.water },
      generated.crossings
    );

    const kept = refreshed.filter((crossing) => generated.crossings.some((original) => original.id === crossing.id));

    expect(kept.length).toBeGreaterThan(generated.crossings.length * 0.9);
  });
});

describe("crossings on land a river cuts in two", () => {
  it("join the two sides even where the river is too short to space crossings along", () => {
    const dimensions = { cellSize: 10, cellsPerSide: 48 };
    const grid = new WorldGrid(dimensions);
    const terrain = createTerrainData(dimensions);

    terrain.waterSurface.fill(NO_WATER);
    terrain.height.fill(100);

    for (let cell = 0; cell < grid.cellCount; cell += 1) {
      if (Math.abs(grid.cellCenterX(cell)) < 10) {
        terrain.height[cell] = 99.4;
        terrain.waterSurface[cell] = 99.9;
        terrain.riverStrength[cell] = 120;
      }
    }

    const points = Array.from({ length: 21 }, (_, index) => ({
      depth: 0.5,
      flow: 1,
      surface: 99.9,
      width: 8,
      x: 0,
      z: -100 + index * 10,
    }));

    const crossings = planCrossings({
      grid,
      isBlocked: () => false,
      lakeIds: new Int32Array(grid.cellCount).fill(-1),
      terrain,
      water: { lakes: [], rivers: [{ id: 0, points, reachesEdge: false }], springs: [], waterfalls: [] },
    });

    expect(crossings).toHaveLength(1);
    expect(crossings.every((crossing) => Math.sign(crossing.startX) !== Math.sign(crossing.endX))).toBe(true);
  });
});

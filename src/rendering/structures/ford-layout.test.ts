import { describe, expect, it } from "vitest";
import { type Ford, STONE_RISE } from "../../world/crossings.ts";
import { NO_WATER } from "../../world/water.ts";
import {
  BAR_SHALLOWEST,
  type FordStone,
  type FordSurroundings,
  LARGEST_STEP_GAP,
  layFord,
  STONE_SINK,
  visibleWaterSpan,
} from "./ford-layout.ts";

const WATER_LEVEL = 100;
const RIVER_HALF_WIDTH = 12;
const VISIBLE_HALF_WIDTH = 13;
const BANK_HEIGHT = 100.6;

const FORD: Ford = { endX: 16, endZ: 0, id: 0, kind: "ford", seed: 0.37, startX: -16, startZ: 0 };

function riverDepth(x: number, deepest: number): number {
  const fromBank = RIVER_HALF_WIDTH - Math.abs(x);

  return Math.min(deepest, fromBank * 0.4);
}

function river(deepest: number): FordSurroundings {
  function heightAt(x: number) {
    return Math.abs(x) < RIVER_HALF_WIDTH ? WATER_LEVEL - riverDepth(x, deepest) : BANK_HEIGHT;
  }

  return {
    heightAt: (x) => {
      return heightAt(x);
    },
    shoreDepthAt: (x) => {
      return Math.abs(x) < VISIBLE_HALF_WIDTH ? WATER_LEVEL + 0.2 - heightAt(x) : -1;
    },
    waterLevelAt: (x) => {
      return Math.abs(x) < RIVER_HALF_WIDTH ? WATER_LEVEL : NO_WATER;
    },
    waterSurfaceAt: (x) => {
      return Math.abs(x) < VISIBLE_HALF_WIDTH ? WATER_LEVEL : NO_WATER;
    },
  };
}

function footpath(stones: readonly FordStone[]): FordStone[] {
  return stones
    .filter((stone) => {
      return stone.kind === "step" || stone.kind === "slab";
    })
    .sort((first, second) => {
      return first.along - second.along;
    });
}

function widestGap(stones: readonly FordStone[]): number {
  const sorted = [...stones].sort((first, second) => {
    return first.along - first.radius - (second.along - second.radius);
  });

  let reach = sorted[0].along - sorted[0].radius;
  let widest = 0;

  for (const stone of sorted) {
    widest = Math.max(widest, stone.along - stone.radius - reach);
    reach = Math.max(reach, stone.along + stone.radius);
  }

  return widest;
}

function averageRadius(stones: readonly FordStone[]): number {
  return (
    stones.reduce((sum, stone) => {
      return sum + stone.radius;
    }, 0) / stones.length
  );
}

describe("layFord", () => {
  it("lays stones from one bank to the other without a gap wider than a stride", () => {
    for (const deepest of [0.3, 1.2, 2.8]) {
      const surroundings = river(deepest);
      const span = visibleWaterSpan(FORD, surroundings);
      const stones = footpath(layFord(FORD, surroundings).stones);
      const [first] = stones;
      const last = stones.at(-1);

      if (span === null || first === undefined || last === undefined) {
        throw new Error(`no ford across a river ${deepest} m deep`);
      }

      expect(first.along - first.radius).toBeLessThanOrEqual(span.start);
      expect(last.along + last.radius).toBeGreaterThanOrEqual(span.end);
      expect(widestGap(stones), `deepest ${deepest}`).toBeLessThanOrEqual(LARGEST_STEP_GAP + 1e-9);
    }
  });

  it("sets larger stones near the banks than in midstream", () => {
    const stones = footpath(layFord(FORD, river(1.2)).stones);

    const nearBanks = stones.filter((stone) => {
      return Math.abs(stone.x) > RIVER_HALF_WIDTH - 2.5;
    });
    const midstream = stones.filter((stone) => {
      return Math.abs(stone.x) < 5;
    });

    expect(nearBanks.length).toBeGreaterThan(1);
    expect(midstream.length).toBeGreaterThan(3);
    expect(averageRadius(nearBanks)).toBeGreaterThan(averageRadius(midstream) * 1.4);
  });

  it("raises stepping stones out of the water and lays flat slabs at the edges", () => {
    const surroundings = river(1.2);
    const stones = footpath(layFord(FORD, surroundings).stones);

    const steps = stones.filter((stone) => {
      return stone.kind === "step";
    });
    const slabs = stones.filter((stone) => {
      return stone.kind === "slab";
    });

    expect(steps.length).toBeGreaterThan(10);
    expect(slabs.length).toBeGreaterThan(0);

    for (const step of steps) {
      expect(step.top).toBeGreaterThan(WATER_LEVEL + STONE_RISE / 3);
      expect(step.bottom).toBeLessThan(WATER_LEVEL - BAR_SHALLOWEST);
    }

    for (const slab of slabs) {
      const ground = surroundings.heightAt(slab.x, slab.z);

      expect(slab.top).toBeGreaterThan(Math.max(ground, WATER_LEVEL));
      expect(slab.top).toBeLessThan(Math.max(ground, WATER_LEVEL) + 0.2);
      expect(slab.bottom).toBeCloseTo(ground - STONE_SINK);
    }
  });

  it("keeps the gravel bar under the water and buries its edges in the ground", () => {
    const surroundings = river(2.8);
    const { bar } = layFord(FORD, surroundings);

    const points = bar.flat();
    const raised = points.filter((point) => {
      return point.grounding === 0;
    });

    expect(bar.length).toBeGreaterThan(20);
    expect(raised.length).toBeGreaterThan(bar.length);

    for (const point of raised) {
      expect(point.y).toBeLessThanOrEqual(WATER_LEVEL - BAR_SHALLOWEST + 1e-6);
      expect(point.y).toBeGreaterThanOrEqual(surroundings.heightAt(point.x, point.z));
    }

    for (const point of points.filter((candidate) => {
      return candidate.grounding === 1;
    })) {
      expect(point.y).toBeLessThan(surroundings.heightAt(point.x, point.z));
    }
  });

  it("scatters gravel only where the water is shallow", () => {
    const surroundings = river(2.8);
    const pebbles = layFord(FORD, surroundings).stones.filter((stone) => {
      return stone.kind === "pebble";
    });

    expect(pebbles.length).toBeGreaterThan(20);

    for (const pebble of pebbles) {
      expect(pebble.radius).toBeLessThan(0.2);
      expect(pebble.top).toBeGreaterThan(pebble.bottom);
    }
  });

  it("lays the same ford the same way every time and nothing where no water shows", () => {
    const surroundings = river(1.2);

    expect(layFord(FORD, surroundings)).toEqual(layFord(FORD, surroundings));
    expect(
      layFord(FORD, {
        ...surroundings,
        shoreDepthAt: () => {
          return -1;
        },
      })
    ).toEqual({ bar: [], stones: [] });
  });
});

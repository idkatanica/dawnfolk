import { describe, expect, it } from "vitest";
import {
  CrossingIndex,
  crossingCells,
  crossingLength,
  crossingPointOf,
  type Ford,
  fallenLog,
  footingOn,
  isOnCrossing,
  LOG_ROOT_BEHIND,
  LOG_TIP_BEYOND,
  type LogBridge,
  logDeckAt,
  logRadiusAt,
  STONE_RISE,
} from "./crossings.ts";
import { NO_WATER } from "./water.ts";
import { WorldGrid } from "./world-grid.ts";

const grid = new WorldGrid({ cellSize: 10, cellsPerSide: 32 });

const FORD: Ford = { endX: 30, endZ: 10, id: 0, kind: "ford", seed: 0.3, startX: -30, startZ: 10 };

const LOG: LogBridge = {
  endDeck: 102,
  endX: 0,
  endZ: 20,
  id: 1,
  kind: "log",
  seed: 0.2,
  startDeck: 101,
  startX: 0,
  startZ: -20,
};

describe("crossings", () => {
  it("measure points along and across their span", () => {
    expect(crossingLength(FORD)).toBeCloseTo(60);
    expect(crossingPointOf(FORD, 0, 12)).toEqual({ across: 2, along: 30 });
    expect(isOnCrossing(FORD, 0, 10.5)).toBe(true);
    expect(isOnCrossing(FORD, 0, 12)).toBe(false);
    expect(isOnCrossing(FORD, 31, 10)).toBe(false);
    expect(isOnCrossing(FORD, 31, 10, 1.5)).toBe(true);
  });

  it("set walkers on the stones just above the water and on the ground at the banks", () => {
    expect(footingOn(FORD, 0, 10, 97, 100)).toBeCloseTo(100 + STONE_RISE);
    expect(footingOn(FORD, -29, 10, 100.6, 100)).toBeCloseTo(100.6);
    expect(footingOn(FORD, -29, 10, 100.6, NO_WATER)).toBeCloseTo(100.6);
  });

  it("set walkers on top of a log from end to end, stepping up onto it from beside it", () => {
    expect(logDeckAt(LOG, 20)).toBeCloseTo(101.5);
    expect(footingOn(LOG, 0, 0, 96, NO_WATER)).toBeCloseTo(101.5);
    expect(footingOn(LOG, 0, -20, 100.4, NO_WATER)).toBeCloseTo(101);
    expect(footingOn(LOG, 0.85, -19, 100.4, NO_WATER)).toBeGreaterThan(100.4);
    expect(footingOn(LOG, 0.85, -19, 100.4, NO_WATER)).toBeLessThan(101);
    expect(footingOn(LOG, 1.5, -19, 100.4, NO_WATER)).toBeCloseTo(100.4);
    expect(footingOn(LOG, 0, -21, 100.4, NO_WATER)).toBeCloseTo(100.4);
  });

  it("lay a log from its root on one bank to its tip on the other, resting under its deck", () => {
    const log = fallenLog(LOG);

    expect(log.rootZ).toBeCloseTo(-20 - LOG_ROOT_BEHIND);
    expect(log.tipZ).toBeCloseTo(20 + LOG_TIP_BEYOND);
    expect(log.rootBottom + 2 * logRadiusAt(LOG, -LOG_ROOT_BEHIND)).toBeLessThan(LOG.startDeck);
    expect(log.rootBottom).toBeLessThan(log.tipBottom);
  });

  it("find the crossing under a point through the cells it covers", () => {
    const index = new CrossingIndex(grid, [FORD, LOG]);

    expect(index.crossingAt(0, 10)).toBe(FORD);
    expect(index.crossingAt(0, 15)).toBe(LOG);
    expect(index.crossingAt(-40, -40)).toBeNull();
    expect(crossingCells(grid, FORD)).toContain(grid.cellAt(-25, 10));
    expect(crossingCells(grid, FORD)).not.toContain(grid.cellAt(-25, 30));
  });
});

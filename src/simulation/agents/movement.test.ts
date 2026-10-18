import { describe, expect, it } from "vitest";
import { Ground } from "../../content/grounds.ts";
import { createTestWorld, floodCells } from "../testing/test-world.ts";
import type { WorldState } from "../world/world-state.ts";
import { createMover, hasArrived, type Mover, moveAlong, setDestination } from "./movement.ts";
import { NavigationGrid } from "./navigation.ts";

const STEP_SECONDS = 0.1;
const GORGE_DIMENSIONS = { cellSize: 10, cellsPerSide: 64 };
const GORGE_HALF_WIDTH = 10;
const GORGE_WATER_LEVEL = 102;

function walk(mover: Mover, world: WorldState, seconds: number, speed = 3): boolean {
  const navigation = new NavigationGrid(world);

  for (let elapsed = 0; elapsed < seconds; elapsed += STEP_SECONDS) {
    if (moveAlong(mover, STEP_SECONDS, speed, world, navigation)) {
      return true;
    }
  }

  return false;
}

describe("movement", () => {
  it("walks to the destination at its speed", () => {
    const world = createTestWorld();

    const mover = createMover(-100, 0, 0);

    setDestination(mover, { x: -40, z: 0 }, new NavigationGrid(world));

    expect(walk(mover, world, 10)).toBe(false);
    expect(mover.x).toBeGreaterThan(-75);
    expect(walk(mover, world, 15)).toBe(true);
    expect(hasArrived(mover)).toBe(true);
    expect(Math.hypot(mover.x + 40, mover.z)).toBeLessThan(2);
  });

  it("turns to face where it walks", () => {
    const world = createTestWorld();

    const mover = createMover(0, 0, 0);

    setDestination(mover, { x: 50, z: 0 }, new NavigationGrid(world));
    walk(mover, world, 3);

    expect(mover.heading).toBeCloseTo(Math.PI / 2, 1);
    expect(mover.velocityX).toBeGreaterThan(2);
  });

  it("walks slower through swamp", () => {
    const meadow = createTestWorld();
    const swamp = createTestWorld({ ground: Ground.Swamp });

    const onMeadow = createMover(-100, 0, 0);
    const inSwamp = createMover(-100, 0, 0);

    setDestination(onMeadow, { x: 100, z: 0 }, new NavigationGrid(meadow));
    setDestination(inSwamp, { x: 100, z: 0 }, new NavigationGrid(swamp));
    walk(onMeadow, meadow, 10);
    walk(inSwamp, swamp, 10);

    expect(inSwamp.x).toBeLessThan(onMeadow.x);
  });

  it("does not step into deep water", () => {
    const world = createTestWorld();

    const lake = world.grid.cellsInRadius(0, 0, 40);

    floodCells(world, lake, 3);

    const mover = createMover(-120, 0, 0);

    setDestination(mover, { x: 0, z: 0 }, new NavigationGrid(world), { mayPlanRoute: false });
    walk(mover, world, 30);

    expect(world.isWaterAt(mover.x, mover.z)).toBe(false);
  });

  it("wades through shallows when allowed", () => {
    const world = createTestWorld();

    const ford = world.grid.cellsInRadius(0, 0, 40);

    floodCells(world, ford, 0.6);

    const mover = createMover(-120, 0, 0);

    mover.canWade = true;
    setDestination(mover, { x: 0, z: 0 }, new NavigationGrid(world), { mayPlanRoute: false });

    expect(walk(mover, world, 80)).toBe(true);
  });

  it("slips between pools that touch at a corner", () => {
    const world = createTestWorld();

    floodCells(world, [world.grid.cellAt(5, 5), world.grid.cellAt(-5, -5)], 1.2);

    const mover = createMover(1.4, -0.1, 0);

    setDestination(mover, { x: -9, z: 30 }, new NavigationGrid(world), { mayPlanRoute: false });

    expect(walk(mover, world, 30)).toBe(true);
  });
});

describe("unreachable destinations", () => {
  it("gives up on a goal in deep water instead of trying forever", () => {
    const world = createTestWorld();

    floodCells(world, world.grid.cellsInRadius(0, 0, 12), 3);

    const mover = createMover(-60, 0, 0);

    mover.canWade = true;
    setDestination(mover, { x: 0, z: 0 }, new NavigationGrid(world), { mayPlanRoute: false });

    expect(walk(mover, world, 60, 5)).toBe(true);
    expect(world.isWaterAt(mover.x, mover.z)).toBe(false);
  });
});

describe("leaving water", () => {
  function createBowlLake(): WorldState {
    const world = createTestWorld({ heightAt: (x, z) => 98 + Math.hypot(x, z) * 0.05 });

    for (const cell of world.grid.cellsInRadius(0, 0, 70)) {
      world.terrain.waterSurface[cell] = 101;
    }

    return world;
  }

  function depthAt(world: WorldState, mover: Mover): number {
    const cell = world.grid.cellAt(mover.x, mover.z);

    if (!world.isWater(cell)) {
      return 0;
    }

    return world.waterDepth(cell);
  }

  it("never wades deeper than where it stands", () => {
    const world = createBowlLake();

    const mover = createMover(-50, 0, 0);
    const navigation = new NavigationGrid(world);

    const startingDepth = depthAt(world, mover);

    setDestination(mover, { x: 0, z: 0 }, navigation, { mayPlanRoute: false });

    let deepest = startingDepth;

    for (let elapsed = 0; elapsed < 30; elapsed += STEP_SECONDS) {
      moveAlong(mover, STEP_SECONDS, 3, world, navigation);
      deepest = Math.max(deepest, depthAt(world, mover));
    }

    expect(startingDepth).toBeGreaterThan(0.5);
    expect(deepest).toBe(startingDepth);
  });

  it("walks out of the water to dry land", () => {
    const world = createBowlLake();

    const mover = createMover(-50, 0, 0);

    setDestination(mover, { x: -150, z: 0 }, new NavigationGrid(world), { mayPlanRoute: false });

    expect(walk(mover, world, 60)).toBe(true);
    expect(depthAt(world, mover)).toBe(0);
  });

  function createGorge(): WorldState {
    const world = createTestWorld({
      dimensions: GORGE_DIMENSIONS,
      heightAt: (x, z) => {
        const sideways = Math.max(0, Math.abs(x) - GORGE_HALF_WIDTH);

        return 100 + sideways * (z > 0 ? 0.2 : 5);
      },
    });

    for (const cell of world.grid.cellsInRadius(0, 0, world.grid.worldSize)) {
      if (Math.abs(world.grid.cellCenterX(cell)) < GORGE_HALF_WIDTH) {
        world.terrain.waterSurface[cell] = GORGE_WATER_LEVEL;
      }
    }

    return world;
  }

  function secondsToLand(mover: Mover, world: WorldState, limit: number): number {
    const navigation = new NavigationGrid(world);

    let elapsed = 0;

    while (elapsed < limit && depthAt(world, mover) > 0) {
      moveAlong(mover, STEP_SECONDS, 3, world, navigation);
      elapsed += STEP_SECONDS;
    }

    return elapsed;
  }

  it("climbs out of a river between banks too steep to climb at the nearest gentle bank", () => {
    const world = createGorge();

    const mover = createMover(-5, -45, 0);

    setDestination(mover, { x: 60, z: -45 }, new NavigationGrid(world), { mayPlanRoute: false });

    expect(world.slope(world.grid.cellAt(mover.x, mover.z))).toBeGreaterThan(1.2);
    expect(secondsToLand(mover, world, 90)).toBeLessThan(60);
    expect(mover.z).toBeGreaterThan(0);
  });

  it("swims out of a flat-bottomed pond that rose around it after it stopped", () => {
    const world = createTestWorld();

    const mover = createMover(3, -2, 0);

    setDestination(mover, { x: 3, z: -2 }, new NavigationGrid(world));
    floodCells(world, world.grid.cellsInRadius(0, 0, 45), 1.6);

    expect(hasArrived(mover)).toBe(false);
    expect(walk(mover, world, 1)).toBe(false);
    expect(secondsToLand(mover, world, 90)).toBeLessThan(60);
  });
});

describe("routes", () => {
  function createLake(depth: number): WorldState {
    const world = createTestWorld({ dimensions: { cellSize: 10, cellsPerSide: 96 } });

    floodCells(world, world.grid.cellsInRadius(0, 0, 60), depth);

    return world;
  }

  it("never end in water the mover cannot stand in", () => {
    const world = createLake(3);
    const navigation = new NavigationGrid(world);

    for (const destination of [
      { x: 0, z: 0 },
      { x: 45, z: -20 },
      { x: -30, z: 30 },
    ]) {
      const mover = createMover(-300, 10, 0);

      mover.canWade = true;
      setDestination(mover, destination, navigation);

      expect(mover.path.every((waypoint) => world.isWalkableAt(waypoint.x, waypoint.z))).toBe(true);
      expect(world.isWalkableAt(mover.goalX, mover.goalZ)).toBe(true);
    }
  });

  it("may end in shallows that the mover can wade", () => {
    const world = createLake(0.6);

    const mover = createMover(-120, 0, 0);

    mover.canWade = true;
    setDestination(mover, { x: 10, z: 5 }, new NavigationGrid(world));

    expect(mover.path.at(-1)).toEqual({ x: 10, z: 5 });
  });
});

import { describe, expect, it } from "vitest";
import { Ground } from "../../content/grounds.ts";
import { createTestWorld, floodCells } from "../testing/test-world.ts";
import type { WorldState } from "../world/world-state.ts";
import { createMover, hasArrived, type Mover, moveAlong, setDestination } from "./movement.ts";
import { NavigationGrid } from "./navigation.ts";

const STEP_SECONDS = 0.1;

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

    setDestination(mover, { x: 0, z: 0 }, new NavigationGrid(world), false);
    walk(mover, world, 30);

    expect(world.isWaterAt(mover.x, mover.z)).toBe(false);
  });

  it("wades through shallows when allowed", () => {
    const world = createTestWorld();

    const ford = world.grid.cellsInRadius(0, 0, 40);

    floodCells(world, ford, 0.6);

    const mover = createMover(-120, 0, 0);

    mover.canWade = true;
    setDestination(mover, { x: 0, z: 0 }, new NavigationGrid(world), false);

    expect(walk(mover, world, 80)).toBe(true);
  });

  it("slips between pools that touch at a corner", () => {
    const world = createTestWorld();

    floodCells(world, [world.grid.cellAt(5, 5), world.grid.cellAt(-5, -5)], 1.2);

    const mover = createMover(1.4, -0.1, 0);

    setDestination(mover, { x: -9, z: 30 }, new NavigationGrid(world), false);

    expect(walk(mover, world, 30)).toBe(true);
  });
});

describe("unreachable destinations", () => {
  it("gives up on a goal in deep water instead of trying forever", () => {
    const world = createTestWorld();

    floodCells(world, world.grid.cellsInRadius(0, 0, 12), 3);

    const mover = createMover(-60, 0, 0);

    mover.canWade = true;
    setDestination(mover, { x: 0, z: 0 }, new NavigationGrid(world), false);

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

    setDestination(mover, { x: 0, z: 0 }, navigation, false);

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

    setDestination(mover, { x: -150, z: 0 }, new NavigationGrid(world), false);

    expect(walk(mover, world, 60)).toBe(true);
    expect(depthAt(world, mover)).toBe(0);
  });
});

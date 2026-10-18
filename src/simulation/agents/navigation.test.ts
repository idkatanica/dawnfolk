import { describe, expect, it } from "vitest";
import { createTestWorld, floodCells } from "../testing/test-world.ts";
import type { WorldState } from "../world/world-state.ts";
import { NavigationGrid, type Waypoint } from "./navigation.ts";

const RIVER_WORLD = { dimensions: { cellSize: 10, cellsPerSide: 96 } };

function worldWithRiver(gapFromZ: number | null): WorldState {
  const world = createTestWorld(RIVER_WORLD);

  const river = world.grid.cellsInRadius(0, 0, 2000).filter((cell) => {
    const x = world.grid.cellCenterX(cell);
    const z = world.grid.cellCenterZ(cell);

    if (Math.abs(x) > 15) {
      return false;
    }

    return gapFromZ === null || z < gapFromZ;
  });

  floodCells(world, river, 3);

  return world;
}

function expectPath(path: Waypoint[] | null): Waypoint[] {
  if (path === null) {
    throw new Error("Expected a path");
  }

  return path;
}

function touchesWater(world: WorldState, from: Waypoint, path: readonly Waypoint[]): boolean {
  let current = from;

  for (const waypoint of path) {
    for (let sample = 1; sample <= 20; sample += 1) {
      const amount = sample / 20;

      const x = current.x + (waypoint.x - current.x) * amount;
      const z = current.z + (waypoint.z - current.z) * amount;

      if (world.isWaterAt(x, z)) {
        return true;
      }
    }

    current = waypoint;
  }

  return false;
}

describe("navigation grid", () => {
  it("walks straight when nothing is in the way", () => {
    const navigation = new NavigationGrid(createTestWorld(RIVER_WORLD));

    expect(navigation.findPath({ x: -200, z: 0 }, { x: 200, z: 40 })).toEqual([{ x: 200, z: 40 }]);
  });

  it("goes around a river through the ford", () => {
    const world = worldWithRiver(250);
    const from = { x: -150, z: -100 };

    const navigation = new NavigationGrid(world);

    const path = expectPath(navigation.findPath(from, { x: 150, z: -100 }));

    expect(path.length).toBeGreaterThan(1);
    expect(touchesWater(world, from, path)).toBe(false);
  });

  it("gives up when the river cannot be crossed", () => {
    const navigation = new NavigationGrid(worldWithRiver(null));

    expect(navigation.findPath({ x: -150, z: -100 }, { x: 150, z: -100 })).toBeNull();
  });

  it("lands a destination in deep water on the nearest dry ground and leaves shallows to waders", () => {
    const world = createTestWorld(RIVER_WORLD);

    floodCells(world, world.grid.cellsInRadius(0, 0, 30), 3);
    floodCells(world, world.grid.cellsInRadius(200, 0, 20), 0.6);

    const navigation = new NavigationGrid(world);

    const landing = navigation.landingSpot({ x: 0, z: 0 }, 1.1);

    expect(world.isWalkableAt(landing.x, landing.z)).toBe(true);
    expect(Math.hypot(landing.x, landing.z)).toBeLessThan(40);
    expect(navigation.landingSpot({ x: 200, z: 0 }, 1.1)).toEqual({ x: 200, z: 0 });
  });

  it("leads out of water one cell at a time toward the nearest bank", () => {
    const world = createTestWorld(RIVER_WORLD);

    floodCells(world, world.grid.cellsInRadius(0, 0, 45), 1.6);

    const navigation = new NavigationGrid(world);

    const steps: Waypoint[] = [];

    for (let next = navigation.stepAshore(2, 1); next !== null; next = navigation.stepAshore(next.x, next.z)) {
      steps.push(next);
    }

    expect(steps.length).toBeGreaterThan(2);
    expect(steps.length).toBeLessThan(8);
    expect(steps.filter((step) => world.isWalkableAt(step.x, step.z))).toEqual([steps.at(-1)]);
    expect(navigation.stepAshore(-300, 0)).toBeNull();
  });

  it("rebuilds only after the land or water changed", () => {
    const world = createTestWorld(RIVER_WORLD);

    const navigation = new NavigationGrid(world);

    expect(navigation.rebuildIfChanged()).toBe(false);

    world.heightVersion += 1;

    expect(navigation.rebuildIfChanged()).toBe(true);
    expect(navigation.rebuildIfChanged()).toBe(false);
  });
});

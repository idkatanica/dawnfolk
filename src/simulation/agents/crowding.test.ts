import { describe, expect, it } from "vitest";
import { createTestWorld } from "../testing/test-world.ts";
import { keepApart } from "./crowding.ts";
import { createMover, type Mover, setDestination } from "./movement.ts";
import { NavigationGrid } from "./navigation.ts";

function walker(x: number, z: number, navigation: NavigationGrid): Mover {
  const mover = createMover(x, z, 0);

  setDestination(mover, { x: x + 60, z }, navigation);

  return mover;
}

function distanceBetween(first: Mover, second: Mover): number {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

describe("crowding", () => {
  it("pushes walkers that overlap apart", () => {
    const world = createTestWorld();
    const navigation = new NavigationGrid(world);

    const first = walker(-30, 0, navigation);
    const second = walker(-29.8, 0.1, navigation);

    for (let tick = 0; tick < 10; tick += 1) {
      keepApart([first, second], world, 0.1);
    }

    expect(distanceBetween(first, second)).toBeGreaterThan(first.radius + second.radius - 0.05);
  });

  it("moves a walker off someone standing still and leaves the one standing", () => {
    const world = createTestWorld();

    const standing = createMover(0, 0, 0);
    const passing = walker(0.2, 0, new NavigationGrid(world));

    for (let tick = 0; tick < 10; tick += 1) {
      keepApart([standing, passing], world, 0.1);
    }

    expect(standing.x).toBe(0);
    expect(standing.z).toBe(0);
    expect(distanceBetween(standing, passing)).toBeGreaterThan(standing.radius + passing.radius - 0.05);
  });

  it("lets a walker reach someone standing at its goal", () => {
    const world = createTestWorld();

    const standing = createMover(0, 0, 0);
    const arriving = createMover(0.3, 0, 0);

    setDestination(arriving, { x: 0, z: 0 }, new NavigationGrid(world));
    keepApart([standing, arriving], world, 0.1);

    expect(arriving.x).toBe(0.3);
  });
});

import { describe, expect, it } from "vitest";
import { createRandom } from "../../shared/random.ts";
import type { Spring } from "../../world/water.ts";
import { IdentifierSource } from "../identifiers.ts";
import { createTestWorld, floodCells } from "../testing/test-world.ts";
import type { WorldState } from "../world/world-state.ts";
import { DEEPEST_LEVELLING, groundUnderFootprint, levelPad, planPad } from "./building-pads.ts";
import { BuildingSystem } from "./buildings.ts";

const HUT_FOOTPRINT = 4.3;

function slopedWorld(slope: number): WorldState {
  return createTestWorld({ heightAt: (x) => 100 + x * slope });
}

function cornerHeights(world: WorldState, x: number, z: number, reach: number): number[] {
  return [
    [0, 0],
    [reach, reach],
    [reach, -reach],
    [-reach, reach],
    [-reach, -reach],
  ].map(([offsetX, offsetZ]) => world.heightAt(x + offsetX, z + offsetZ));
}

function spread(heights: readonly number[]): number {
  return Math.max(...heights) - Math.min(...heights);
}

describe("building pads", () => {
  it("levels the ground under a footprint on a gentle slope", () => {
    const world = slopedWorld(0.08);

    const pad = planPad(world, [], { x: 3, z: -2 }, "hut");

    if (pad === null) {
      throw new Error("Expected a pad on open ground");
    }

    expect(pad.unevenness).toBeLessThan(DEEPEST_LEVELLING);
    expect(spread(cornerHeights(world, 3, -2, HUT_FOOTPRINT))).toBeGreaterThan(0.5);

    const versionBefore = world.heightVersion;

    levelPad(world, pad);

    expect(spread(cornerHeights(world, 3, -2, HUT_FOOTPRINT))).toBeLessThan(0.05);
    expect(world.heightVersion).toBe(versionBefore + 1);
  });

  it("blends back to the untouched ground within one cell of the footprint", () => {
    const world = slopedWorld(0.08);
    const original = Float32Array.from(world.terrain.height);

    const pad = planPad(world, [], { x: 3, z: -2 }, "hut");

    if (pad === null) {
      throw new Error("Expected a pad on open ground");
    }

    levelPad(world, pad);

    const reach = HUT_FOOTPRINT + world.grid.cellSize;
    const changed = [...original.keys()].filter((cell) => original[cell] !== world.terrain.height[cell]);

    expect(changed.length).toBeGreaterThan(0);

    for (const cell of changed) {
      expect(Math.abs(world.grid.cellCenterX(cell) - 3)).toBeLessThan(reach);
      expect(Math.abs(world.grid.cellCenterZ(cell) + 2)).toBeLessThan(reach);
      expect(Math.abs(original[cell] - world.terrain.height[cell])).toBeLessThanOrEqual(DEEPEST_LEVELLING);
    }
  });

  it("never cuts or fills more than the deepest levelling on a steep slope", () => {
    const world = slopedWorld(0.4);
    const original = Float32Array.from(world.terrain.height);

    const pad = planPad(world, [], { x: 0, z: 0 }, "longhouse");

    if (pad === null) {
      throw new Error("Expected a pad on open ground");
    }

    expect(pad.unevenness).toBeGreaterThan(DEEPEST_LEVELLING);

    levelPad(world, pad);

    for (const [cell, height] of original.entries()) {
      expect(Math.abs(height - world.terrain.height[cell])).toBeLessThanOrEqual(DEEPEST_LEVELLING + 0.001);
    }
  });

  it("keeps clear of water", () => {
    const world = slopedWorld(0.05);

    const [cell] = groundUnderFootprint(world.grid, { x: 0, z: 0 }, HUT_FOOTPRINT);

    floodCells(world, [cell - 1], 0.5);

    expect(planPad(world, [], { x: 0, z: 0 }, "hut")).toBeNull();
  });

  it("keeps clear of the shore a pond shapes", () => {
    const world = slopedWorld(0.05);

    const pond: Spring = {
      cells: [],
      directionX: 1,
      directionZ: 0,
      kind: "pond",
      level: 100,
      radius: 15,
      river: 0,
      seed: 0.4,
      x: 45,
      z: 0,
    };

    expect(planPad(world, [], { x: 0, z: 0 }, "hut")).not.toBeNull();

    world.water = { ...world.water, springs: [pond] };

    expect(planPad(world, [], { x: 0, z: 0 }, "hut")).toBeNull();
    expect(planPad(world, [], { x: -45, z: 0 }, "hut")).not.toBeNull();
  });

  it("leaves the pad of a neighbouring building as it is", () => {
    const world = slopedWorld(0.08);
    const buildings = new BuildingSystem(world, new IdentifierSource());

    const neighbour = buildings.add({ kind: "hut", rotation: 0, tribeId: 1, x: 0, z: 0 }, createRandom(1));

    const firstPad = planPad(world, [], neighbour, "hut");

    if (firstPad === null) {
      throw new Error("Expected a pad on open ground");
    }

    levelPad(world, firstPad);

    const levelled = cornerHeights(world, 0, 0, HUT_FOOTPRINT);
    const pad = planPad(world, buildings.all, { x: 12, z: 0 }, "hut");

    if (pad === null) {
      throw new Error("Expected a pad on open ground");
    }

    levelPad(world, pad);

    expect(cornerHeights(world, 0, 0, HUT_FOOTPRINT)).toEqual(levelled);
  });
});

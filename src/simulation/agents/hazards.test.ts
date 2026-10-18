import { describe, expect, it } from "vitest";
import { FireSystem } from "../nature/fire.ts";
import { createTestWorld } from "../testing/test-world.ts";
import type { WorldState } from "../world/world-state.ts";
import { HazardMap } from "./hazards.ts";

function createHazards(world: WorldState): { fire: FireSystem; hazards: HazardMap } {
  const fire = new FireSystem(world);

  return { fire, hazards: new HazardMap(world, fire) };
}

describe("hazard map", () => {
  it("reports danger zones until they expire", () => {
    const { hazards } = createHazards(createTestWorld());

    hazards.addZone({ radius: 50, remainingSeconds: 2, x: 100, z: 0 });

    expect(hazards.dangerNear(120, 0, 10)).toEqual({ x: 100, z: 0 });

    hazards.update(3);

    expect(hazards.dangerNear(120, 0, 10)).toBeNull();
  });

  it("points at the middle of the fire nearby", () => {
    const world = createTestWorld();

    const { fire, hazards } = createHazards(world);

    expect(hazards.dangerNear(0, 0, 100)).toBeNull();

    for (const cell of world.grid.cellsInRadius(60, 0, 15)) {
      fire.ignite(cell, 0.5);
    }

    const danger = hazards.dangerNear(0, 0, 100);

    expect(danger?.x).toBeGreaterThan(30);
    expect(danger?.z).toBeGreaterThan(-15);
    expect(danger?.z).toBeLessThan(15);
    expect(hazards.dangerNear(-200, -200, 50)).toBeNull();
  });

  it("notices fire around a camp", () => {
    const world = createTestWorld({ dimensions: { cellSize: 10, cellsPerSide: 96 } });

    const { hazards } = createHazards(world);

    expect(hazards.isFireAround(0, 0)).toBe(false);

    for (const cell of world.grid.cellsInRadius(150, 0, 60)) {
      world.fields.fire[cell] = 0.6;
    }

    expect(hazards.isFireAround(0, 0)).toBe(true);
  });
});

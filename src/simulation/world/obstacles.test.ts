import { describe, expect, it } from "vitest";
import { PlantSpecies, type PlantSpeciesIndex } from "../../content/plants.ts";
import { createTestWorld } from "../testing/test-world.ts";
import type { WorldState } from "./world-state.ts";

function plantAt(world: WorldState, species: PlantSpeciesIndex, x: number): number {
  return world.plant({ bornDay: 0, height: 12, rotation: 0, seed: 0.5, species, x, z: 0 });
}

describe("obstacles", () => {
  it("are the trees and rocks that stand, not bushes or felled trees", () => {
    const world = createTestWorld();

    plantAt(world, PlantSpecies.Oak, 0);
    plantAt(world, PlantSpecies.Boulder, 6);
    plantAt(world, PlantSpecies.Bush, 12);
    world.vegetation.fell(plantAt(world, PlantSpecies.Birch, -6), 0, 0);

    const positions = world.obstacles.near(0, 0, 20).map((obstacle) => {
      return obstacle.x;
    });

    expect(
      positions.sort((first, second) => {
        return first - second;
      })
    ).toEqual([0, 6]);
  });

  it("include a building until it is cleared", () => {
    const world = createTestWorld();

    world.obstacles.placeBuilding(7, { radius: 4, x: 30, z: 0 });

    expect(world.obstacles.near(24, 0, 3)).toEqual([{ radius: 4, x: 30, z: 0 }]);

    world.obstacles.clearBuilding(7);

    expect(world.obstacles.near(24, 0, 3)).toEqual([]);
  });
});

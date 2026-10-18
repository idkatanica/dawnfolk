import { describe, expect, it } from "vitest";
import { Ground, groundDefinition } from "../../content/grounds.ts";
import { PlantSpecies, plantSpeciesDefinition } from "../../content/plants.ts";
import { centerCell, createTestWorld, floodCells, plantInCell } from "../testing/test-world.ts";

describe("world state", () => {
  it("interpolates heights between cell centers", () => {
    const world = createTestWorld({ heightAt: (x) => 100 + x });

    expect(world.heightAt(5, 0)).toBeCloseTo(105);
    expect(world.heightAt(10, 0)).toBeCloseTo(110);
  });

  it("measures slope as rise over run", () => {
    const world = createTestWorld({ heightAt: (x) => 100 + 0.5 * x });

    expect(world.slope(centerCell(world))).toBeCloseTo(0.5);
  });

  it("knows where the water is and how deep it is", () => {
    const world = createTestWorld();

    const cell = centerCell(world);

    floodCells(world, [cell], 3);

    expect(world.isWater(cell)).toBe(true);
    expect(world.waterDepth(cell)).toBeCloseTo(3);
    expect(world.surfaceAt(5, 5)).toBeCloseTo(103);
    expect(world.isWalkable(cell)).toBe(false);
  });

  it("plants nothing within a few metres of the coast", () => {
    const world = createTestWorld();

    const cell = centerCell(world);
    const x = world.grid.cellCenterX(cell);
    const z = world.grid.cellCenterZ(cell);
    const placement = { bornDay: 0, height: 8, rotation: 0, seed: 0.5, species: 0, x, z };

    expect(world.plant(placement)).toBeGreaterThanOrEqual(0);

    world.terrain.coastDistance.fill(3);

    expect(world.plant(placement)).toBe(-1);
  });

  it("keeps everything beyond the coast off the island", () => {
    const world = createTestWorld();

    const cell = centerCell(world);

    expect(world.isOnIsland(cell)).toBe(true);
    expect(world.isWalkable(cell)).toBe(true);

    world.terrain.coastDistance[cell] = -5;

    expect(world.isOnIsland(cell)).toBe(false);
    expect(world.isWalkable(cell)).toBe(false);
  });

  it("cools raised land by the lapse rate", () => {
    const world = createTestWorld();

    const cell = centerCell(world);

    world.setHeight(cell, 1100);

    expect(world.terrain.baseTemperature[cell]).toBeCloseTo(15 - 6.5);
  });

  it("resets ground fuel when the ground changes", () => {
    const world = createTestWorld();

    const cell = centerCell(world);

    world.setGround(cell, Ground.Steppe);

    expect(world.fields.fuel[cell]).toBeCloseTo(groundDefinition(Ground.Steppe).fuel);
    expect(world.groundChanges.hasChanges).toBe(true);
  });

  it("tracks canopy fuel as trees are planted and removed", () => {
    const world = createTestWorld();

    const cell = centerCell(world);

    const tree = plantInCell(world, cell, PlantSpecies.Oak);

    expect(world.canopyFuel[cell]).toBeCloseTo(plantSpeciesDefinition(PlantSpecies.Oak).canopyFuel);

    world.removePlant(tree);

    expect(world.canopyFuel[cell]).toBe(0);
    expect(world.initialCanopyFuel[cell]).toBe(0);
  });

  it("keeps the starting canopy fuel while a cell burns", () => {
    const world = createTestWorld();

    const cell = centerCell(world);

    const tree = plantInCell(world, cell, PlantSpecies.Spruce);

    world.fields.fire[cell] = 0.5;
    world.removePlant(tree);

    expect(world.initialCanopyFuel[cell]).toBeCloseTo(plantSpeciesDefinition(PlantSpecies.Spruce).canopyFuel);
  });
});

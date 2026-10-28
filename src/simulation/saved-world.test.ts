import { describe, expect, it } from "vitest";
import { PlantState } from "../world/vegetation-store.ts";
import {
  PLANT_SPECIES_NAMES,
  restoreSavedWorld,
  SAVE_VERSION,
  type SavedWorldState,
  savedWorldStateSchema,
  summarizeWorld,
} from "./saved-world.ts";
import type { Simulation } from "./simulation.ts";
import { GENERATION_OPTIONS, GENERATION_SEED, generateSimulation, snapshotOf } from "./testing/test-simulation.ts";

function savedState(simulation: Simulation): SavedWorldState {
  return {
    plantSpecies: PLANT_SPECIES_NAMES,
    request: { options: GENERATION_OPTIONS, seed: GENERATION_SEED },
    simulation: snapshotOf(simulation),
    summary: summarizeWorld(simulation),
    version: SAVE_VERSION,
  };
}

describe("saved worlds", () => {
  it("finds each plant species by name when the list order changes", () => {
    const original = generateSimulation();
    const state = savedState(original);
    const savedNames = [...PLANT_SPECIES_NAMES].reverse();
    const { species } = state.simulation.world.vegetation;
    const lastIndex = PLANT_SPECIES_NAMES.length - 1;

    for (let plant = 0; plant < species.length; plant += 1) {
      species[plant] = lastIndex - species[plant];
    }

    const loaded = generateSimulation();

    restoreSavedWorld(loaded, { ...state, plantSpecies: savedNames });

    expect(loaded.world.vegetation.species).toEqual(original.world.vegetation.species);
  });

  it("removes plants whose species no longer exists", () => {
    const original = generateSimulation();
    const state = savedState(original);
    const plant = 0;

    expect(original.world.vegetation.state[plant]).toBe(PlantState.Alive);

    state.simulation.world.vegetation.species[plant] = PLANT_SPECIES_NAMES.length;

    const loaded = generateSimulation();

    restoreSavedWorld(loaded, { ...state, plantSpecies: [...PLANT_SPECIES_NAMES, "Retired"] });

    expect(loaded.world.vegetation.state[plant]).toBe(PlantState.Removed);
    expect(loaded.world.vegetation.aliveCount).toBe(original.world.vegetation.aliveCount - 1);
  });

  it("reads saves made before plant species were named", () => {
    const state = savedState(generateSimulation());
    const { plantSpecies: _, ...unnamed } = state;

    const result = savedWorldStateSchema.parse(unnamed);

    expect(result.plantSpecies).toContain("Slab");
    expect(result.plantSpecies).toHaveLength(32);
  });
});

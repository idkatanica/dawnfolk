import { describe, expect, it } from "vitest";
import { DEFAULT_GENERATION_OPTIONS, type GenerationOptions } from "../generation/generation-options.ts";
import { PlantState } from "../world/vegetation-store.ts";
import {
  PLANT_SPECIES_NAMES,
  restoreSavedWorld,
  SAVE_VERSION,
  type SavedWorldState,
  savedWorldStateSchema,
  summarizeWorld,
} from "./saved-world.ts";
import { Simulation } from "./simulation.ts";

const GENERATION_SEED = 11;
const GENERATION_OPTIONS: GenerationOptions = {
  ...DEFAULT_GENERATION_OPTIONS,
  dimensions: { cellSize: 20, cellsPerSide: 128 },
};

function generateSimulation(): Simulation {
  return Simulation.generate(GENERATION_SEED, GENERATION_OPTIONS, () => undefined);
}

function savedState(simulation: Simulation): SavedWorldState {
  const snapshot = simulation.snapshot();

  if (snapshot === null) {
    throw new Error("The simulation was busy");
  }

  return {
    plantSpecies: PLANT_SPECIES_NAMES,
    request: { options: GENERATION_OPTIONS, seed: GENERATION_SEED },
    simulation: snapshot,
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

import { describe, expect, it } from "vitest";
import { ignore } from "../shared/ignore.ts";
import { PlantState } from "../world/vegetation-store.ts";
import {
  hasLandChanged,
  PLANT_SPECIES_NAMES,
  restoreSavedWorld,
  SAVE_VERSION,
  type SavedWorldState,
  savedWorldStateSchema,
  summarizeWorld,
} from "./saved-world.ts";
import { Simulation } from "./simulation.ts";
import { GENERATION_OPTIONS, GENERATION_SEED, generateSimulation, snapshotOf } from "./testing/test-simulation.ts";

function savedState(simulation: Simulation): SavedWorldState {
  return {
    generationFingerprint: simulation.world.generationFingerprint,
    plantSpecies: PLANT_SPECIES_NAMES,
    request: { options: GENERATION_OPTIONS, seed: GENERATION_SEED },
    simulation: snapshotOf(simulation),
    summary: summarizeWorld(simulation),
    version: SAVE_VERSION,
  };
}

function loadedFrom(state: SavedWorldState, generated: Simulation): boolean {
  restoreSavedWorld(generated, state);

  return hasLandChanged(generated, state);
}

function otherIsland(): Simulation {
  return Simulation.generate(GENERATION_SEED + 1, GENERATION_OPTIONS, ignore);
}

describe("generation fingerprints", () => {
  it("gives the same island the same fingerprint and another island a different one", () => {
    const fingerprint = generateSimulation().world.generationFingerprint;

    expect(generateSimulation().world.generationFingerprint).toBe(fingerprint);
    expect(otherIsland().world.generationFingerprint).not.toBe(fingerprint);
  });

  it("keeps the fingerprint of the generated land after the land changes", () => {
    const simulation = generateSimulation();
    const fingerprint = simulation.world.generationFingerprint;

    simulation.world.setHeight(0, 900);

    expect(savedState(simulation).generationFingerprint).toBe(fingerprint);
  });
});

describe("loading a world whose land grows differently now", () => {
  it("loads a save of the same generation without a warning", () => {
    expect(loadedFrom(savedState(generateSimulation()), generateSimulation())).toBe(false);
  });

  it("warns when the saved fingerprint differs from the regenerated island", () => {
    const original = generateSimulation();
    const state = savedState(original);

    const changed = { ...state, generationFingerprint: original.world.generationFingerprint + 1 };

    expect(loadedFrom(changed, generateSimulation())).toBe(true);
  });

  it("reads saves made before fingerprints and loads them without a warning when the rivers still fit", () => {
    const { generationFingerprint: _, ...older } = savedState(generateSimulation());

    const state = savedWorldStateSchema.parse(older);

    expect(state.generationFingerprint).toBeNull();
    expect(loadedFrom(state, generateSimulation())).toBe(false);
  });

  it("warns about a save without a fingerprint when its rivers run over dry land", () => {
    const state = { ...savedState(generateSimulation()), generationFingerprint: null };

    expect(state.simulation.world.water.rivers.length).toBeGreaterThan(0);
    expect(loadedFrom(state, otherIsland())).toBe(true);
  });
});

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

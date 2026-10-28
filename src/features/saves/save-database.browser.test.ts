import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_WORLD_REQUEST } from "../../generation/generation-options.ts";
import { SAVE_VERSION, type SavedWorldState } from "../../simulation/saved-world.ts";
import { Simulation } from "../../simulation/simulation.ts";
import { createVegetatedWorld } from "../../simulation/testing/test-world.ts";
import { createSimulationWorkerApi } from "../../workers/simulation-worker-api.ts";
import {
  deleteSavedWorld,
  listSavedWorlds,
  readSavedWorld,
  type SavedWorldRecord,
  writeSavedWorld,
} from "./save-database.ts";

const TEST_WORLD = { dimensions: { cellSize: 10, cellsPerSide: 64 } };

function savedState(): SavedWorldState {
  const api = createSimulationWorkerApi(() => new Simulation(createVegetatedWorld(TEST_WORLD)));

  api.createWorld(DEFAULT_WORLD_REQUEST, () => undefined);
  api.advance(0.5, [{ parameters: {}, powerId: "tribe", type: "usePower", x: 0, z: 0 }]);

  const state = api.saveWorld();

  if (state === null) {
    throw new Error("The test world was busy");
  }

  return state;
}

function recordFor(id: string, state: SavedWorldState, changes: Partial<SavedWorldRecord> = {}): SavedWorldRecord {
  return {
    id,
    name: "Old Ford",
    savedAt: Date.now(),
    seed: state.request.seed,
    shape: state.request.options.shape,
    summary: state.summary,
    version: SAVE_VERSION,
    ...changes,
  };
}

afterEach(async () => {
  const worlds = await listSavedWorlds();

  await Promise.all(worlds.map((world) => deleteSavedWorld(world.id)));
});

describe("saved worlds", () => {
  it("saves, lists and reads back a world", async () => {
    const state = savedState();

    expect(await writeSavedWorld(recordFor("first", state), state, [])).toBe(true);

    const [listed] = await listSavedWorlds();

    expect(listed).toMatchObject({ id: "first", isLoadable: true, name: "Old Ford" });

    const stored = await readSavedWorld("first");

    expect(stored?.record.name).toBe("Old Ford");
    expect(stored?.state.simulation.tick).toBe(state.simulation.tick);
    expect(stored?.state.simulation.world.fields.snow).toBeInstanceOf(Float32Array);
  });

  it("lists the most recent save first", async () => {
    const state = savedState();

    await writeSavedWorld(recordFor("older", state, { savedAt: 1000 }), state, []);
    await writeSavedWorld(recordFor("newer", state, { savedAt: 2000 }), state, []);

    expect((await listSavedWorlds()).map((world) => world.id)).toEqual(["newer", "older"]);
  });

  it("deletes a world with its state", async () => {
    const state = savedState();

    await writeSavedWorld(recordFor("gone", state), state, []);

    expect(await deleteSavedWorld("gone")).toBe(true);
    expect(await listSavedWorlds()).toEqual([]);
    expect(await readSavedWorld("gone")).toBeNull();
  });

  it("lists a save from another version without loading it", async () => {
    const state = savedState();

    await writeSavedWorld(recordFor("old", state, { version: SAVE_VERSION + 1 }), state, []);

    const [listed] = await listSavedWorlds();

    expect(listed).toMatchObject({ id: "old", isLoadable: false });
    expect(await readSavedWorld("old")).toBeNull();
  });

  it("loads a saved world back into a simulation", async () => {
    const state = savedState();

    await writeSavedWorld(recordFor("again", state), state, []);

    const stored = await readSavedWorld("again");

    if (stored === null) {
      throw new Error("The world was not stored");
    }

    const api = createSimulationWorkerApi(
      () => new Simulation(createVegetatedWorld(TEST_WORLD)),
      () => new Simulation(createVegetatedWorld(TEST_WORLD))
    );

    const world = api.loadWorld(stored.state, () => undefined);

    expect(world.frame.tick).toBe(state.simulation.tick);
    expect(world.frame.personCount).toBe(state.simulation.society.people.length);
    expect(world.frame.personCount).toBeGreaterThan(0);
  });
});

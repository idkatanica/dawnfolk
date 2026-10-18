import { describe, expect, it } from "vitest";
import { PlantSpecies } from "../content/plants.ts";
import { PlantState, VegetationStore } from "./vegetation-store.ts";
import { WorldGrid } from "./world-grid.ts";

function createStoreWithOak(): { oak: number; store: VegetationStore } {
  const store = new VegetationStore(new WorldGrid({ cellSize: 10, cellsPerSide: 8 }), 16);

  const oak = store.add({ bornDay: 0, height: 14, rotation: 0, seed: 0.5, species: PlantSpecies.Oak, x: 3, z: 3 });

  return { oak, store };
}

describe("burnt plants", () => {
  it("expire after a fire partway through a day", () => {
    const { oak, store } = createStoreWithOak();

    store.burn(oak, 10.3);

    expect(store.takeBurntBefore(10.2)).toEqual([]);
    expect(store.takeBurntBefore(14.3)).toEqual([oak]);
  });

  it("forget snags that were cleared before they expired", () => {
    const { oak, store } = createStoreWithOak();

    store.burn(oak, 2.7);
    store.remove(oak);

    expect(store.state[oak]).toBe(PlantState.Removed);
    expect(store.takeBurntBefore(9)).toEqual([]);
  });
});

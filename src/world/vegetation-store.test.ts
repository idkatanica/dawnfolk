import { describe, expect, it } from "vitest";
import { PlantSpecies } from "../content/plants.ts";
import { PlantState, VegetationStore } from "./vegetation-store.ts";
import { WorldGrid } from "./world-grid.ts";

function plantAt(store: VegetationStore, species: number, x: number): number {
  return store.add({ bornDay: 0, height: 2, rotation: 0, seed: 0.5, species, x, z: 3 });
}

function scannedBerryBushes(store: VegetationStore): number[] {
  const bushes: number[] = [];

  for (let index = 0; index < store.count; index += 1) {
    if (store.isAlive(index) && store.species[index] === PlantSpecies.Bush) {
      bushes.push(index);
    }
  }

  return bushes;
}

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

describe("berry bushes", () => {
  it("change their fruit in index order while plants grow, burn and are cleared", () => {
    const store = new VegetationStore(new WorldGrid({ cellSize: 10, cellsPerSide: 64 }), 4000);

    const plants = Array.from({ length: 3000 }, (_, plant) =>
      plantAt(store, plant % 3 === 0 ? PlantSpecies.Oak : PlantSpecies.Bush, (plant % 600) - 300)
    );

    for (const [position, plant] of plants.entries()) {
      if (position % 7 === 1) {
        store.burn(plant, 2);
      }

      if (position % 5 === 2) {
        store.remove(plant);
      }
    }

    for (let plant = 0; plant < 400; plant += 1) {
      plantAt(store, plant % 2 === 0 ? PlantSpecies.Bush : PlantSpecies.Pine, plant - 200);
    }

    const bushes = scannedBerryBushes(store);

    store.discardChanges();
    store.changeBerryFruit(-0.25);

    expect(store.takeChanges().map((change) => change.index)).toEqual(bushes);
    expect(bushes.every((bush) => store.fruit[bush] === 0.75)).toBe(true);
    expect(bushes.length).toBeGreaterThan(1024);
  });

  it("still change after fruit was picked, burnt or cleared", () => {
    const store = new VegetationStore(new WorldGrid({ cellSize: 10, cellsPerSide: 8 }), 16);

    const picked = plantAt(store, PlantSpecies.Bush, 3);
    const burnt = plantAt(store, PlantSpecies.Bush, 13);
    const cleared = plantAt(store, PlantSpecies.Bush, 23);

    store.setFruit(picked, 0.5);
    store.changeBerryFruit(0.25);

    expect(store.fruit[picked]).toBe(0.75);

    store.burn(burnt, 1);
    store.changeBerryFruit(0.125);

    expect(store.fruit[picked]).toBe(0.875);

    store.changeBerryFruit(-1);
    store.setFruit(cleared, 1);
    store.remove(cleared);
    store.changeBerryFruit(0.5);
    store.changeBerryFruit(0.25);

    expect(store.fruit[picked]).toBe(0.75);

    store.changeBerryFruit(-0.25);
    store.changeBerryFruit(-0.25);

    expect(store.fruit[picked]).toBe(0.25);
  });
});

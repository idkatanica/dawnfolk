import { isTreeSpecies, plantSpeciesDefinition } from "../content/plants.ts";
import { saturate } from "../shared/math.ts";
import type { WorldGrid } from "./world-grid.ts";

export const PlantState = {
  Alive: 0,
  Burnt: 1,
  Removed: 2,
} as const;

export interface PlantPlacement {
  bornDay: number;
  height: number;
  rotation: number;
  seed: number;
  species: number;
  x: number;
  z: number;
}

export interface VegetationBuffers {
  bornDay: Float32Array;
  count: number;
  fruit: Float32Array;
  height: Float32Array;
  rotation: Float32Array;
  seed: Float32Array;
  species: Uint8Array;
  state: Uint8Array;
  x: Float32Array;
  z: Float32Array;
}

interface BurntPlant {
  day: number;
  index: number;
}

export interface PlantChange {
  bornDay: number;
  fruit: number;
  height: number;
  index: number;
  rotation: number;
  seed: number;
  species: number;
  state: number;
  x: number;
  z: number;
}

export const NO_PLANT = -1;
const FRUIT_LEVELS = 4;
const BURNT_QUEUE_COMPACTION = 1024;
const INITIAL_BERRY_BUSH_CAPACITY = 1024;

export class VegetationStore {
  readonly #burntDay: Float32Array;
  readonly #burntQueue: BurntPlant[] = [];
  readonly #capacity: number;
  readonly #changed = new Set<number>();
  readonly #firstInCell: Int32Array;
  readonly #freeSlots: number[] = [];
  readonly #grid: WorldGrid;
  readonly #nextInCell: Int32Array;
  readonly bornDay: Float32Array;
  readonly cell: Int32Array;
  readonly fruit: Float32Array;
  readonly height: Float32Array;
  readonly rotation: Float32Array;
  readonly seed: Float32Array;
  readonly species: Uint8Array;
  readonly state: Uint8Array;
  readonly x: Float32Array;
  readonly z: Float32Array;
  #aliveCount = 0;
  #berryBushCount = 0;
  #berryBushes = new Int32Array(INITIAL_BERRY_BUSH_CAPACITY);
  #burntQueueStart = 0;
  #count = 0;
  #emptyBerryBushCount = 0;
  #fullBerryBushCount = 0;

  constructor(grid: WorldGrid, capacity: number) {
    this.#grid = grid;
    this.#capacity = capacity;
    this.x = new Float32Array(capacity);
    this.z = new Float32Array(capacity);
    this.rotation = new Float32Array(capacity);
    this.height = new Float32Array(capacity);
    this.seed = new Float32Array(capacity);
    this.bornDay = new Float32Array(capacity);
    this.#burntDay = new Float32Array(capacity);
    this.fruit = new Float32Array(capacity);
    this.species = new Uint8Array(capacity);
    this.state = new Uint8Array(capacity).fill(PlantState.Removed);
    this.cell = new Int32Array(capacity).fill(NO_PLANT);
    this.#nextInCell = new Int32Array(capacity).fill(NO_PLANT);
    this.#firstInCell = new Int32Array(grid.cellCount).fill(NO_PLANT);
  }

  get count(): number {
    return this.#count;
  }

  get aliveCount(): number {
    return this.#aliveCount;
  }

  add(placement: PlantPlacement): number {
    const index = this.#allocate();

    if (index === NO_PLANT) {
      return NO_PLANT;
    }

    this.x[index] = placement.x;
    this.z[index] = placement.z;
    this.rotation[index] = placement.rotation;
    this.height[index] = placement.height;
    this.seed[index] = placement.seed;
    this.bornDay[index] = placement.bornDay;
    this.species[index] = placement.species;
    this.state[index] = PlantState.Alive;
    this.fruit[index] = this.#initialFruit(placement.species);
    this.#linkToCell(index, this.#grid.cellAt(placement.x, placement.z));
    this.#aliveCount += 1;
    this.#changed.add(index);
    this.#trackBerryBush(index);

    return index;
  }

  remove(index: number): void {
    if (this.state[index] === PlantState.Removed) {
      return;
    }

    if (this.state[index] === PlantState.Alive) {
      this.#aliveCount -= 1;
      this.#untrackBerryBush(index);
    }

    this.#unlinkFromCell(index);
    this.state[index] = PlantState.Removed;
    this.height[index] = 0;
    this.fruit[index] = 0;
    this.#freeSlots.push(index);
    this.#changed.add(index);
  }

  burn(index: number, day: number): void {
    if (this.state[index] !== PlantState.Alive) {
      return;
    }

    this.#untrackBerryBush(index);
    this.state[index] = PlantState.Burnt;
    this.#burntDay[index] = day;
    this.#burntQueue.push({ day: this.#burntDay[index], index });
    this.fruit[index] = 0;
    this.#aliveCount -= 1;
    this.#changed.add(index);
  }

  setFruit(index: number, fruit: number): void {
    if (this.state[index] !== PlantState.Alive) {
      return;
    }

    const isVisibleChange = Math.round(this.fruit[index] * FRUIT_LEVELS) !== Math.round(fruit * FRUIT_LEVELS);
    const isBerryBush = this.#givesBerries(index);

    if (isBerryBush) {
      this.#countFruit(index, -1);
    }

    this.fruit[index] = fruit;

    if (isBerryBush) {
      this.#countFruit(index, 1);
    }

    if (isVisibleChange) {
      this.#changed.add(index);
    }
  }

  changeBerryFruit(change: number): void {
    if (!this.#canBerriesChange(change)) {
      return;
    }

    for (let position = 0; position < this.#berryBushCount; position += 1) {
      const bush = this.#berryBushes[position];

      this.setFruit(bush, saturate(this.fruit[bush] + change));
    }
  }

  takeBurntBefore(day: number): number[] {
    const expired: number[] = [];

    while (this.#burntQueueStart < this.#burntQueue.length) {
      const oldest = this.#burntQueue[this.#burntQueueStart];

      if (oldest.day >= day) {
        break;
      }

      this.#burntQueueStart += 1;

      if (this.state[oldest.index] === PlantState.Burnt && this.#burntDay[oldest.index] === oldest.day) {
        expired.push(oldest.index);
      }
    }

    this.#compactBurntQueue();

    return expired;
  }

  #compactBurntQueue(): void {
    if (this.#burntQueueStart < BURNT_QUEUE_COMPACTION || this.#burntQueueStart * 2 < this.#burntQueue.length) {
      return;
    }

    this.#burntQueue.splice(0, this.#burntQueueStart);
    this.#burntQueueStart = 0;
  }

  isAlive(index: number): boolean {
    return this.state[index] === PlantState.Alive;
  }

  firstPlantInCell(cellIndex: number): number {
    return this.#firstInCell[cellIndex];
  }

  nextPlantInCell(index: number): number {
    return this.#nextInCell[index];
  }

  hasPlantsInCell(cellIndex: number): boolean {
    return this.#firstInCell[cellIndex] !== NO_PLANT;
  }

  canopyFuelInCell(cellIndex: number): number {
    let fuel = 0;

    for (let index = this.#firstInCell[cellIndex]; index !== NO_PLANT; index = this.#nextInCell[index]) {
      if (this.state[index] === PlantState.Alive) {
        fuel += plantSpeciesDefinition(this.species[index]).canopyFuel;
      }
    }

    return fuel;
  }

  burnTreesInCell(cellIndex: number, day: number): number {
    let burnt = 0;

    for (let index = this.#firstInCell[cellIndex]; index !== NO_PLANT; index = this.#nextInCell[index]) {
      if (this.state[index] === PlantState.Alive && plantSpeciesDefinition(this.species[index]).canopyFuel > 0) {
        this.burn(index, day);
        burnt += 1;
      }
    }

    return burnt;
  }

  clearCell(cellIndex: number, includesStones: boolean): void {
    for (const index of this.#plantsInCell(cellIndex)) {
      const { form } = plantSpeciesDefinition(this.species[index]);

      if (form !== "monument" && (includesStones || form !== "stone")) {
        this.remove(index);
      }
    }
  }

  countTreesInCell(cellIndex: number): number {
    let trees = 0;

    for (let index = this.#firstInCell[cellIndex]; index !== NO_PLANT; index = this.#nextInCell[index]) {
      if (this.state[index] === PlantState.Alive && isTreeSpecies(this.species[index])) {
        trees += 1;
      }
    }

    return trees;
  }

  takeChanges(): PlantChange[] {
    const changes: PlantChange[] = [];

    for (const index of this.#changed) {
      changes.push({
        bornDay: this.bornDay[index],
        fruit: this.fruit[index],
        height: this.height[index],
        index,
        rotation: this.rotation[index],
        seed: this.seed[index],
        species: this.species[index],
        state: this.state[index],
        x: this.x[index],
        z: this.z[index],
      });
    }

    this.#changed.clear();

    return changes;
  }

  discardChanges(): void {
    this.#changed.clear();
  }

  exportBuffers(): VegetationBuffers {
    const count = this.#count;

    return {
      bornDay: this.bornDay.slice(0, count),
      count,
      fruit: this.fruit.slice(0, count),
      height: this.height.slice(0, count),
      rotation: this.rotation.slice(0, count),
      seed: this.seed.slice(0, count),
      species: this.species.slice(0, count),
      state: this.state.slice(0, count),
      x: this.x.slice(0, count),
      z: this.z.slice(0, count),
    };
  }

  #allocate(): number {
    const reused = this.#freeSlots.pop();

    if (reused !== undefined) {
      return reused;
    }

    if (this.#count >= this.#capacity) {
      return NO_PLANT;
    }

    const index = this.#count;

    this.#count += 1;

    return index;
  }

  #plantsInCell(cellIndex: number): number[] {
    const plants: number[] = [];

    for (let index = this.#firstInCell[cellIndex]; index !== NO_PLANT; index = this.#nextInCell[index]) {
      plants.push(index);
    }

    return plants;
  }

  #canBerriesChange(change: number): boolean {
    if (change > 0) {
      return this.#fullBerryBushCount < this.#berryBushCount;
    }

    if (change < 0) {
      return this.#emptyBerryBushCount < this.#berryBushCount;
    }

    return false;
  }

  #givesBerries(index: number): boolean {
    return plantSpeciesDefinition(this.species[index]).givesBerries;
  }

  #trackBerryBush(index: number): void {
    if (!this.#givesBerries(index)) {
      return;
    }

    if (this.#berryBushCount === this.#berryBushes.length) {
      const grown = new Int32Array(this.#berryBushes.length * 2);

      grown.set(this.#berryBushes);
      this.#berryBushes = grown;
    }

    const position = this.#berryBushPosition(index);

    this.#berryBushes.copyWithin(position + 1, position, this.#berryBushCount);
    this.#berryBushes[position] = index;
    this.#berryBushCount += 1;
    this.#countFruit(index, 1);
  }

  #untrackBerryBush(index: number): void {
    if (!this.#givesBerries(index)) {
      return;
    }

    const position = this.#berryBushPosition(index);

    this.#berryBushes.copyWithin(position, position + 1, this.#berryBushCount);
    this.#berryBushCount -= 1;
    this.#countFruit(index, -1);
  }

  #berryBushPosition(index: number): number {
    let low = 0;
    let high = this.#berryBushCount;

    while (low < high) {
      const middle = Math.floor((low + high) / 2);

      if (this.#berryBushes[middle] < index) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    return low;
  }

  #countFruit(index: number, direction: number): void {
    const fruit = this.fruit[index];

    if (fruit === 1) {
      this.#fullBerryBushCount += direction;
    }

    if (fruit === 0) {
      this.#emptyBerryBushCount += direction;
    }
  }

  #initialFruit(species: number): number {
    if (plantSpeciesDefinition(species).givesBerries) {
      return 1;
    }

    return 0;
  }

  #linkToCell(index: number, cellIndex: number): void {
    this.cell[index] = cellIndex;

    if (cellIndex === NO_PLANT) {
      return;
    }

    this.#nextInCell[index] = this.#firstInCell[cellIndex];
    this.#firstInCell[cellIndex] = index;
  }

  #unlinkFromCell(index: number): void {
    const cellIndex = this.cell[index];

    if (cellIndex === NO_PLANT) {
      return;
    }

    let previous = NO_PLANT;
    let current = this.#firstInCell[cellIndex];

    while (current !== NO_PLANT && current !== index) {
      previous = current;
      current = this.#nextInCell[current];
    }

    if (current === index) {
      this.#relink(previous, cellIndex, this.#nextInCell[index]);
    }

    this.cell[index] = NO_PLANT;
    this.#nextInCell[index] = NO_PLANT;
  }

  #relink(previous: number, cellIndex: number, following: number): void {
    if (previous === NO_PLANT) {
      this.#firstInCell[cellIndex] = following;

      return;
    }

    this.#nextInCell[previous] = following;
  }
}

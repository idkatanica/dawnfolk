import { Box3, Vector3 } from "three/webgpu";
import { PLANT_SPECIES, type PlantSpeciesIndex } from "../../content/plants.ts";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { canonicalHeight, PLANT_VARIANT_COUNT } from "../../models/plants/plant-models.ts";
import type { CellRegion } from "../../world/change-tracking.ts";
import { PlantState } from "../../world/vegetation-store.ts";

export const CHUNK_CELLS = 16;
export const FLOATS_PER_PLANT = 8;
export const BUCKET_COUNT = PLANT_SPECIES.length * PLANT_VARIANT_COUNT;

const NO_CHUNK = -1;
const EMPTY_BUCKET = new Float32Array(0);
const corner = new Vector3();

export interface VegetationChunk {
  readonly bounds: Box3;
  buckets: Float32Array[];
  readonly firstColumn: number;
  readonly firstRow: number;
  isDirty: boolean;
  readonly plants: Set<number>;
}

export function bucketOf(species: number, variant: number): number {
  return species * PLANT_VARIANT_COUNT + variant;
}

export function speciesOfBucket(bucket: number): PlantSpeciesIndex {
  const { index } = PLANT_SPECIES[Math.floor(bucket / PLANT_VARIANT_COUNT)];

  return index;
}

export function variantOfBucket(bucket: number): number {
  return bucket % PLANT_VARIANT_COUNT;
}

function allocateBucket(count: number): Float32Array {
  if (count === 0) {
    return EMPTY_BUCKET;
  }

  return new Float32Array(count * FLOATS_PER_PLANT);
}

function variantOf(seed: number): number {
  return Math.min(PLANT_VARIANT_COUNT - 1, Math.floor(seed * PLANT_VARIANT_COUNT));
}

export class VegetationChunks {
  readonly chunks: VegetationChunk[] = [];
  readonly chunksPerSide: number;
  readonly #mirror: WorldMirror;
  #chunkOfPlant = new Int32Array(0);

  constructor(mirror: WorldMirror) {
    this.#mirror = mirror;
    this.chunksPerSide = Math.ceil(mirror.grid.cellsPerSide / CHUNK_CELLS);

    for (let row = 0; row < this.chunksPerSide; row += 1) {
      for (let column = 0; column < this.chunksPerSide; column += 1) {
        this.chunks.push({
          bounds: new Box3(),
          buckets: [],
          firstColumn: column * CHUNK_CELLS,
          firstRow: row * CHUNK_CELLS,
          isDirty: true,
          plants: new Set(),
        });
      }
    }

    const { count } = mirror.vegetation;

    for (let plant = 0; plant < count; plant += 1) {
      this.#place(plant);
    }
  }

  plantsChanged(indices: readonly number[]): void {
    for (const plant of indices) {
      this.#place(plant);
    }
  }

  heightsChanged(region: CellRegion): void {
    const firstChunkColumn = Math.floor(region.firstColumn / CHUNK_CELLS);
    const lastChunkColumn = Math.floor(region.lastColumn / CHUNK_CELLS);
    const firstChunkRow = Math.floor(region.firstRow / CHUNK_CELLS);
    const lastChunkRow = Math.floor(region.lastRow / CHUNK_CELLS);

    for (let row = firstChunkRow; row <= lastChunkRow; row += 1) {
      for (let column = firstChunkColumn; column <= lastChunkColumn; column += 1) {
        this.chunks[row * this.chunksPerSide + column].isDirty = true;
      }
    }
  }

  repackDirty(): number[] {
    const repacked: number[] = [];

    for (const [index, chunk] of this.chunks.entries()) {
      if (chunk.isDirty) {
        this.#repack(chunk);
        repacked.push(index);
      }
    }

    return repacked;
  }

  #place(plant: number): void {
    this.#ensureCapacity(plant + 1);

    const previous = this.#chunkOfPlant[plant];
    const next = this.#chunkFor(plant);

    if (previous !== NO_CHUNK) {
      this.chunks[previous].plants.delete(plant);
      this.chunks[previous].isDirty = true;
    }

    this.#chunkOfPlant[plant] = next;

    if (next !== NO_CHUNK) {
      this.chunks[next].plants.add(plant);
      this.chunks[next].isDirty = true;
    }
  }

  #chunkFor(plant: number): number {
    const { grid, vegetation } = this.#mirror;

    if (vegetation.state[plant] === PlantState.Removed) {
      return NO_CHUNK;
    }

    const cell = grid.cellAt(vegetation.x[plant], vegetation.z[plant]);

    if (cell === -1) {
      return NO_CHUNK;
    }

    const chunkColumn = Math.floor(grid.columnOf(cell) / CHUNK_CELLS);
    const chunkRow = Math.floor(grid.rowOf(cell) / CHUNK_CELLS);

    return chunkRow * this.chunksPerSide + chunkColumn;
  }

  #ensureCapacity(size: number): void {
    if (size <= this.#chunkOfPlant.length) {
      return;
    }

    const grown = new Int32Array(Math.max(size, Math.ceil(this.#chunkOfPlant.length * 1.5))).fill(NO_CHUNK);

    grown.set(this.#chunkOfPlant);
    this.#chunkOfPlant = grown;
  }

  #repack(chunk: VegetationChunk): void {
    const { vegetation } = this.#mirror;
    const counts = new Array<number>(BUCKET_COUNT).fill(0);

    for (const plant of chunk.plants) {
      counts[bucketOf(vegetation.species[plant], variantOf(vegetation.seed[plant]))] += 1;
    }

    const buckets = counts.map((count) => allocateBucket(count));
    const filled = new Array<number>(BUCKET_COUNT).fill(0);

    chunk.bounds.makeEmpty();

    for (const plant of chunk.plants) {
      const bucket = bucketOf(vegetation.species[plant], variantOf(vegetation.seed[plant]));

      const offset = filled[bucket] * FLOATS_PER_PLANT;

      this.#writePlant(plant, buckets[bucket], offset, chunk.bounds);
      filled[bucket] += 1;
    }

    chunk.buckets = buckets;
    chunk.isDirty = false;
  }

  #writePlant(plant: number, target: Float32Array, offset: number, bounds: Box3): void {
    const { vegetation } = this.#mirror;

    const x = vegetation.x[plant];
    const z = vegetation.z[plant];

    const y = this.#mirror.heightAt(x, z);
    const species = vegetation.species[plant];
    const height = vegetation.height[plant];
    const seed = vegetation.seed[plant];

    target[offset] = x;
    target[offset + 1] = y - 0.15;
    target[offset + 2] = z;
    target[offset + 3] = vegetation.rotation[plant];
    target[offset + 4] = height / canonicalHeight(PLANT_SPECIES[species].index);
    target[offset + 5] = (seed * 7.31) % 1;
    target[offset + 6] = vegetation.state[plant];
    target[offset + 7] = vegetation.fruit[plant];

    bounds.expandByPoint(corner.set(x - height * 0.5, y - 1, z - height * 0.5));
    bounds.expandByPoint(corner.set(x + height * 0.5, y + height, z + height * 0.5));
  }
}

import { Box3, Vector3 } from "three/webgpu";
import { isMonumentSpecies, PLANT_SPECIES, type PlantSpeciesIndex } from "../../content/plants.ts";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { canonicalHeight, farVariantOf, footprintRadius, plantVariantCount } from "../../models/plants/plant-models.ts";
import { isDistantLevel, type PlantDetailLevel } from "../../models/plants/tree-mesher.ts";
import { grownIndexArray } from "../../shared/growth.ts";
import type { CellRegion } from "../../world/change-tracking.ts";
import { PlantState } from "../../world/vegetation-store.ts";

export const CHUNK_CELLS = 16;
export const FLOATS_PER_PLANT = 8;
export const PLANT_SINKING = 0.15;

interface PlantBucket {
  readonly species: PlantSpeciesIndex;
  readonly variant: number;
}

export const PLANT_BUCKETS: readonly PlantBucket[] = PLANT_SPECIES.flatMap((definition) =>
  Array.from({ length: plantVariantCount(definition.index) }, (_, variant) => ({ species: definition.index, variant }))
);

export const BUCKET_COUNT = PLANT_BUCKETS.length;

const FIRST_BUCKETS: readonly number[] = PLANT_SPECIES.map((definition) =>
  PLANT_BUCKETS.findIndex((bucket) => bucket.species === definition.index)
);

const NO_CHUNK = -1;
const NO_BUCKET = -1;
const EMPTY_BUCKET = new Float32Array(0);
const corner = new Vector3();

export interface VegetationChunk {
  readonly bounds: Box3;
  buckets: Float32Array[];
  changedBuckets: number[];
  isDirty: boolean;
  readonly plants: Set<number>;
}

function bucketOf(species: number, seed: number): number {
  const count = plantVariantCount(PLANT_SPECIES[species].index);

  return FIRST_BUCKETS[species] + Math.min(count - 1, Math.floor(seed * count));
}

export function bucketGroups(level: PlantDetailLevel): number[][] {
  if (!isDistantLevel(level)) {
    return PLANT_BUCKETS.map((_bucket, index) => [index]);
  }

  const groups = new Map<string, number[]>();

  for (const [index, { species, variant }] of PLANT_BUCKETS.entries()) {
    const key = `${species}:${farVariantOf(species, variant)}`;
    const group = groups.get(key);

    if (group === undefined) {
      groups.set(key, [index]);

      continue;
    }

    group.push(index);
  }

  return [...groups.values()];
}

function allocateBucket(count: number): Float32Array {
  if (count === 0) {
    return EMPTY_BUCKET;
  }

  return new Float32Array(count * FLOATS_PER_PLANT);
}

export class VegetationChunks {
  readonly chunks: VegetationChunk[] = [];
  readonly chunksPerSide: number;
  readonly #footprints: readonly number[] = PLANT_SPECIES.map((species) => footprintRadius(species.index));
  readonly #mirror: WorldMirror;
  readonly #touchedBuckets: Set<number>[] = [];
  #bucketOfPlant = new Int32Array(0);
  #chunkOfPlant = new Int32Array(0);

  constructor(mirror: WorldMirror) {
    this.#mirror = mirror;
    this.chunksPerSide = Math.ceil(mirror.grid.cellsPerSide / CHUNK_CELLS);

    for (let chunk = 0; chunk < this.chunksPerSide * this.chunksPerSide; chunk += 1) {
      this.chunks.push({ bounds: new Box3(), buckets: [], changedBuckets: [], isDirty: true, plants: new Set() });
      this.#touchedBuckets.push(new Set());
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
        this.#touchAll(row * this.chunksPerSide + column);
      }
    }
  }

  repackDirty(): number[] {
    const repacked: number[] = [];

    for (const [index, chunk] of this.chunks.entries()) {
      if (chunk.isDirty) {
        this.#repack(chunk, this.#touchedBuckets[index]);
        repacked.push(index);
      }
    }

    return repacked;
  }

  #place(plant: number): void {
    const { vegetation } = this.#mirror;

    this.#chunkOfPlant = grownIndexArray(this.#chunkOfPlant, plant + 1, NO_CHUNK);
    this.#bucketOfPlant = grownIndexArray(this.#bucketOfPlant, plant + 1, NO_BUCKET);

    const previous = this.#chunkOfPlant[plant];
    const next = this.#chunkFor(plant);

    if (previous !== NO_CHUNK) {
      this.chunks[previous].plants.delete(plant);
      this.#touch(previous, this.#bucketOfPlant[plant]);
    }

    this.#chunkOfPlant[plant] = next;
    this.#bucketOfPlant[plant] = bucketOf(vegetation.species[plant], vegetation.seed[plant]);

    if (next !== NO_CHUNK) {
      this.chunks[next].plants.add(plant);
      this.#touch(next, this.#bucketOfPlant[plant]);
    }
  }

  #touch(chunk: number, bucket: number): void {
    this.chunks[chunk].isDirty = true;
    this.#touchedBuckets[chunk].add(bucket);
  }

  #touchAll(chunk: number): void {
    for (let bucket = 0; bucket < BUCKET_COUNT; bucket += 1) {
      this.#touch(chunk, bucket);
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

  #repack(chunk: VegetationChunk, touched: Set<number>): void {
    const { vegetation } = this.#mirror;

    const counts = new Array<number>(BUCKET_COUNT).fill(0);

    for (const plant of chunk.plants) {
      counts[bucketOf(vegetation.species[plant], vegetation.seed[plant])] += 1;
    }

    const buckets = counts.map((count) => allocateBucket(count));
    const filled = new Array<number>(BUCKET_COUNT).fill(0);

    chunk.bounds.makeEmpty();

    for (const plant of chunk.plants) {
      const bucket = bucketOf(vegetation.species[plant], vegetation.seed[plant]);
      const offset = filled[bucket] * FLOATS_PER_PLANT;

      this.#writePlant(plant, buckets[bucket], offset, chunk.bounds);
      filled[bucket] += 1;
    }

    chunk.buckets = buckets;
    chunk.changedBuckets = [...touched];
    chunk.isDirty = false;
    touched.clear();
  }

  #writePlant(plant: number, target: Float32Array, offset: number, bounds: Box3): void {
    const { vegetation } = this.#mirror;

    const x = vegetation.x[plant];
    const z = vegetation.z[plant];
    const species = vegetation.species[plant];
    const height = vegetation.height[plant];
    const seed = vegetation.seed[plant];
    const scale = height / canonicalHeight(PLANT_SPECIES[species].index);
    const footprint = this.#footprints[species] * scale;
    const y = isMonumentSpecies(species) ? this.#groundAround(x, z, footprint) : this.#groundUnder(x, z, footprint);

    target[offset] = x;
    target[offset + 1] = y - PLANT_SINKING;
    target[offset + 2] = z;
    target[offset + 3] = vegetation.rotation[plant];
    target[offset + 4] = scale;
    target[offset + 5] = (seed * 7.31) % 1;
    target[offset + 6] = vegetation.state[plant];
    target[offset + 7] = vegetation.fruit[plant];

    const reach = vegetation.state[plant] === PlantState.Fallen ? height : height * 0.5;

    bounds.expandByPoint(corner.set(x - reach, y - 1, z - reach));
    bounds.expandByPoint(corner.set(x + reach, y + height, z + reach));
  }

  #groundAround(x: number, z: number, radius: number): number {
    const mirror = this.#mirror;

    const around =
      mirror.heightAt(x + radius, z) +
      mirror.heightAt(x - radius, z) +
      mirror.heightAt(x, z + radius) +
      mirror.heightAt(x, z - radius);

    return Math.min(mirror.heightAt(x, z), around / 4);
  }

  #groundUnder(x: number, z: number, radius: number): number {
    const mirror = this.#mirror;

    return Math.min(
      mirror.heightAt(x, z),
      mirror.heightAt(x + radius, z),
      mirror.heightAt(x - radius, z),
      mirror.heightAt(x, z + radius),
      mirror.heightAt(x, z - radius)
    );
  }
}

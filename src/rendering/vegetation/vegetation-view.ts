import {
  type DirectionalLight,
  type Frustum,
  Group,
  type InstancedBufferGeometry,
  type MeshStandardNodeMaterial,
  type PerspectiveCamera,
} from "three/webgpu";
import { PLANT_SPECIES } from "../../content/plants.ts";
import type { WorldMirror } from "../../game/world-mirror.ts";
import type { VertexChannel } from "../../models/mesh/mesh-data.ts";
import { buildPlantVariant, PLANT_DETAIL_LEVELS } from "../../models/plants/plant-models.ts";
import type { CellRegion } from "../../world/change-tracking.ts";
import type { FireGlow } from "../effects/fire-glow.ts";
import { geometryFromMeshData, InstanceBatch } from "../instancing.ts";
import type { TerrainTextures } from "../terrain/terrain-textures.ts";
import { HIDDEN_LEVEL } from "../view-input.ts";
import { createPlantMaterial, PlantWeather, SpeciesLook } from "./plant-material.ts";
import { foliageLook } from "./plant-palette.ts";
import {
  bucketGroups,
  FLOATS_PER_PLANT,
  PLANT_BUCKETS,
  type VegetationChunk,
  VegetationChunks,
} from "./vegetation-chunks.ts";

const LEVEL_DISTANCES: readonly number[] = [160, 600, 1600, 4200];
const SHADOW_LEVEL_COUNT = 2;

const PLANT_CHANNELS: readonly VertexChannel[] = ["flutter", "part", "shade", "slot", "sway"];

const PLANT_FIELDS = [
  { name: "plantPlacement", size: 4 },
  { name: "plantLook", size: 4 },
] as const;

interface BatchCounts {
  drawn: number;
  shadowed: number;
}

interface PlantBatch {
  readonly batch: InstanceBatch;
  readonly buckets: readonly number[];
  readonly counts: BatchCounts;
}

function shadowFrustumOf(sun: DirectionalLight): Frustum {
  sun.updateMatrixWorld();
  sun.target.updateMatrixWorld();
  sun.shadow.updateMatrices(sun);

  return sun.shadow.getFrustum();
}

function castsShadowAt(chunk: VegetationChunk, level: number, shadowFrustum: Frustum): boolean {
  if (level === HIDDEN_LEVEL || level >= SHADOW_LEVEL_COUNT) {
    return false;
  }

  return shadowFrustum.intersectsBox(chunk.bounds);
}

export class VegetationView {
  readonly chunks: VegetationChunks;
  readonly group = new Group();
  readonly weather = new PlantWeather();
  readonly #batches: readonly (readonly PlantBatch[])[];
  readonly #changedBuckets: readonly Set<number>[];
  readonly #chunkLevels: Int8Array;
  readonly #chunkShadows: Uint8Array;
  readonly #dirtyLevels = new Set<number>();
  readonly #looks: readonly SpeciesLook[];

  constructor(mirror: WorldMirror, textures: TerrainTextures, glow: FireGlow) {
    this.chunks = new VegetationChunks(mirror);
    this.#chunkLevels = new Int8Array(this.chunks.chunks.length).fill(HIDDEN_LEVEL);
    this.#chunkShadows = new Uint8Array(this.chunks.chunks.length);
    this.#looks = PLANT_SPECIES.map(() => new SpeciesLook());

    const materials = this.#looks.map((look) =>
      createPlantMaterial({ glow, grid: mirror.grid, look, textures, weather: this.weather })
    );

    this.#batches = PLANT_DETAIL_LEVELS.map((level, levelIndex) =>
      bucketGroups(level).map((buckets) => {
        const { species, variant } = PLANT_BUCKETS[buckets[0]];

        return this.#createBatch(
          geometryFromMeshData(buildPlantVariant(species, variant, level), PLANT_CHANNELS),
          materials[species],
          levelIndex,
          buckets
        );
      })
    );

    this.#changedBuckets = this.#batches.map(() => new Set<number>());

    for (const level of this.#batches.keys()) {
      this.#dirtyLevels.add(level);
    }
  }

  plantsChanged(indices: readonly number[]): void {
    this.chunks.plantsChanged(indices);
  }

  heightsChanged(region: CellRegion): void {
    this.chunks.heightsChanged(region);
  }

  update(camera: PerspectiveCamera, frustum: Frustum, sun: DirectionalLight, detail: number, season: number): void {
    this.#paintSeason(season);

    const repacked = this.chunks.repackDirty();

    this.#assignLevels(camera, frustum, sun, detail);
    this.#markBucketsOf(repacked);
    this.#refillDirtyLevels();
  }

  dispose(): void {
    for (const plants of this.#batches.flat()) {
      plants.batch.dispose();
    }
  }

  #createBatch(
    geometry: InstancedBufferGeometry,
    material: MeshStandardNodeMaterial,
    levelIndex: number,
    buckets: readonly number[]
  ): PlantBatch {
    const batch = new InstanceBatch(geometry, material, PLANT_FIELDS, 64);
    const counts: BatchCounts = { drawn: 0, shadowed: 0 };

    batch.mesh.castShadow = levelIndex < SHADOW_LEVEL_COUNT;
    batch.mesh.receiveShadow = true;
    batch.mesh.onBeforeShadow = () => {
      geometry.instanceCount = counts.shadowed;
    };
    batch.mesh.onAfterShadow = () => {
      geometry.instanceCount = counts.drawn;
    };
    this.group.add(batch.mesh);

    return { batch, buckets, counts };
  }

  #paintSeason(season: number): void {
    for (const [species, look] of this.#looks.entries()) {
      const current = foliageLook(PLANT_SPECIES[species].index, season);

      look.foliageColor.value.setHex(current.color);
      look.foliageCoverage.value = current.coverage;
    }
  }

  #assignLevels(camera: PerspectiveCamera, frustum: Frustum, sun: DirectionalLight, detail: number): void {
    const shadowFrustum = shadowFrustumOf(sun);

    for (const [index, chunk] of this.chunks.chunks.entries()) {
      const level = this.#levelOf(chunk, camera, frustum, detail);
      const castsShadow = castsShadowAt(chunk, level, shadowFrustum) ? 1 : 0;
      const previous = this.#chunkLevels[index];

      if (level !== previous) {
        this.#chunkLevels[index] = level;
        this.#markBucketsDirty(chunk, previous);
        this.#markBucketsDirty(chunk, level);
      }

      if (castsShadow !== this.#chunkShadows[index]) {
        this.#chunkShadows[index] = castsShadow;
        this.#markBucketsDirty(chunk, level);
      }
    }
  }

  #markBucketsOf(chunkIndices: readonly number[]): void {
    for (const index of chunkIndices) {
      const level = this.#chunkLevels[index];

      if (level === HIDDEN_LEVEL) {
        continue;
      }

      for (const bucket of this.chunks.chunks[index].changedBuckets) {
        this.#changedBuckets[level].add(bucket);
      }
    }

    for (const index of chunkIndices) {
      this.chunks.chunks[index].changedBuckets = [];
    }
  }

  #markBucketsDirty(chunk: VegetationChunk, level: number): void {
    if (level === HIDDEN_LEVEL) {
      return;
    }

    const changed = this.#changedBuckets[level];

    for (const [bucket, source] of chunk.buckets.entries()) {
      if (source.length > 0) {
        changed.add(bucket);
      }
    }

    for (const bucket of chunk.changedBuckets) {
      changed.add(bucket);
    }
  }

  #levelOf(chunk: VegetationChunk, camera: PerspectiveCamera, frustum: Frustum, detail: number): number {
    if (chunk.plants.size === 0 || !frustum.intersectsBox(chunk.bounds)) {
      return HIDDEN_LEVEL;
    }

    const distance = chunk.bounds.distanceToPoint(camera.position);

    return LEVEL_DISTANCES.findIndex((limit) => distance < limit * detail);
  }

  #refillDirtyLevels(): void {
    for (const [level, batches] of this.#batches.entries()) {
      const isWhole = this.#dirtyLevels.has(level);
      const changed = this.#changedBuckets[level];

      if (!isWhole && changed.size === 0) {
        continue;
      }

      const casters = this.chunks.chunks.filter(
        (_chunk, index) => this.#chunkLevels[index] === level && this.#chunkShadows[index] === 1
      );
      const others = this.chunks.chunks.filter(
        (_chunk, index) => this.#chunkLevels[index] === level && this.#chunkShadows[index] === 0
      );

      const chunks = [...casters, ...others];

      for (const batch of batches) {
        if (isWhole || batch.buckets.some((bucket) => changed.has(bucket))) {
          this.#fill(batch, chunks, casters.length);
        }
      }

      changed.clear();
    }

    this.#dirtyLevels.clear();
  }

  #fill(plants: PlantBatch, chunks: readonly VegetationChunk[], casterCount: number): void {
    const { batch, buckets, counts } = plants;

    const sources: Float32Array[] = [];

    let shadowedFloats = 0;

    for (const [index, chunk] of chunks.entries()) {
      for (const bucket of buckets) {
        const source = chunk.buckets[bucket];

        if (source.length === 0) {
          continue;
        }

        sources.push(source);

        if (index < casterCount) {
          shadowedFloats += source.length;
        }
      }
    }

    batch.fill(sources);
    counts.drawn = batch.count;
    counts.shadowed = shadowedFloats / FLOATS_PER_PLANT;
  }
}

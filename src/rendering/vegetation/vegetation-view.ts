import {
  type DirectionalLight,
  type Frustum,
  Group,
  type InstancedBufferGeometry,
  Mesh,
  type MeshStandardNodeMaterial,
  type PerspectiveCamera,
} from "three/webgpu";
import { PLANT_SPECIES } from "../../content/plants.ts";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { buildPlantVariants, PLANT_DETAIL_LEVELS } from "../../models/plants/plant-models.ts";
import type { CellRegion } from "../../world/change-tracking.ts";
import type { FireGlow } from "../effects/fire-glow.ts";
import { geometryFromMeshData, InterleavedInstances } from "../instancing.ts";
import type { TerrainTextures } from "../terrain/terrain-textures.ts";
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
const HIDDEN = -1;

const PLANT_FIELDS = [
  { name: "plantPlacement", size: 4 },
  { name: "plantLook", size: 4 },
] as const;

interface BatchCounts {
  drawn: number;
  shadowed: number;
}

interface PlantBatch {
  readonly buckets: readonly number[];
  readonly counts: BatchCounts;
  readonly geometry: InstancedBufferGeometry;
  readonly instances: InterleavedInstances;
  readonly mesh: Mesh;
}

function shadowFrustumOf(sun: DirectionalLight): Frustum | null {
  if (!sun.castShadow) {
    return null;
  }

  sun.updateMatrixWorld();
  sun.target.updateMatrixWorld();
  sun.shadow.updateMatrices(sun);

  return sun.shadow.getFrustum();
}

function castsShadowAt(chunk: VegetationChunk, level: number, shadowFrustum: Frustum | null): boolean {
  if (level === HIDDEN || level >= SHADOW_LEVEL_COUNT || shadowFrustum === null) {
    return false;
  }

  return shadowFrustum.intersectsBox(chunk.bounds);
}

export class VegetationView {
  readonly chunks: VegetationChunks;
  readonly group = new Group();
  readonly weather = new PlantWeather();
  readonly #batches: readonly (readonly PlantBatch[])[];
  readonly #chunkLevels: Int8Array;
  readonly #chunkShadows: Uint8Array;
  readonly #dirtyLevels = new Set<number>();
  readonly #looks: readonly SpeciesLook[];

  constructor(mirror: WorldMirror, textures: TerrainTextures, glow: FireGlow) {
    this.chunks = new VegetationChunks(mirror);
    this.#chunkLevels = new Int8Array(this.chunks.chunks.length).fill(HIDDEN);
    this.#chunkShadows = new Uint8Array(this.chunks.chunks.length);
    this.#looks = PLANT_SPECIES.map(() => new SpeciesLook());

    const materials = this.#looks.map((look) =>
      createPlantMaterial({ glow, grid: mirror.grid, look, textures, weather: this.weather })
    );

    this.#batches = PLANT_DETAIL_LEVELS.map((level, levelIndex) => {
      const variantsBySpecies = PLANT_SPECIES.map((species) => buildPlantVariants(species.index, level));

      return bucketGroups(level).map((buckets) => {
        const { species, variant } = PLANT_BUCKETS[buckets[0]];

        return this.#createBatch(
          geometryFromMeshData(variantsBySpecies[species][variant], ["flutter", "part", "shade", "slot", "sway"]),
          materials[species],
          levelIndex,
          buckets
        );
      });
    });

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
    this.#markLevelsOf(repacked);
    this.#refillDirtyLevels();
  }

  dispose(): void {
    for (const level of this.#batches) {
      for (const batch of level) {
        batch.geometry.dispose();
      }
    }
  }

  #createBatch(
    geometry: InstancedBufferGeometry,
    material: MeshStandardNodeMaterial,
    levelIndex: number,
    buckets: readonly number[]
  ): PlantBatch {
    const instances = new InterleavedInstances(geometry, PLANT_FIELDS, 64);
    const mesh = new Mesh(geometry, material);
    const counts: BatchCounts = { drawn: 0, shadowed: 0 };

    mesh.frustumCulled = false;
    mesh.castShadow = levelIndex < SHADOW_LEVEL_COUNT;
    mesh.receiveShadow = true;
    mesh.visible = false;
    mesh.onBeforeShadow = () => {
      geometry.instanceCount = counts.shadowed;
    };
    mesh.onAfterShadow = () => {
      geometry.instanceCount = counts.drawn;
    };
    this.group.add(mesh);

    return { buckets, counts, geometry, instances, mesh };
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
        this.#markDirty(previous);
        this.#markDirty(level);
      }

      if (castsShadow !== this.#chunkShadows[index]) {
        this.#chunkShadows[index] = castsShadow;
        this.#markDirty(level);
      }
    }
  }

  #markLevelsOf(chunkIndices: readonly number[]): void {
    for (const index of chunkIndices) {
      this.#markDirty(this.#chunkLevels[index]);
    }
  }

  #markDirty(level: number): void {
    if (level !== HIDDEN) {
      this.#dirtyLevels.add(level);
    }
  }

  #levelOf(chunk: VegetationChunk, camera: PerspectiveCamera, frustum: Frustum, detail: number): number {
    if (chunk.plants.size === 0 || !frustum.intersectsBox(chunk.bounds)) {
      return HIDDEN;
    }

    const distance = chunk.bounds.distanceToPoint(camera.position);

    return LEVEL_DISTANCES.findIndex((limit) => distance < limit * detail);
  }

  #refillDirtyLevels(): void {
    for (const level of this.#dirtyLevels) {
      const casters = this.chunks.chunks.filter(
        (_chunk, index) => this.#chunkLevels[index] === level && this.#chunkShadows[index] === 1
      );
      const others = this.chunks.chunks.filter(
        (_chunk, index) => this.#chunkLevels[index] === level && this.#chunkShadows[index] === 0
      );

      for (const batch of this.#batches[level]) {
        this.#fill(batch, [...casters, ...others], casters.length);
      }
    }

    this.#dirtyLevels.clear();
  }

  #fill(batch: PlantBatch, chunks: readonly VegetationChunk[], casterCount: number): void {
    const plantCounts = chunks.map(
      (chunk) => batch.buckets.reduce((sum, bucket) => sum + chunk.buckets[bucket].length, 0) / FLOATS_PER_PLANT
    );

    const count = plantCounts.reduce((sum, plants) => sum + plants, 0);

    batch.counts.drawn = count;
    batch.counts.shadowed = plantCounts.slice(0, casterCount).reduce((sum, plants) => sum + plants, 0);
    batch.geometry.instanceCount = count;
    batch.mesh.visible = count > 0;

    if (count === 0) {
      return;
    }

    batch.instances.ensureCapacity(count);

    const target = batch.instances.array;

    let offset = 0;

    for (const chunk of chunks) {
      for (const bucket of batch.buckets) {
        const data = chunk.buckets[bucket];

        target.set(data, offset);
        offset += data.length;
      }
    }

    batch.instances.markUpdated(count);
  }
}

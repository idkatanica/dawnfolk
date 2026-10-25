import { Group, type Material } from "three/webgpu";
import { type MeshData, triangleCount } from "../../models/mesh/mesh-data.ts";
import { geometryFromMeshData, InstanceBatch } from "../instancing.ts";
import { SHADOW_ONLY_LAYER } from "../shadow-only-layer.ts";

const SKINNED_CHANNELS = ["boneA", "boneB", "boneWeight", "shade", "slot"] as const;

const ROW_FIELDS = [{ name: "agentRow", size: 1 }];

interface PartLevel {
  readonly parts: readonly MeshData[];
  readonly shadowParts: readonly MeshData[] | null;
}

type BatchRow = readonly (InstanceBatch | null)[];

export class PartBatches {
  readonly group = new Group();
  readonly #all: readonly InstanceBatch[];
  readonly #batches: readonly BatchRow[];
  readonly #shadowBatches: readonly (BatchRow | null)[];

  constructor(levels: readonly PartLevel[], material: Material) {
    this.#batches = levels.map((level) => level.parts.map((part) => this.#createBatch(part, material, false)));
    this.#shadowBatches = levels.map((level) => this.#createShadowBatches(level, material));
    this.#all = [...this.#batches, ...this.#shadowBatches.filter((row) => row !== null)]
      .flat()
      .filter((batch) => batch !== null);
  }

  begin(): void {
    for (const batch of this.#all) {
      batch.begin();
    }
  }

  add(level: number, part: number, row: number): void {
    this.#batches[level][part]?.add([row]);
    this.#shadowBatches[level]?.[part]?.add([row]);
  }

  commit(): void {
    for (const batch of this.#all) {
      batch.commit();
    }
  }

  dispose(): void {
    for (const batch of this.#all) {
      batch.dispose();
    }
  }

  #createShadowBatches(level: PartLevel, material: Material): BatchRow | null {
    if (level.shadowParts === null) {
      return null;
    }

    return level.shadowParts.map((part) => this.#createBatch(part, material, true));
  }

  #createBatch(part: MeshData, material: Material, isShadowOnly: boolean): InstanceBatch | null {
    if (triangleCount(part) === 0) {
      return null;
    }

    const batch = new InstanceBatch(geometryFromMeshData(part, SKINNED_CHANNELS), material, ROW_FIELDS, 32);

    batch.mesh.castShadow = isShadowOnly;
    batch.mesh.receiveShadow = !isShadowOnly;

    if (isShadowOnly) {
      batch.mesh.layers.set(SHADOW_ONLY_LAYER);
    }

    this.group.add(batch.mesh);

    return batch;
  }
}

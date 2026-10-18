import { Group, type InstancedBufferGeometry, type Material, Mesh } from "three/webgpu";
import { type MeshData, triangleCount } from "../../models/mesh/mesh-data.ts";
import { geometryFromMeshData, InstanceAttribute } from "../instancing.ts";
import { SHADOW_ONLY_LAYER } from "../shadow-only-layer.ts";

const SKINNED_CHANNELS = ["boneA", "boneB", "boneWeight", "shade", "slot"] as const;

interface PartLevel {
  readonly parts: readonly MeshData[];
  readonly shadowParts: readonly MeshData[] | null;
}

interface PartBatch {
  count: number;
  readonly geometry: InstancedBufferGeometry;
  readonly mesh: Mesh;
  readonly rows: InstanceAttribute;
}

type BatchRow = readonly (PartBatch | null)[];

function appendRow(batch: PartBatch | null, row: number): void {
  if (batch === null) {
    return;
  }

  batch.rows.ensureCapacity(batch.count + 1);
  batch.rows.array[batch.count] = row;
  batch.count += 1;
}

export class PartBatches {
  readonly group = new Group();
  readonly #all: readonly PartBatch[];
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
      batch.count = 0;
    }
  }

  add(level: number, part: number, row: number): void {
    appendRow(this.#batches[level][part], row);

    const shadows = this.#shadowBatches[level];

    if (shadows === null) {
      return;
    }

    appendRow(shadows[part], row);
  }

  commit(): void {
    for (const batch of this.#all) {
      batch.geometry.instanceCount = batch.count;
      batch.mesh.visible = batch.count > 0;

      if (batch.count > 0) {
        batch.rows.markUpdated(batch.count);
      }
    }
  }

  dispose(): void {
    for (const batch of this.#all) {
      batch.geometry.dispose();
    }
  }

  #createShadowBatches(level: PartLevel, material: Material): BatchRow | null {
    if (level.shadowParts === null) {
      return null;
    }

    return level.shadowParts.map((part) => this.#createBatch(part, material, true));
  }

  #createBatch(part: MeshData, material: Material, isShadowOnly: boolean): PartBatch | null {
    if (triangleCount(part) === 0) {
      return null;
    }

    const geometry = geometryFromMeshData(part, SKINNED_CHANNELS);

    const rows = new InstanceAttribute(geometry, "agentRow", 1, 32);
    const mesh = new Mesh(geometry, material);

    mesh.frustumCulled = false;
    mesh.castShadow = isShadowOnly;
    mesh.receiveShadow = !isShadowOnly;
    mesh.visible = false;

    if (isShadowOnly) {
      mesh.layers.set(SHADOW_ONLY_LAYER);
    }

    this.group.add(mesh);

    return { count: 0, geometry, mesh, rows };
  }
}

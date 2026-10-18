import { Group, type InstancedBufferGeometry, type Material, Mesh } from "three/webgpu";
import type { MeshData } from "../../models/mesh/mesh-data.ts";
import { geometryFromMeshData, InstanceAttribute } from "../instancing.ts";

const SKINNED_CHANNELS = ["boneA", "boneB", "boneWeight", "shade", "slot"] as const;

interface PartLevel {
  readonly castsShadow: boolean;
  readonly parts: readonly MeshData[];
}

interface PartBatch {
  count: number;
  readonly geometry: InstancedBufferGeometry;
  readonly mesh: Mesh;
  readonly rows: InstanceAttribute;
}

export class PartBatches {
  readonly group = new Group();
  readonly #batches: readonly (readonly PartBatch[])[];

  constructor(levels: readonly PartLevel[], material: Material) {
    this.#batches = levels.map((level) =>
      level.parts.map((part) => this.#createBatch(part, material, level.castsShadow))
    );
  }

  begin(): void {
    for (const level of this.#batches) {
      for (const batch of level) {
        batch.count = 0;
      }
    }
  }

  add(level: number, part: number, row: number): void {
    const batch = this.#batches[level][part];

    batch.rows.ensureCapacity(batch.count + 1);
    batch.rows.array[batch.count] = row;
    batch.count += 1;
  }

  commit(): void {
    for (const level of this.#batches) {
      for (const batch of level) {
        batch.geometry.instanceCount = batch.count;
        batch.mesh.visible = batch.count > 0;

        if (batch.count > 0) {
          batch.rows.markUpdated(batch.count);
        }
      }
    }
  }

  dispose(): void {
    for (const level of this.#batches) {
      for (const batch of level) {
        batch.geometry.dispose();
      }
    }
  }

  #createBatch(part: MeshData, material: Material, castsShadow: boolean): PartBatch {
    const geometry = geometryFromMeshData(part, SKINNED_CHANNELS);

    const rows = new InstanceAttribute(geometry, "agentRow", 1, 32);
    const mesh = new Mesh(geometry, material);

    mesh.frustumCulled = false;
    mesh.castShadow = castsShadow;
    mesh.receiveShadow = true;
    mesh.visible = false;
    this.group.add(mesh);

    return { count: 0, geometry, mesh, rows };
  }
}

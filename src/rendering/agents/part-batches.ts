import { Group, type InstancedBufferGeometry, type Material, Mesh } from "three/webgpu";
import { type MeshData, triangleCount } from "../../models/mesh/mesh-data.ts";
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
  readonly #all: readonly PartBatch[];
  readonly #batches: readonly (readonly (PartBatch | null)[])[];

  constructor(levels: readonly PartLevel[], material: Material) {
    this.#batches = levels.map((level) =>
      level.parts.map((part) => this.#createBatch(part, material, level.castsShadow))
    );
    this.#all = this.#batches.flat().filter((batch) => batch !== null);
  }

  begin(): void {
    for (const batch of this.#all) {
      batch.count = 0;
    }
  }

  add(level: number, part: number, row: number): void {
    const batch = this.#batches[level][part];

    if (batch === null) {
      return;
    }

    batch.rows.ensureCapacity(batch.count + 1);
    batch.rows.array[batch.count] = row;
    batch.count += 1;
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

  #createBatch(part: MeshData, material: Material, castsShadow: boolean): PartBatch | null {
    if (triangleCount(part) === 0) {
      return null;
    }

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

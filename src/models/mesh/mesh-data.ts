export const VERTEX_CHANNELS = [
  "boneA",
  "boneB",
  "boneWeight",
  "buildOrder",
  "flutter",
  "part",
  "shade",
  "slot",
  "sway",
] as const;

export type VertexChannel = (typeof VERTEX_CHANNELS)[number];

type VertexValues = Readonly<Record<VertexChannel, number>>;

export const DEFAULT_VERTEX_VALUES: VertexValues = {
  boneA: 0,
  boneB: 0,
  boneWeight: 0,
  buildOrder: 0,
  flutter: 0,
  part: 0,
  shade: 1,
  slot: 0,
  sway: 0,
};

interface Bounds {
  readonly maximum: readonly [number, number, number];
  readonly minimum: readonly [number, number, number];
}

export interface MeshData {
  readonly bounds: Bounds;
  readonly channels: Readonly<Record<VertexChannel, Float32Array>>;
  readonly indices: Uint32Array;
  readonly normals: Float32Array;
  readonly positions: Float32Array;
}

export function vertexCount(mesh: MeshData): number {
  return mesh.positions.length / 3;
}

export function triangleCount(mesh: MeshData): number {
  return mesh.indices.length / 3;
}

export function boundsOf(positions: Float32Array): Bounds {
  if (positions.length === 0) {
    return { maximum: [0, 0, 0], minimum: [0, 0, 0] };
  }

  const minimum: [number, number, number] = [positions[0], positions[1], positions[2]];
  const maximum: [number, number, number] = [positions[0], positions[1], positions[2]];

  for (let offset = 0; offset < positions.length; offset += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], positions[offset + axis]);
      maximum[axis] = Math.max(maximum[axis], positions[offset + axis]);
    }
  }

  return { maximum, minimum };
}

export function channelRecord<Value>(make: (channel: VertexChannel) => Value): Record<VertexChannel, Value> {
  return {
    boneA: make("boneA"),
    boneB: make("boneB"),
    boneWeight: make("boneWeight"),
    buildOrder: make("buildOrder"),
    flutter: make("flutter"),
    part: make("part"),
    shade: make("shade"),
    slot: make("slot"),
    sway: make("sway"),
  };
}

export function mergeMeshes(meshes: readonly MeshData[]): MeshData {
  const totalVertices = meshes.reduce((sum, mesh) => sum + vertexCount(mesh), 0);
  const totalIndices = meshes.reduce((sum, mesh) => sum + mesh.indices.length, 0);

  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const indices = new Uint32Array(totalIndices);
  const channels = channelRecord(() => new Float32Array(totalVertices));

  let vertexOffset = 0;
  let indexOffset = 0;

  for (const mesh of meshes) {
    positions.set(mesh.positions, vertexOffset * 3);
    normals.set(mesh.normals, vertexOffset * 3);

    for (const channel of VERTEX_CHANNELS) {
      channels[channel].set(mesh.channels[channel], vertexOffset);
    }

    for (let index = 0; index < mesh.indices.length; index += 1) {
      indices[indexOffset + index] = mesh.indices[index] + vertexOffset;
    }

    vertexOffset += vertexCount(mesh);
    indexOffset += mesh.indices.length;
  }

  return { bounds: boundsOf(positions), channels, indices, normals, positions };
}

import { Matrix3, Matrix4, Vector3 } from "three";
import { GrowableFloatArray, GrowableIndexArray } from "./growable-array.ts";
import {
  boundsOf,
  DEFAULT_VERTEX_VALUES,
  type MeshData,
  VERTEX_CHANNELS,
  type VertexChannel,
  vertexCount,
} from "./mesh-data.ts";
import { readShapeVertex, type Shape, shapeVertexCount } from "./shape.ts";

export interface SurfacePoint {
  readonly along: number;
  readonly around: number;
  readonly local: Vector3;
  readonly normal: Vector3;
  readonly position: Vector3;
}

type ChannelValue = number | ((point: SurfacePoint) => number);

export type VertexStyle = Partial<Readonly<Record<VertexChannel, ChannelValue>>>;

interface Placement {
  readonly style?: VertexStyle;
  readonly transform?: Matrix4;
}

const IDENTITY = new Matrix4();

function resolveChannel(value: ChannelValue | undefined, fallback: number, point: SurfacePoint): number {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === "number") {
    return value;
  }

  return value(point);
}

function createChannelArrays(): Record<VertexChannel, GrowableFloatArray> {
  return {
    boneA: new GrowableFloatArray(),
    boneB: new GrowableFloatArray(),
    boneWeight: new GrowableFloatArray(),
    buildOrder: new GrowableFloatArray(),
    flutter: new GrowableFloatArray(),
    part: new GrowableFloatArray(),
    shade: new GrowableFloatArray(),
    slot: new GrowableFloatArray(),
    sway: new GrowableFloatArray(),
  };
}

export class MeshBuilder {
  readonly #baseStyle: VertexStyle;
  readonly #channels = createChannelArrays();
  readonly #indices = new GrowableIndexArray();
  readonly #normals = new GrowableFloatArray();
  readonly #positions = new GrowableFloatArray();
  #vertexCount = 0;

  constructor(baseStyle: VertexStyle = {}) {
    this.#baseStyle = baseStyle;
  }

  add(shape: Shape, placement: Placement = {}): void {
    const { style = {}, transform = IDENTITY } = placement;

    const combinedStyle: VertexStyle = { ...this.#baseStyle, ...style };
    const normalMatrix = new Matrix3().getNormalMatrix(transform);
    const isMirrored = transform.determinant() < 0;
    const firstVertex = this.#vertexCount;

    for (let index = 0; index < shapeVertexCount(shape); index += 1) {
      const vertex = readShapeVertex(shape, index);

      const local = new Vector3(vertex.x, vertex.y, vertex.z);

      const position = local.clone().applyMatrix4(transform);
      const normal = new Vector3(vertex.normalX, vertex.normalY, vertex.normalZ).applyMatrix3(normalMatrix).normalize();

      this.#pushVertex(position, normal);
      this.#pushChannels(combinedStyle, { along: vertex.along, around: vertex.around, local, normal, position });
    }

    this.#pushTriangles(shape.indices, firstVertex, isMirrored);
  }

  addMesh(mesh: MeshData, placement: Placement = {}): void {
    const { style = {}, transform = IDENTITY } = placement;

    const normalMatrix = new Matrix3().getNormalMatrix(transform);
    const isMirrored = transform.determinant() < 0;
    const firstVertex = this.#vertexCount;

    for (let index = 0; index < vertexCount(mesh); index += 1) {
      const offset = index * 3;

      const local = new Vector3(mesh.positions[offset], mesh.positions[offset + 1], mesh.positions[offset + 2]);

      const position = local.clone().applyMatrix4(transform);
      const normal = new Vector3(mesh.normals[offset], mesh.normals[offset + 1], mesh.normals[offset + 2])
        .applyMatrix3(normalMatrix)
        .normalize();
      const point = { along: 0, around: 0, local, normal, position };

      this.#pushVertex(position, normal);

      for (const channel of VERTEX_CHANNELS) {
        this.#channels[channel].push(resolveChannel(style[channel], mesh.channels[channel][index], point));
      }
    }

    this.#pushTriangles(mesh.indices, firstVertex, isMirrored);
  }

  build(): MeshData {
    const positions = this.#positions.toArray();

    return {
      bounds: boundsOf(positions),
      channels: {
        boneA: this.#channels.boneA.toArray(),
        boneB: this.#channels.boneB.toArray(),
        boneWeight: this.#channels.boneWeight.toArray(),
        buildOrder: this.#channels.buildOrder.toArray(),
        flutter: this.#channels.flutter.toArray(),
        part: this.#channels.part.toArray(),
        shade: this.#channels.shade.toArray(),
        slot: this.#channels.slot.toArray(),
        sway: this.#channels.sway.toArray(),
      },
      indices: this.#indices.toArray(),
      normals: this.#normals.toArray(),
      positions,
    };
  }

  #pushVertex(position: Vector3, normal: Vector3): void {
    this.#positions.pushThree(position.x, position.y, position.z);
    this.#normals.pushThree(normal.x, normal.y, normal.z);
    this.#vertexCount += 1;
  }

  #pushChannels(style: VertexStyle, point: SurfacePoint): void {
    for (const channel of VERTEX_CHANNELS) {
      this.#channels[channel].push(resolveChannel(style[channel], DEFAULT_VERTEX_VALUES[channel], point));
    }
  }

  #pushTriangles(indices: Uint32Array, firstVertex: number, isMirrored: boolean): void {
    for (let corner = 0; corner < indices.length; corner += 3) {
      const first = firstVertex + indices[corner];
      const second = firstVertex + indices[corner + 1];
      const third = firstVertex + indices[corner + 2];

      if (isMirrored) {
        this.#indices.pushTriangle(first, third, second);

        continue;
      }

      this.#indices.pushTriangle(first, second, third);
    }
  }
}

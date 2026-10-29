import { Matrix3, Matrix4, Vector3 } from "three";
import { GrowableFloatArray, GrowableIndexArray } from "./growable-array.ts";
import {
  boundsOf,
  channelRecord,
  DEFAULT_VERTEX_VALUES,
  type MeshData,
  VERTEX_CHANNELS,
  type VertexChannel,
  vertexCount,
} from "./mesh-data.ts";
import { blendSeamNormals, type SeamSurface } from "./seams.ts";
import { readShapeVertex, type Shape, shapeVertexCount } from "./shape.ts";

const IDENTITY = new Matrix4();

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
  readonly seam?: number;
  readonly style?: VertexStyle;
  readonly transform?: Matrix4;
}

export function resolveChannel(value: ChannelValue | undefined, fallback: number, point: SurfacePoint): number {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === "number") {
    return value;
  }

  return value(point);
}

export class MeshBuilder {
  readonly #baseStyle: VertexStyle;
  readonly #channels = channelRecord(() => new GrowableFloatArray());
  readonly #indices = new GrowableIndexArray();
  readonly #normals = new GrowableFloatArray();
  readonly #positions = new GrowableFloatArray();
  #references: MeshBuilder | null = null;
  readonly #referenceSeams: SeamSurface[] = [];
  readonly #seams: SeamSurface[] = [];
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

    this.#recordSeam(placement, shapeVertexCount(shape), shape.indices.length / 3);

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

    this.#recordSeam(placement, vertexCount(mesh), mesh.indices.length / 3);

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

  addSeamReference(shape: Shape): void {
    const references = this.#referenceBuilder();

    this.#referenceSeams.push({
      firstTriangle: references.#indices.length / 3,
      firstVertex: references.#vertexCount,
      isReference: true,
      reach: 0,
      triangleCount: shape.indices.length / 3,
      vertexCount: shapeVertexCount(shape),
    });
    references.add(shape);
  }

  build(): MeshData {
    const positions = this.#positions.toArray();
    const normals = this.#normals.toArray();
    const indices = this.#indices.toArray();

    this.#blendSeams(positions, normals, indices);

    return {
      bounds: boundsOf(positions),
      channels: channelRecord((channel) => this.#channels[channel].toArray()),
      indices,
      normals,
      positions,
    };
  }

  #blendSeams(positions: Float32Array, normals: Float32Array, indices: Uint32Array): void {
    if (this.#seams.length + this.#referenceSeams.length < 2 || this.#seams.length === 0) {
      return;
    }

    if (this.#referenceSeams.length === 0) {
      blendSeamNormals({ indices, normals, positions }, this.#seams);

      return;
    }

    const references = this.#referenceBuilder().build();
    const ownVertices = this.#vertexCount;
    const ownTriangles = indices.length / 3;

    const combinedIndices = new Uint32Array(indices.length + references.indices.length);
    const combinedNormals = new Float32Array(normals.length + references.normals.length);
    const combinedPositions = new Float32Array(positions.length + references.positions.length);

    combinedIndices.set(indices);
    combinedNormals.set(normals);
    combinedPositions.set(positions);
    combinedNormals.set(references.normals, normals.length);
    combinedPositions.set(references.positions, positions.length);

    for (let index = 0; index < references.indices.length; index += 1) {
      combinedIndices[indices.length + index] = references.indices[index] + ownVertices;
    }

    const shifted = this.#referenceSeams.map((seam) => ({
      ...seam,
      firstTriangle: seam.firstTriangle + ownTriangles,
      firstVertex: seam.firstVertex + ownVertices,
    }));

    blendSeamNormals({ indices: combinedIndices, normals: combinedNormals, positions: combinedPositions }, [
      ...this.#seams,
      ...shifted,
    ]);

    normals.set(combinedNormals.subarray(0, normals.length));
  }

  #referenceBuilder(): MeshBuilder {
    if (this.#references === null) {
      this.#references = new MeshBuilder();
    }

    return this.#references;
  }

  #recordSeam(placement: Placement, vertices: number, triangles: number): void {
    if (placement.seam === undefined) {
      return;
    }

    this.#seams.push({
      firstTriangle: this.#indices.length / 3,
      firstVertex: this.#vertexCount,
      isReference: false,
      reach: placement.seam,
      triangleCount: triangles,
      vertexCount: vertices,
    });
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

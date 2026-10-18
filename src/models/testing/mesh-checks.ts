import { type MeshData, VERTEX_CHANNELS, vertexCount } from "../mesh/mesh-data.ts";
import { type Shape, shapeVertexCount } from "../mesh/shape.ts";

const NORMAL_TOLERANCE = 1e-3;

interface IndexedGeometry {
  readonly indices: Uint32Array;
  readonly normals: Float32Array;
  readonly positions: Float32Array;
}

function geometryProblems(geometry: IndexedGeometry, count: number): string[] {
  const problems: string[] = [];

  if (geometry.indices.length % 3 !== 0) {
    problems.push("index count is not a multiple of three");
  }

  if (geometry.indices.some((index) => index >= count)) {
    problems.push("an index points past the last vertex");
  }

  if (geometry.positions.some((value) => !Number.isFinite(value))) {
    problems.push("a position is not finite");
  }

  for (let offset = 0; offset < geometry.normals.length; offset += 3) {
    const length = Math.hypot(geometry.normals[offset], geometry.normals[offset + 1], geometry.normals[offset + 2]);

    if (Math.abs(length - 1) > NORMAL_TOLERANCE) {
      problems.push(`normal ${offset / 3} has length ${length}`);

      break;
    }
  }

  return problems;
}

export function shapeProblems(shape: Shape): string[] {
  const count = shapeVertexCount(shape);

  const problems = geometryProblems(shape, count);

  if (shape.along.length !== count || shape.around.length !== count) {
    problems.push("surface parameters do not match the vertex count");
  }

  if ([...shape.along, ...shape.around].some((value) => value < 0 || value > 1)) {
    problems.push("a surface parameter is outside 0..1");
  }

  return problems;
}

export function meshProblems(mesh: MeshData): string[] {
  const count = vertexCount(mesh);

  const problems = geometryProblems(mesh, count);

  for (const channel of VERTEX_CHANNELS) {
    if (mesh.channels[channel].length !== count) {
      problems.push(`channel ${channel} does not match the vertex count`);
    }

    if (mesh.channels[channel].some((value) => !Number.isFinite(value))) {
      problems.push(`channel ${channel} has a value that is not finite`);
    }
  }

  return problems;
}

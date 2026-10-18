import { Vector3 } from "three";
import { type MeshData, VERTEX_CHANNELS, vertexCount } from "../mesh/mesh-data.ts";
import { type Shape, shapeVertexCount } from "../mesh/shape.ts";
import type { MeshPiece } from "./mesh-connectivity.ts";

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

const EDGE_GRID = 1e4;

function cornerKey(mesh: MeshData, vertex: number): string {
  const offset = vertex * 3;

  return [mesh.positions[offset], mesh.positions[offset + 1], mesh.positions[offset + 2]]
    .map((value) => Math.round(value * EDGE_GRID))
    .join(",");
}

interface EdgeUse {
  count: number;
  height: number;
}

function edgeUses(mesh: MeshData): Map<string, EdgeUse> {
  const uses = new Map<string, EdgeUse>();

  for (let corner = 0; corner < mesh.indices.length; corner += 3) {
    for (let side = 0; side < 3; side += 1) {
      const first = mesh.indices[corner + side];
      const second = mesh.indices[corner + ((side + 1) % 3)];

      const from = cornerKey(mesh, first);
      const to = cornerKey(mesh, second);

      if (from === to) {
        continue;
      }

      const edge = from < to ? `${from}|${to}` : `${to}|${from}`;
      const height = Math.max(mesh.positions[first * 3 + 1], mesh.positions[second * 3 + 1]);

      const use = uses.get(edge);

      uses.set(edge, { count: use === undefined ? 1 : use.count + 1, height });
    }
  }

  return uses;
}

function openEdges(mesh: MeshData): EdgeUse[] {
  return [...edgeUses(mesh).values()].filter((use) => use.count % 2 === 1);
}

export function openEdgeCount(mesh: MeshData): number {
  return openEdges(mesh).length;
}

export function highestOpenEdge(mesh: MeshData): number {
  return openEdges(mesh).reduce((highest, edge) => Math.max(highest, edge.height), Number.NEGATIVE_INFINITY);
}

export function thinnestPiece(mesh: MeshData, pieces: readonly MeshPiece[]): number {
  return pieces.reduce((thinnest, piece) => Math.min(thinnest, pieceThickness(mesh, piece)), Number.POSITIVE_INFINITY);
}

function pieceThickness(mesh: MeshData, piece: MeshPiece): number {
  let volume = 0;
  let area = 0;

  for (const triangle of piece.triangles) {
    const [first, second, third] = [0, 1, 2].map((corner) => mesh.indices[triangle * 3 + corner] * 3);

    const firstPoint = new Vector3().fromArray(mesh.positions, first);
    const secondPoint = new Vector3().fromArray(mesh.positions, second);
    const thirdPoint = new Vector3().fromArray(mesh.positions, third);

    volume += firstPoint.dot(secondPoint.clone().cross(thirdPoint)) / 6;
    area += secondPoint.clone().sub(firstPoint).cross(thirdPoint.clone().sub(firstPoint)).length() / 2;
  }

  return area === 0 ? 0 : (2 * Math.abs(volume)) / area;
}

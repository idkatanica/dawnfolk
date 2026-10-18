import { Vector3 } from "three";
import { boundsOf, type MeshData, vertexCount } from "../mesh/mesh-data.ts";
import type { SkeletonPoser } from "../rig/skeleton-poser.ts";

export function posedMesh(mesh: MeshData, poser: SkeletonPoser): MeshData {
  const positions = new Float32Array(mesh.positions.length);
  const rest = new Vector3();
  const first = new Vector3();
  const second = new Vector3();

  for (let vertex = 0; vertex < vertexCount(mesh); vertex += 1) {
    rest.fromArray(mesh.positions, vertex * 3);
    poser.skinPoint(mesh.channels.boneA[vertex], rest, first);
    poser.skinPoint(mesh.channels.boneB[vertex], rest, second);
    first.lerp(second, mesh.channels.boneWeight[vertex]).toArray(positions, vertex * 3);
  }

  return { ...mesh, bounds: boundsOf(positions), positions };
}

export function windBentMesh(mesh: MeshData, push: number): MeshData {
  const positions = new Float32Array(mesh.positions);

  for (let vertex = 0; vertex < vertexCount(mesh); vertex += 1) {
    positions[vertex * 3] += push * mesh.channels.sway[vertex] ** 2;
  }

  return { ...mesh, bounds: boundsOf(positions), positions };
}

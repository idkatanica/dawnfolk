import { type MeshData, vertexCount } from "../mesh/mesh-data.ts";
import { highestOpenEdge, meshProblems } from "./mesh-checks.ts";
import { loosePieces } from "./mesh-connectivity.ts";

export function widestReach(mesh: MeshData): number {
  let reach = 0;

  for (let vertex = 0; vertex < vertexCount(mesh); vertex += 1) {
    reach = Math.max(reach, Math.hypot(mesh.positions[vertex * 3], mesh.positions[vertex * 3 + 2]));
  }

  return reach;
}

export function soundnessProblems(mesh: MeshData): string[] {
  const detached = loosePieces(mesh).map((piece) => {
    return `detached ${piece}`;
  });
  const openEdge = highestOpenEdge(mesh);
  const openEdges = openEdge < 0.05 ? [] : [`open edge at ${openEdge.toFixed(2)}`];

  return [...meshProblems(mesh), ...detached, ...openEdges];
}

export function orderProblems(mesh: MeshData): string[] {
  const orders = [...mesh.channels.buildOrder];

  const problems: string[] = [];

  if (Math.min(...orders) >= 0.3) {
    problems.push("nothing is built first from the ground");
  }

  if (Math.max(...orders) <= 0.85) {
    problems.push("nothing is left for the end of the build");
  }

  if (
    !orders.every((order) => {
      return order >= 0 && order <= 1;
    })
  ) {
    problems.push("a build order is outside 0..1");
  }

  return problems;
}

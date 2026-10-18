import { describe, expect, it } from "vitest";
import { MaterialSlot } from "../materials.ts";
import { type MeshData, vertexCount } from "../mesh/mesh-data.ts";
import { describePiece, detachedPieces } from "../testing/mesh-connectivity.ts";
import { meshTree, type PlantDetailLevel, plantSway, type TreeLook } from "./tree-mesher.ts";
import type { TreeStructure } from "./tree-structure.ts";

const LEVELS: readonly PlantDetailLevel[] = ["high", "medium", "low"];

const LOOK: TreeLook = { bark: MaterialSlot.Bark, foliage: MaterialSlot.Leaf, hasBarkMarks: false };

const TREE: TreeStructure = {
  branches: [
    {
      depth: 0,
      points: [
        { radius: 0.4, x: 0, y: 0, z: 0 },
        { radius: 0.3, x: 0, y: 4, z: 0 },
        { radius: 0.2, x: 0, y: 7, z: 0 },
      ],
    },
    {
      depth: 1,
      points: [
        { radius: 0.15, x: 0, y: 5.5, z: 0 },
        { radius: 0.05, x: 3, y: 7.5, z: 0 },
      ],
    },
  ],
  foliage: [
    { center: [3, 7.5, 0], kind: "blob", radius: 2, squash: 0.8, tint: 0 },
    { center: [0, 8.5, 0], kind: "blob", radius: 2.2, squash: 0.8, tint: 0 },
  ],
  height: 10,
};

const SHRUB: TreeStructure = {
  branches: [
    {
      depth: 1,
      points: [
        { radius: 0.05, x: 0.05, y: 0, z: 0 },
        { radius: 0.02, x: 0.4, y: 1.1, z: 0 },
      ],
    },
    {
      depth: 1,
      points: [
        { radius: 0.05, x: -0.05, y: 0, z: 0 },
        { radius: 0.02, x: -0.4, y: 1.1, z: 0 },
      ],
    },
  ],
  foliage: [
    { center: [0.4, 1.1, 0], kind: "blob", radius: 0.6, squash: 0.85, tint: 0 },
    { center: [-0.4, 1.1, 0], kind: "blob", radius: 0.6, squash: 0.85, tint: 0 },
  ],
  height: 2.2,
};

const WEEPING: TreeStructure = {
  ...TREE,
  foliage: [
    ...TREE.foliage,
    {
      kind: "strand",
      points: [
        { radius: 0.3, x: 5.4, y: 7.1, z: 0 },
        { radius: 0.2, x: 5.6, y: 5, z: 0 },
        { radius: 0.04, x: 5.7, y: 3, z: 0 },
      ],
      tint: 0,
    },
  ],
};

function heightOf(mesh: MeshData, vertex: number): number {
  return mesh.positions[vertex * 3 + 1];
}

describe("tree mesher", () => {
  it.each(LEVELS)("sways the trunk, the branches and the crown alike at every height at %s detail", (level) => {
    const mesh = meshTree(TREE, LOOK, level);

    for (let vertex = 0; vertex < vertexCount(mesh); vertex += 1) {
      const height = mesh.positions[vertex * 3 + 1];

      expect(mesh.channels.sway[vertex]).toBeCloseTo(plantSway(height, TREE.height), 5);
    }
  });

  it.each(LEVELS)("grows the crown of a plant without a trunk out of the ground at %s detail", (level) => {
    const mesh = meshTree(SHRUB, LOOK, level);

    expect(detachedPieces(mesh, 0.01).map((piece) => describePiece(mesh, piece))).toEqual([]);
  });

  it.each(LEVELS)("hangs a strand from inside the crown at %s detail", (level) => {
    const mesh = meshTree(WEEPING, LOOK, level);

    expect(detachedPieces(mesh, 0.01).map((piece) => describePiece(mesh, piece))).toEqual([]);
  });

  it("swings a strand from the sway of the crown at its root to the full sway at its tip", () => {
    const first = vertexCount(meshTree(TREE, LOOK, "high"));
    const mesh = meshTree(WEEPING, LOOK, "high");

    const strand = Array.from({ length: vertexCount(mesh) - first }, (_, index) => first + index);

    const root = strand.reduce((top, vertex) => (heightOf(mesh, vertex) > heightOf(mesh, top) ? vertex : top));
    const tip = strand.reduce((bottom, vertex) => (heightOf(mesh, vertex) < heightOf(mesh, bottom) ? vertex : bottom));

    expect(mesh.channels.sway[root]).toBeCloseTo(plantSway(heightOf(mesh, root), TREE.height), 2);
    expect(mesh.channels.sway[tip]).toBeCloseTo(1, 5);
  });
});

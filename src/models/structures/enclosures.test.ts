import { Vector3 } from "three";
import { describe, expect, it as test } from "vitest";
import { MaterialSlot } from "../materials.ts";
import { type MeshData, triangleCount } from "../mesh/mesh-data.ts";
import { outermostHit } from "../mesh/surface-probe.ts";
import { highestOpenEdge, meshProblems } from "../testing/mesh-checks.ts";
import { loosePieces } from "../testing/mesh-connectivity.ts";
import { buildEnclosurePiece, ENCLOSURE_SEGMENT_LENGTH, type EnclosureKind } from "./enclosures.ts";
import type { StructureLevel } from "./structure-parts.ts";

const END_TOLERANCE = 0.02;
const LEVELS: readonly StructureLevel[] = ["high", "low"];
const ENCLOSURES: readonly EnclosureKind[] = ["palisade", "stoneWall"];

function soundnessProblems(mesh: MeshData): string[] {
  const detached = loosePieces(mesh).map((piece) => `detached ${piece}`);
  const openEdge = highestOpenEdge(mesh) < 0.05 ? [] : [`open edge at ${highestOpenEdge(mesh).toFixed(2)}`];

  return [...meshProblems(mesh), ...detached, ...openEdge];
}

function enclosurePieces(kind: EnclosureKind, level: StructureLevel): MeshData[] {
  return [buildEnclosurePiece(kind, "gate", level), buildEnclosurePiece(kind, "segment", level)];
}

function orderProblems(mesh: MeshData): string[] {
  const orders = [...mesh.channels.buildOrder];

  const problems: string[] = [];

  if (Math.min(...orders) >= 0.3) {
    problems.push("nothing is built first from the ground");
  }

  if (Math.max(...orders) <= 0.85) {
    problems.push("nothing is left for the end of the build");
  }

  if (!orders.every((order) => order >= 0 && order <= 1)) {
    problems.push("a build order is outside 0..1");
  }

  return problems;
}

describe.each(ENCLOSURES)("%s pieces", (kind) => {
  test.each(LEVELS)("butt their %s ends at half a segment either side", (level) => {
    for (const piece of enclosurePieces(kind, level)) {
      expect(piece.bounds.minimum[0]).toBeCloseTo(-ENCLOSURE_SEGMENT_LENGTH / 2, 1);
      expect(piece.bounds.maximum[0]).toBeCloseTo(ENCLOSURE_SEGMENT_LENGTH / 2, 1);
      expect(Math.abs(piece.bounds.minimum[0] + ENCLOSURE_SEGMENT_LENGTH / 2)).toBeLessThan(END_TOLERANCE);
      expect(Math.abs(piece.bounds.maximum[0] - ENCLOSURE_SEGMENT_LENGTH / 2)).toBeLessThan(END_TOLERANCE);
    }
  });

  test.each(LEVELS)("stand clean and grounded at %s detail", (level) => {
    for (const piece of enclosurePieces(kind, level)) {
      expect(soundnessProblems(piece)).toEqual([]);
      expect(orderProblems(piece)).toEqual([]);
      expect(piece.bounds.minimum[1]).toBeLessThan(0);
    }
  });

  test("keep fewer triangles far away", () => {
    for (const piece of ["gate", "segment"] as const) {
      expect(triangleCount(buildEnclosurePiece(kind, piece, "low"))).toBeLessThan(
        triangleCount(buildEnclosurePiece(kind, piece, "high"))
      );
    }
  });

  test("leave a way through the gate but not through the wall", () => {
    const gate = buildEnclosurePiece(kind, "gate", "high");
    const segment = buildEnclosurePiece(kind, "segment", "high");

    const origin = new Vector3(0, 1.1, -3);
    const ahead = new Vector3(0, 0, 1);

    expect(outermostHit(gate, origin, ahead)).toBeNull();
    expect(outermostHit(segment, origin, ahead)).not.toBeNull();
    expect(gate.channels.slot).toContain(MaterialSlot.Accent);
  });
});

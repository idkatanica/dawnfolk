import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { BUILDING_KINDS, BUILDINGS, type BuildingKind, isEnclosure } from "../../content/buildings.ts";
import { MaterialSlot, type MaterialSlotIndex } from "../materials.ts";
import { type MeshData, triangleCount, vertexCount } from "../mesh/mesh-data.ts";
import { outermostHit } from "../mesh/surface-probe.ts";
import { highestOpenEdge, meshProblems } from "../testing/mesh-checks.ts";
import { describePiece, detachedPieces } from "../testing/mesh-connectivity.ts";
import { buildBuildingModel, GLOW_PART } from "./building-models.ts";
import { buildEnclosurePieces, ENCLOSURE_SEGMENT_LENGTH, type EnclosureKind } from "./enclosures.ts";
import { buildMineModel, type MineOre } from "./mine-model.ts";
import { EMBER_PART } from "./structure-parts.ts";

const TOUCHING = 0.01;
const END_TOLERANCE = 0.02;
const LEVELS = ["high", "low"] as const;
const ENCLOSURES: readonly EnclosureKind[] = ["palisade", "stoneWall"];
const WORKING_BUILDINGS: readonly BuildingKind[] = [
  "forge",
  "granary",
  "kiln",
  "longhouse",
  "mine",
  "smelter",
  "stoneHouse",
  "workshop",
];
const GLOWING_BUILDINGS: readonly BuildingKind[] = ["forge", "kiln", "smelter"];
const MINE_ORES: readonly MineOre[] = ["copper", "tin", "iron"];
const ORE_SLOTS: Readonly<Record<MineOre, MaterialSlotIndex>> = {
  copper: MaterialSlot.CopperOre,
  iron: MaterialSlot.IronOre,
  tin: MaterialSlot.TinOre,
};

function widestReach(mesh: MeshData): number {
  let reach = 0;

  for (let vertex = 0; vertex < vertexCount(mesh); vertex += 1) {
    reach = Math.max(reach, Math.hypot(mesh.positions[vertex * 3], mesh.positions[vertex * 3 + 2]));
  }

  return reach;
}

function soundnessProblems(mesh: MeshData): string[] {
  const detached = detachedPieces(mesh, TOUCHING).map((piece) => `detached ${describePiece(mesh, piece)}`);
  const openEdge = highestOpenEdge(mesh) < 0.05 ? [] : [`open edge at ${highestOpenEdge(mesh).toFixed(2)}`];

  return [...meshProblems(mesh), ...detached, ...openEdge];
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

describe("era buildings", () => {
  it("shares the glow part with the campfire", () => {
    expect(EMBER_PART).toBe(GLOW_PART);
  });

  it.each(BUILDING_KINDS.filter((kind) => !isEnclosure(kind)))("fits the %s inside its footprint", (kind) => {
    for (const level of LEVELS) {
      expect(widestReach(buildBuildingModel(kind, level))).toBeLessThanOrEqual(BUILDINGS[kind].footprint);
    }
  });

  it.each(WORKING_BUILDINGS)("paints the %s in the tribe colour", (kind) => {
    for (const level of LEVELS) {
      expect(buildBuildingModel(kind, level).channels.slot).toContain(MaterialSlot.Accent);
    }
  });

  it.each(GLOWING_BUILDINGS)("lights the fire of the %s", (kind) => {
    for (const level of LEVELS) {
      const mesh = buildBuildingModel(kind, level);

      expect(mesh.channels.part).toContain(GLOW_PART);
      expect(mesh.channels.slot).toContain(MaterialSlot.Ember);
    }
  });

  it.each(LEVELS)("opens the %s longhouse door toward the front", (level) => {
    const longhouse = buildBuildingModel("longhouse", level);

    const hit = outermostHit(longhouse, new Vector3(0, 1.2, 0), new Vector3(0, 0, 1));

    if (hit === null) {
      throw new Error("A ray from the middle of the longhouse should leave through its front");
    }

    expect(longhouse.channels.slot[longhouse.indices[hit.triangle * 3]]).toBe(MaterialSlot.Ash);
  });

  it.each(LEVELS)("paints the %s stone house door in the tribe colour", (level) => {
    const house = buildBuildingModel("stoneHouse", level);

    const hit = outermostHit(house, new Vector3(0, 1, 0), new Vector3(0, 0, 1));

    if (hit === null) {
      throw new Error("A ray from the middle of the house should leave through its front");
    }

    expect(house.channels.slot[house.indices[hit.triangle * 3]]).toBe(MaterialSlot.Accent);
  });

  it("builds houses tall enough for grown people to walk in", () => {
    for (const kind of ["longhouse", "stoneHouse"] as const) {
      expect(buildBuildingModel(kind, "high").bounds.maximum[1]).toBeGreaterThan(4);
    }
  });
});

describe.each(MINE_ORES)("%s mine", (ore) => {
  const high = buildMineModel(ore, "high");
  const low = buildMineModel(ore, "low");

  it("builds clean, grounded geometry at both levels of detail", () => {
    expect(soundnessProblems(high)).toEqual([]);
    expect(soundnessProblems(low)).toEqual([]);
    expect(triangleCount(low)).toBeLessThan(triangleCount(high));
    expect(orderProblems(high)).toEqual([]);
  });

  it("heaps its own ore and no other", () => {
    for (const other of MINE_ORES) {
      if (other === ore) {
        expect(high.channels.slot).toContain(ORE_SLOTS[other]);
      } else {
        expect(high.channels.slot).not.toContain(ORE_SLOTS[other]);
      }
    }
  });

  it("fits inside the mine footprint", () => {
    expect(widestReach(high)).toBeLessThanOrEqual(BUILDINGS.mine.footprint);
  });
});

describe("the default mine", () => {
  it("is a copper mine", () => {
    expect(buildBuildingModel("mine", "high").channels.slot).toContain(MaterialSlot.CopperOre);
  });
});

describe.each(ENCLOSURES)("%s pieces", (kind) => {
  it.each(LEVELS)("butt their %s ends at half a segment either side", (level) => {
    const pieces = buildEnclosurePieces(kind, level);

    expect(pieces.segmentLength).toBe(ENCLOSURE_SEGMENT_LENGTH);
    expect(pieces.segmentLength).toBeGreaterThan(0);

    for (const piece of [pieces.gate, pieces.segment]) {
      expect(piece.bounds.minimum[0]).toBeCloseTo(-pieces.segmentLength / 2, 1);
      expect(piece.bounds.maximum[0]).toBeCloseTo(pieces.segmentLength / 2, 1);
      expect(Math.abs(piece.bounds.minimum[0] + pieces.segmentLength / 2)).toBeLessThan(END_TOLERANCE);
      expect(Math.abs(piece.bounds.maximum[0] - pieces.segmentLength / 2)).toBeLessThan(END_TOLERANCE);
    }
  });

  it.each(LEVELS)("stand clean and grounded at %s detail", (level) => {
    const pieces = buildEnclosurePieces(kind, level);

    for (const piece of [pieces.gate, pieces.segment]) {
      expect(soundnessProblems(piece)).toEqual([]);
      expect(orderProblems(piece)).toEqual([]);
      expect(piece.bounds.minimum[1]).toBeLessThan(0);
    }
  });

  it("keep fewer triangles far away", () => {
    const high = buildEnclosurePieces(kind, "high");
    const low = buildEnclosurePieces(kind, "low");

    expect(triangleCount(low.segment)).toBeLessThan(triangleCount(high.segment));
    expect(triangleCount(low.gate)).toBeLessThan(triangleCount(high.gate));
  });

  it("leave a way through the gate but not through the wall", () => {
    const { gate, segment } = buildEnclosurePieces(kind, "high");

    const origin = new Vector3(0, 1.1, -3);
    const ahead = new Vector3(0, 0, 1);

    expect(outermostHit(gate, origin, ahead)).toBeNull();
    expect(outermostHit(segment, origin, ahead)).not.toBeNull();
    expect(gate.channels.slot).toContain(MaterialSlot.Accent);
  });
});

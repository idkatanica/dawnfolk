import { describe, expect, it as test } from "vitest";
import { BUILDINGS } from "../../content/buildings.ts";
import { MINED_DEPOSIT_KINDS } from "../../content/deposits.ts";
import { MaterialSlot, type MaterialSlotIndex } from "../materials.ts";
import { type MeshData, triangleCount, vertexCount } from "../mesh/mesh-data.ts";
import { highestOpenEdge, meshProblems } from "../testing/mesh-checks.ts";
import { loosePieces } from "../testing/mesh-connectivity.ts";
import { buildMineModel, type MineOre } from "./mine-model.ts";

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
  const detached = loosePieces(mesh).map((piece) => `detached ${piece}`);
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

describe.each(MINED_DEPOSIT_KINDS)("%s mine", (ore) => {
  const high = buildMineModel(ore, "high");
  const low = buildMineModel(ore, "low");

  test("builds clean, grounded geometry at both levels of detail", () => {
    expect(soundnessProblems(high)).toEqual([]);
    expect(soundnessProblems(low)).toEqual([]);
    expect(triangleCount(low)).toBeLessThan(triangleCount(high));
    expect(orderProblems(high)).toEqual([]);
  });

  test("paints the mine in the tribe colour", () => {
    expect(high.channels.slot).toContain(MaterialSlot.Accent);
    expect(low.channels.slot).toContain(MaterialSlot.Accent);
  });

  test("heaps its own ore and no other", () => {
    expect(high.channels.slot).toContain(ORE_SLOTS[ore]);

    for (const other of MINED_DEPOSIT_KINDS.filter((kind) => kind !== ore)) {
      expect(high.channels.slot).not.toContain(ORE_SLOTS[other]);
    }
  });

  test("fits inside the mine footprint", () => {
    expect(widestReach(high)).toBeLessThanOrEqual(BUILDINGS.mine.footprint);
    expect(widestReach(low)).toBeLessThanOrEqual(BUILDINGS.mine.footprint);
  });
});

import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { BUILDING_KINDS, isEnclosure } from "../../content/buildings.ts";
import { MaterialSlot } from "../materials.ts";
import { triangleCount } from "../mesh/mesh-data.ts";
import { outermostHit } from "../mesh/surface-probe.ts";
import { highestOpenEdge, meshProblems } from "../testing/mesh-checks.ts";
import { describePiece, detachedPieces } from "../testing/mesh-connectivity.ts";
import { buildBuildingModel, buildingScale, GLOW_PART } from "./building-models.ts";

const TOUCHING = 0.01;
const FLOAT_SLACK = 1e-4;
const DEEPEST_FOOTING = -0.5;

describe.each(BUILDING_KINDS)("%s model", (kind) => {
  const high = buildBuildingModel(kind, "high");
  const low = buildBuildingModel(kind, "low");

  it("builds clean geometry at both levels of detail", () => {
    expect(meshProblems(high)).toEqual([]);
    expect(meshProblems(low)).toEqual([]);
    expect(triangleCount(low)).toBeLessThan(triangleCount(high));
  });

  it("keeps every part attached to the ground at both levels of detail", () => {
    const touching = TOUCHING * buildingScale(kind) + FLOAT_SLACK;

    for (const mesh of [high, low]) {
      expect(detachedPieces(mesh, touching).map((piece) => describePiece(mesh, piece))).toEqual([]);
    }
  });

  it("closes every surface above the ground at both levels of detail", () => {
    expect(highestOpenEdge(high)).toBeLessThan(0.05);
    expect(highestOpenEdge(low)).toBeLessThan(0.05);
  });

  it("rises in stages from the ground while it is built", () => {
    const orders = [...high.channels.buildOrder];

    expect(Math.min(...orders)).toBeLessThan(0.3);
    expect(Math.max(...orders)).toBeGreaterThan(0.85);
    expect(orders.every((order) => order >= 0 && order <= 1)).toBe(true);
    expect(high.bounds.minimum[1]).toBeGreaterThan(isEnclosure(kind) ? DEEPEST_FOOTING : -0.1);
  });
});

describe("building details", () => {
  it("paints every dwelling and the totem in the tribe colour", () => {
    for (const kind of ["hut", "storehouse", "tent", "totem"] as const) {
      expect(buildBuildingModel(kind, "high").channels.slot).toContain(MaterialSlot.Accent);
    }
  });

  it("keeps the embers of a campfire in their own part", () => {
    expect(buildBuildingModel("campfire", "high").channels.part).toContain(GLOW_PART);
  });

  it.each(["high", "low"] as const)("shows the %s tent door in front of the cover", (level) => {
    const tent = buildBuildingModel("tent", level);

    const hit = outermostHit(tent, new Vector3(0, 0.5, 0), new Vector3(0, 0, 1));

    if (hit === null) {
      throw new Error("A ray from the middle of the tent should leave through its front");
    }

    expect(tent.channels.slot[tent.indices[hit.triangle * 3]]).toBe(MaterialSlot.Ash);
  });
});

import { describe, expect, it } from "vitest";
import { SocietyHarness } from "../testing/test-society.ts";
import { floodStrip, fordAcross } from "../testing/test-world.ts";
import { scoreSite, siteSearchNear } from "./settlement.ts";

describe("camp sites", () => {
  it("are only chosen where the tribe can walk before its migration runs out", () => {
    const harness = new SocietyHarness({
      world: { crossings: [fordAcross(-24, 24, 400)], dimensions: { cellSize: 10, cellsPerSide: 96 } },
    });

    floodStrip(harness.world, 20, 1.5);
    harness.navigation.rebuild();

    const origin = { x: -100, z: -300 };
    const search = siteSearchNear(origin, 900, null);

    expect(scoreSite({ x: 100, z: -300 }, search, harness.context, [])).toBe(Number.NEGATIVE_INFINITY);
    expect(scoreSite({ x: -100, z: -100 }, search, harness.context, [])).toBeGreaterThan(Number.NEGATIVE_INFINITY);
  });
});

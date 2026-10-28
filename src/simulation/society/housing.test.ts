import { describe, expect, it } from "vitest";
import { SocietyHarness, settle } from "../testing/test-society.ts";
import { housingCapacity } from "./housing.ts";

const TRIBE_SIZE = 6;

describe("housing", () => {
  it("counts housing from finished shelters only", () => {
    const harness = new SocietyHarness();

    const tribe = settle(harness, TRIBE_SIZE);

    const tent = harness.buildings.add({ kind: "tent", rotation: 0, tribeId: tribe.id, x: 30, z: 30 }, harness.random);

    tribe.buildings.shelterIds.push(tent.id);

    expect(housingCapacity(tribe, harness.context)).toBe(4);

    tent.progress = 1;

    expect(housingCapacity(tribe, harness.context)).toBe(7);
  });
});

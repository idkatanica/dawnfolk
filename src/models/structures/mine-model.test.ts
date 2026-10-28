import { describe, expect, it as test } from "vitest";
import { BUILDINGS } from "../../content/buildings.ts";
import { MINED_DEPOSIT_KINDS } from "../../content/deposits.ts";
import { MaterialSlot, type MaterialSlotIndex } from "../materials.ts";
import { triangleCount } from "../mesh/mesh-data.ts";
import { orderProblems, soundnessProblems, widestReach } from "../testing/structure-checks.ts";
import { buildMineModel, type MineOre } from "./mine-model.ts";

const ORE_SLOTS: Readonly<Record<MineOre, MaterialSlotIndex>> = {
  copper: MaterialSlot.CopperOre,
  iron: MaterialSlot.IronOre,
  tin: MaterialSlot.TinOre,
};

describe.each(MINED_DEPOSIT_KINDS)("%s mine", (ore) => {
  const high = buildMineModel(ore, "high");
  const low = buildMineModel(ore, "low");

  test("builds clean, grounded geometry at both levels of detail", () => {
    expect(soundnessProblems(high)).toEqual([]);
    expect(soundnessProblems(low)).toEqual([]);
    expect(triangleCount(low)).toBeLessThan(triangleCount(high));
    expect(orderProblems(high)).toEqual([]);
  });

  test("paints the mine in the tribe color", () => {
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

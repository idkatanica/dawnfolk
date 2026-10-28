import { describe, expect, it } from "vitest";
import { currentEra, ERAS } from "./eras.ts";
import { TECHNOLOGIES, type TechnologyId } from "./technologies.ts";

describe("eras", () => {
  it("name the era after the latest milestone", () => {
    expect(currentEra(new Set()).name).toBe("Wanderers");
    expect(currentEra(new Set<TechnologyId>(["fire", "spear"])).name).toBe("Stone Age");
    expect(currentEra(new Set<TechnologyId>(["fire", "farming", "copper", "bronze"])).name).toBe("Bronze Age");
  });

  it("climb a ladder of eras, each opened by a technology learned after the previous one", () => {
    const order = TECHNOLOGIES.map((technology) => technology.id);
    const keys = ERAS.map((era) => era.unlockedBy).filter((technology) => technology !== null);

    expect(ERAS.map((era) => era.name)).toEqual([
      "Wanderers",
      "Stone Age",
      "Neolithic",
      "Copper Age",
      "Bronze Age",
      "Iron Age",
    ]);
    expect(keys.map((technology) => order.indexOf(technology))).toEqual(
      keys.map((technology) => order.indexOf(technology)).sort((first, second) => first - second)
    );
  });
});

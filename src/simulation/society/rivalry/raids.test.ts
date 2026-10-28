import { describe, expect, it } from "vitest";
import { enclosure, foundNeighboringTribes, SPRING_HARNESS } from "../../testing/test-rivalry.ts";
import { SocietyHarness } from "../../testing/test-society.ts";
import { burnableBuilding } from "./raids.ts";

describe("a raid", () => {
  it("sets fire only to what can burn", () => {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const [victims] = foundNeighboringTribes(harness, 900);

    const wall = enclosure("stoneWall", victims, 40);
    const palisade = enclosure("palisade", victims, 40);

    expect(burnableBuilding([wall], victims)).toBeNull();
    expect(burnableBuilding([wall, palisade], victims)).toBe(palisade);
  });
});

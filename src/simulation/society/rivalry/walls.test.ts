import { describe, expect, it } from "vitest";
import { enclosure, foundNeighboringTribes, SPRING_HARNESS } from "../../testing/test-rivalry.ts";
import { SocietyHarness } from "../../testing/test-society.ts";
import { wallCover } from "./walls.ts";

describe("combat", () => {
  it("shelters defenders behind their own wall", () => {
    const harness = new SocietyHarness(SPRING_HARNESS);

    const [first, second] = foundNeighboringTribes(harness, 900);
    const [defender] = harness.society.membersOf(first);
    const [raider] = harness.society.membersOf(second);

    const palisade = enclosure("palisade", first, 40);
    const wall = enclosure("stoneWall", first, 40);

    raider.mover.x = first.campX + 60;
    raider.mover.z = first.campZ;
    defender.mover.x = first.campX + 10;
    defender.mover.z = first.campZ;

    expect(wallCover(defender, raider, [])).toBe(0);
    expect(wallCover(defender, raider, [palisade])).toBeGreaterThan(0);
    expect(wallCover(defender, raider, [palisade, wall])).toBeGreaterThan(wallCover(defender, raider, [palisade]));
    expect(wallCover(raider, defender, [palisade])).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { type AppearanceInput, personAppearance } from "./appearance.ts";

const TRIBE = { accent: 0xc8_55_3d, fur: 0x6b_4a_33, id: 3 };

function appearanceFor(overrides: Partial<AppearanceInput>) {
  return personAppearance({ age: 30, isFemale: false, seed: 0.42, tribe: TRIBE, ...overrides });
}

function seeds(count: number): number[] {
  return Array.from({ length: count }, (_, index) => (index * 0.618_033_988_7) % 1);
}

describe("person appearance", () => {
  it("gives the same person the same look every time", () => {
    expect(appearanceFor({})).toEqual(appearanceFor({}));
  });

  it("varies looks between people of one tribe", () => {
    const crowd = seeds(200).map((seed) => appearanceFor({ isFemale: seed > 0.5, seed }));

    expect(new Set(crowd.map((person) => person.hair)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(crowd.map((person) => person.outfit)).size).toBe(4);
    expect(new Set(crowd.map((person) => person.colors.skin)).size).toBeGreaterThan(60);
    expect(new Set(crowd.map((person) => person.colors.accent))).toEqual(new Set([TRIBE.accent]));
  });

  it("makes children small with large heads", () => {
    const child = appearanceFor({ age: 5 });
    const adult = appearanceFor({ age: 30 });

    expect(child.ageGroup).toBe("child");
    expect(child.body.height).toBeLessThan(adult.body.height * 0.8);
    expect(child.body.headSize).toBeGreaterThan(adult.body.headSize);
  });

  it("greys and stoops most elders", () => {
    const elders = seeds(60).map((seed) => appearanceFor({ age: 70, seed }));
    const adults = seeds(60).map((seed) => appearanceFor({ age: 30, seed }));

    function averagePosture(people: typeof elders): number {
      return people.reduce((sum, person) => sum + person.motion.posture, 0) / people.length;
    }

    expect(averagePosture(elders)).toBeGreaterThan(averagePosture(adults) * 3);
    expect(elders.filter((person) => person.colors.hair > 0x80_80_80).length).toBeGreaterThan(30);
  });

  it("gives beards only to grown men", () => {
    for (const seed of seeds(80)) {
      expect(appearanceFor({ isFemale: true, seed }).beard).toBe("none");
      expect(appearanceFor({ age: 6, seed }).beard).toBe("none");
    }
  });
});

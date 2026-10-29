import { describe, expect, it } from "vitest";
import { ANIMAL_KINDS } from "../../content/animals.ts";
import { animalAppearance } from "./animal-appearance.ts";
import { visibleAnimalParts } from "./animal-models.ts";

describe("animal appearance", () => {
  it.each(ANIMAL_KINDS)("is the same for the same %s", (kind) => {
    expect(animalAppearance({ kind, seed: 0.5, youth: 0.2 })).toEqual(
      animalAppearance({ kind, seed: 0.5, youth: 0.2 })
    );
  });

  it.each(ANIMAL_KINDS)("varies the coat and size of every %s", (kind) => {
    const herd = Array.from({ length: 12 }, (_, index) => {
      return animalAppearance({ kind, seed: index / 12, youth: 0 });
    });

    expect(
      new Set(
        herd.map((animal) => {
          return animal.coat;
        })
      ).size
    ).toBeGreaterThan(6);
    expect(
      Math.max(
        ...herd.map((animal) => {
          return animal.size;
        })
      )
    ).toBeGreaterThan(
      Math.min(
        ...herd.map((animal) => {
          return animal.size;
        })
      )
    );
  });

  it("gives ibex bucks long curved horns, does short ones and kids none", () => {
    const adults = Array.from({ length: 40 }, (_, index) => {
      return animalAppearance({ kind: "ibex", seed: index / 40, youth: 0 });
    });
    const kid = animalAppearance({ kind: "ibex", seed: 0.3, youth: 1 });

    const visible = adults.map((ibex) => {
      return visibleAnimalParts("ibex", ibex);
    });

    expect(
      visible.filter((parts) => {
        return parts.includes(2);
      }).length
    ).toBeGreaterThan(5);
    expect(
      visible.filter((parts) => {
        return parts.includes(1);
      }).length
    ).toBeGreaterThan(5);
    expect(visibleAnimalParts("ibex", kid)).not.toContain(1);
  });

  it("gives grown wolves a thick ruff now and then but never a pup", () => {
    const adults = Array.from({ length: 40 }, (_, index) => {
      return animalAppearance({ kind: "wolf", seed: index / 40, youth: 0 });
    });
    const pups = Array.from({ length: 10 }, (_, index) => {
      return animalAppearance({ kind: "wolf", seed: index / 10, youth: 0.8 });
    });

    expect(
      adults.filter((wolf) => {
        return wolf.hasRuff;
      }).length
    ).toBeGreaterThan(10);
    expect(
      pups.some((wolf) => {
        return wolf.hasRuff;
      })
    ).toBe(false);
  });

  it("gives fawns spots and no antlers", () => {
    for (let index = 0; index < 20; index += 1) {
      const fawn = animalAppearance({ kind: "deer", seed: index / 20, youth: 0.9 });

      const visible = visibleAnimalParts("deer", fawn);

      expect(fawn.hasAntlers).toBe(false);
      expect(visible).toContain(3);
      expect(fawn.size).toBeLessThan(0.6);
    }
  });

  it("grows antlers on some adult deer only", () => {
    const adults = Array.from({ length: 40 }, (_, index) => {
      return animalAppearance({ kind: "deer", seed: index / 40, youth: 0 });
    });

    const stags = adults.filter((deer) => {
      return deer.hasAntlers;
    }).length;

    expect(stags).toBeGreaterThan(5);
    expect(stags).toBeLessThan(35);
  });

  it("gives mammoth calves short tusks or none", () => {
    const calf = animalAppearance({ kind: "mammoth", seed: 0.4, youth: 1 });

    expect(calf.tuskLength).toBeLessThan(0.3);
    expect(visibleAnimalParts("mammoth", calf)).not.toContain(2);
  });
});

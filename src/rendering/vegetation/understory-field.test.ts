import { describe, expect, it } from "vitest";
import { isTreeSpecies } from "../../content/plants.ts";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { steepeningRamp } from "../../simulation/testing/test-world.ts";
import { PlantState } from "../../world/vegetation-store.ts";
import { createVegetatedMirror } from "../testing/vegetated-mirror.ts";
import { UnderstoryField } from "./understory-field.ts";

function treeCells(mirror: WorldMirror): Set<number> {
  const cells = new Set<number>();

  for (let plant = 0; plant < mirror.vegetation.count; plant += 1) {
    if (isTreeSpecies(mirror.vegetation.species[plant])) {
      cells.add(mirror.grid.cellAt(mirror.vegetation.x[plant], mirror.vegetation.z[plant]));
    }
  }

  return cells;
}

describe("understory field", () => {
  it("thins the grass under tree crowns and leaves open ground full", () => {
    const mirror = createVegetatedMirror();
    const field = new UnderstoryField(mirror);

    const shaded = treeCells(mirror);
    const open = Array.from({ length: mirror.grid.cellCount }, (_, cell) => {
      return cell;
    }).filter((cell) => {
      return !shaded.has(cell);
    });

    expect(shaded.size).toBeGreaterThan(20);
    expect(open.length).toBeGreaterThan(20);
    expect(
      Math.max(
        ...[...shaded].map((cell) => {
          return field.coverAt(cell);
        })
      )
    ).toBeLessThan(0.6);
    expect(
      open.every((cell) => {
        return field.coverAt(cell) === 1;
      })
    ).toBe(true);
  });

  it("lets the grass back once a tree is gone", () => {
    const mirror = createVegetatedMirror();
    const field = new UnderstoryField(mirror);

    const tree = Array.from({ length: mirror.vegetation.count }, (_, plant) => {
      return plant;
    }).find((plant) => {
      return isTreeSpecies(mirror.vegetation.species[plant]);
    });

    if (tree === undefined) {
      throw new Error("The test world should have trees");
    }

    const cell = mirror.grid.cellAt(mirror.vegetation.x[tree], mirror.vegetation.z[tree]);

    for (let plant = 0; plant < mirror.vegetation.count; plant += 1) {
      if (mirror.grid.cellAt(mirror.vegetation.x[plant], mirror.vegetation.z[plant]) === cell) {
        mirror.vegetation.state[plant] = PlantState.Removed;
      }
    }

    field.plantsChanged(
      Array.from({ length: mirror.vegetation.count }, (_, plant) => {
        return plant;
      })
    );

    expect(field.coverAt(cell)).toBe(1);
  });

  it("bares ground too steep for grass", () => {
    const mirror = createVegetatedMirror({ heightAt: steepeningRamp(1.4, 320) });
    const field = new UnderstoryField(mirror);

    const gentle = mirror.grid.cellAt(-300, 0);
    const steep = mirror.grid.cellAt(300, 0);

    expect(field.coverAt(steep)).toBe(0);
    expect(field.coverAt(gentle)).toBeGreaterThan(0.1);
  });
});

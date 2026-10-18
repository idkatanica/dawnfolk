import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { MaterialSlot } from "../materials.ts";
import { vertexCount } from "../mesh/mesh-data.ts";
import { outermostHit } from "../mesh/surface-probe.ts";
import { meshProblems } from "../testing/mesh-checks.ts";
import { meshCaveMouth } from "./cave-mouth.ts";

const LOOK = { base: MaterialSlot.Stone, frost: 0, moss: 0.3 };
const WIDTH = 8;
const INSIDE = new Vector3(0, 1.5, -0.5);

describe.each([0.11, 0.48, 0.93])("cave mouth %s", (seed) => {
  const cave = meshCaveMouth({ look: LOOK, rise: 9, seed, width: WIDTH });

  it("builds clean geometry", () => {
    expect(meshProblems(cave)).toEqual([]);
  });

  it("opens toward the river and leaves room for the water to come out", () => {
    expect(outermostHit(cave, INSIDE, new Vector3(0, 0, 1))).toBeNull();
  });

  it("closes the mouth with rock above and on both sides", () => {
    for (const direction of [new Vector3(0, 1, 0), new Vector3(1, 0, 0), new Vector3(-1, 0, 0)]) {
      expect(outermostHit(cave, INSIDE, direction)).not.toBeNull();
    }
  });

  it("darkens the inside so the mouth reads as depth", () => {
    const shades: number[] = [];

    for (let vertex = 0; vertex < vertexCount(cave); vertex += 1) {
      const isInside = cave.positions[vertex * 3 + 2] < -3 && Math.abs(cave.positions[vertex * 3]) < WIDTH / 2;

      if (isInside) {
        shades.push(cave.channels.shade[vertex]);
      }
    }

    expect(shades.length).toBeGreaterThan(20);
    expect(Math.min(...shades)).toBeLessThan(0.1);
  });

  it("rises above the mouth to meet the slope behind it", () => {
    expect(cave.bounds.maximum[1]).toBeGreaterThan(8);
    expect(cave.bounds.minimum[1]).toBeLessThan(0);
  });
});

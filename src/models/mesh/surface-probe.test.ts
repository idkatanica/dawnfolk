import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { MeshBuilder } from "./mesh-builder.ts";
import type { MeshData } from "./mesh-data.ts";
import { box, sphere } from "./shapes.ts";
import { outermostHit, surfaceTransform } from "./surface-probe.ts";
import { transformOf } from "./transforms.ts";

function twoBoxes(): MeshData {
  const builder = new MeshBuilder();

  builder.add(box(2, 2, 2));
  builder.add(box(2, 2, 2), { transform: transformOf({ position: [3, 0, 0] }) });

  return builder.build();
}

function rounded(vector: Vector3 | undefined): number[] {
  if (vector === undefined) {
    return [];
  }

  return vector.toArray().map((value) => {
    return Math.round(value * 1e6) / 1e6 + 0;
  });
}

describe("surface probe", () => {
  it("finds where a ray from inside leaves a closed shape", () => {
    const hit = outermostHit(box(2, 2, 2), new Vector3(), new Vector3(3, 0, 0));

    expect(hit?.distance).toBeCloseTo(1);
    expect(rounded(hit?.point)).toEqual([1, 0, 0]);
    expect(rounded(hit?.normal)).toEqual([1, 0, 0]);
  });

  it("keeps the farthest crossing when the ray passes through several shapes", () => {
    const hit = outermostHit(twoBoxes(), new Vector3(), new Vector3(1, 0, 0));

    expect(rounded(hit?.point)).toEqual([4, 0, 0]);
  });

  it("ignores the triangles left out by the filter", () => {
    const hit = outermostHit(twoBoxes(), new Vector3(), new Vector3(1, 0, 0), (triangle) => {
      return triangle < 12;
    });

    expect(rounded(hit?.point)).toEqual([1, 0, 0]);
  });

  it("finds nothing when the ray misses every triangle", () => {
    expect(outermostHit(sphere(1), new Vector3(3, 0, 0), new Vector3(0, 1, 0))).toBeNull();
  });

  it("stands a placed part on the surface along its normal", () => {
    const hit = outermostHit(box(2, 2, 2), new Vector3(), new Vector3(0, 0, 1));

    if (hit === null) {
      throw new Error("The ray should leave the box");
    }

    const transform = surfaceTransform(hit, 0.25);

    const base = new Vector3().applyMatrix4(transform);
    const up = new Vector3(0, 1, 0).applyMatrix4(transform);

    expect(rounded(base)).toEqual([0, 0, 0.75]);
    expect(rounded(up.sub(base))).toEqual([0, 0, 1]);
  });
});

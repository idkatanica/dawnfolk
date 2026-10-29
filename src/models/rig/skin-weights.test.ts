import { describe, expect, it } from "vitest";
import { chainBlend, createChain } from "./skin-weights.ts";

const chain = createChain(
  [10, 11, 12],
  [
    { axis: [0, -2, 0], blend: 0.1, position: [0, 1, 0] },
    { axis: [0, -1, 0], blend: 0.05, position: [0, 0.5, 0] },
  ]
);

describe("skin weight chains", () => {
  it("binds points far from joints to a single bone", () => {
    expect(chainBlend(chain, 0, 1.5, 0)).toEqual({ boneA: 10, boneB: 10, weight: 0 });
    expect(chainBlend(chain, 0, 0.75, 0)).toEqual({ boneA: 11, boneB: 11, weight: 0 });
    expect(chainBlend(chain, 0, 0.2, 0)).toEqual({ boneA: 12, boneB: 12, weight: 0 });
  });

  it("splits a point on a joint evenly between its bones", () => {
    const blend = chainBlend(chain, 0, 1, 0);

    expect(blend.boneA).toBe(10);
    expect(blend.boneB).toBe(11);
    expect(blend.weight).toBeCloseTo(0.5);
  });

  it("leans towards the bone a point is closer to", () => {
    expect(chainBlend(chain, 0, 1.05, 0).weight).toBeLessThan(0.5);
    expect(chainBlend(chain, 0, 0.47, 0)).toMatchObject({ boneA: 11, boneB: 12 });
    expect(chainBlend(chain, 0, 0.47, 0).weight).toBeGreaterThan(0.5);
  });

  it("refuses chains whose bones and joints do not line up", () => {
    expect(() => {
      return createChain([1, 2], []);
    }).toThrow(RangeError);
    expect(() => {
      return createChain([1, 2], [{ axis: [0, 0, 0], blend: 0.1, position: [0, 0, 0] }]);
    }).toThrow(RangeError);
  });
});

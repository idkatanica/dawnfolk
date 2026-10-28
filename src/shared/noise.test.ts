import { describe, expect, it } from "vitest";
import { createNoiseSampler } from "./noise.ts";
import { createRandom } from "./random.ts";

describe("noise sampler", () => {
  it("is deterministic and bounded", () => {
    const first = createNoiseSampler(createRandom(3));
    const second = createNoiseSampler(createRandom(3));

    for (let step = 0; step < 50; step += 1) {
      const x = step * 0.37;

      const fractal = first.fractal(x, 1.5, { octaves: 4 });
      const ridged = first.ridged(x, 1.5, { octaves: 5 });

      expect(fractal).toBe(second.fractal(x, 1.5, { octaves: 4 }));
      expect(Math.abs(fractal)).toBeLessThanOrEqual(1);
      expect(ridged).toBeGreaterThanOrEqual(0);
      expect(ridged).toBeLessThanOrEqual(1);
    }
  });
});

import { describe, expect, it } from "vitest";
import { createNoiseSampler } from "./noise.ts";
import { createRandom } from "./random.ts";

describe("seeded random", () => {
  it("repeats the same sequence for the same seed", () => {
    const first = createRandom(42);
    const second = createRandom(42);

    expect([first.next(), first.next(), first.next()]).toEqual([second.next(), second.next(), second.next()]);
  });

  it("continues the same sequence after restoring its state", () => {
    const original = createRandom(42);

    original.next();

    const restored = createRandom(1);

    restored.restore(original.state());

    expect([restored.next(), restored.next()]).toEqual([original.next(), original.next()]);
  });

  it("stays inside requested ranges", () => {
    const random = createRandom(7);

    for (let draw = 0; draw < 500; draw += 1) {
      const value = random.between(-3, 5);
      const whole = random.integer(2, 6);

      expect(value).toBeGreaterThanOrEqual(-3);
      expect(value).toBeLessThan(5);
      expect(whole).toBeGreaterThanOrEqual(2);
      expect(whole).toBeLessThan(6);
      expect(Number.isInteger(whole)).toBe(true);
    }
  });

  it("derives independent streams deterministically", () => {
    expect(createRandom(5).derive(1).next()).toBe(createRandom(5).derive(1).next());
    expect(createRandom(5).derive(1).next()).not.toBe(createRandom(5).derive(2).next());
  });

  it("spreads the first values of neighbouring seeds", () => {
    const firstValues = [1, 2, 3, 13, 90, 167, 244].map((seed) => createRandom(seed).next());

    expect(Math.min(...firstValues)).toBeLessThan(0.5);
    expect(Math.max(...firstValues) - Math.min(...firstValues)).toBeGreaterThan(0.3);
  });

  it("refuses to pick from an empty list", () => {
    expect(() => createRandom(1).pick([])).toThrow(RangeError);
  });
});

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

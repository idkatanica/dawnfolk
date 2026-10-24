import { describe, expect, it } from "vitest";
import { createRandom } from "../../shared/random.ts";
import { EffectLog } from "../effects.ts";
import { centerCell, createTestWorld } from "../testing/test-world.ts";
import { type Ember, EmberSystem } from "./embers.ts";

describe("embers", () => {
  it("fly downwind and land after their flight time", () => {
    const world = createTestWorld();
    const random = createRandom(1);
    const landed: Ember[] = [];

    const effects = new EffectLog();
    const embers = new EmberSystem(world, effects);

    const ember = embers.launch(centerCell(world), { strength: 0.8, x: 1, z: 0 }, random);

    embers.update(ember.durationSeconds / 2, (landing) => landed.push(landing));

    expect(effects.takeEffects()).toEqual([
      {
        durationSeconds: ember.durationSeconds,
        fromX: ember.fromX,
        fromZ: ember.fromZ,
        kind: "ember",
        toX: ember.toX,
        toZ: ember.toZ,
      },
    ]);
    expect(landed).toHaveLength(0);
    expect(embers.flying).toHaveLength(1);

    embers.update(ember.durationSeconds, (landing) => landed.push(landing));

    expect(landed).toEqual([ember]);
    expect(embers.flying).toHaveLength(0);
    expect(ember.toX - ember.fromX).toBeGreaterThan(10);
    expect(Math.abs(ember.toZ - ember.fromZ)).toBeLessThan(12);
  });
});

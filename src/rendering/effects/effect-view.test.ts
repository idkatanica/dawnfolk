import { describe, expect, it, vi } from "vitest";
import { WorldMirror } from "../../game/world-mirror.ts";
import type { ExplosionEffect, LightningEffect } from "../../simulation/effects.ts";
import { Simulation } from "../../simulation/simulation.ts";
import { createVegetatedWorld } from "../../simulation/testing/test-world.ts";
import { TerrainTextures } from "../terrain/terrain-textures.ts";
import { CameraAxes } from "./billboards.ts";
import { EffectView } from "./effect-view.ts";
import { GroundRing } from "./ground-ring.ts";

const LIGHTNING: LightningEffect = { isNatural: true, kind: "lightning", x: 0, z: 0 };
const EXPLOSION: ExplosionEffect = { isInWater: false, kind: "explosion", power: 2, radius: 30, x: 0, z: 0 };

function createEffects() {
  const simulation = new Simulation(createVegetatedWorld({ dimensions: { cellSize: 10, cellsPerSide: 64 } }));

  const mirror = new WorldMirror(simulation.initialWorld(), 0);

  const textures = new TerrainTextures(mirror);

  const createRing = vi.fn(() => new GroundRing(textures, mirror.grid));

  const view = new EffectView({ axes: new CameraAxes(), createRing, heightAt: () => 0, shake: vi.fn() });

  return { createRing, view };
}

function runFor(view: EffectView, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.1) {
    view.update(0.1);
  }
}

describe("effect view", () => {
  it("shows a lightning bolt until it fades", () => {
    const { view } = createEffects();

    const meshesBefore = view.group.children.length;

    view.add([LIGHTNING]);

    expect(view.group.children.length).toBe(meshesBefore + 1);
    expect(view.flash).toBeGreaterThan(0);

    runFor(view, 1);

    expect(view.group.children.length).toBe(meshesBefore);
  });

  it("reuses the ground ring of a finished explosion", () => {
    const { createRing, view } = createEffects();

    view.add([EXPLOSION]);
    runFor(view, 4);
    view.add([EXPLOSION]);

    expect(createRing).toHaveBeenCalledOnce();
  });

  it("gives overlapping explosions rings of their own", () => {
    const { createRing, view } = createEffects();

    view.add([EXPLOSION, EXPLOSION]);

    expect(createRing).toHaveBeenCalledTimes(2);
  });

  it("lets the flash of a strike fade away", () => {
    const { view } = createEffects();

    view.add([LIGHTNING]);

    const { flash } = view;

    runFor(view, 1);

    expect(view.flash).toBeLessThan(flash * 0.01);
  });
});

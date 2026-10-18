import { Vector3 } from "three/webgpu";
import { describe, expect, it } from "vitest";
import { type SightGround, terrainSight } from "./terrain-sight.ts";

const ISLAND_HALF_SIZE = 2000;
const EYE = new Vector3(0, 200, 1000);
const AGENT = new Vector3(0, 1, 0);

function sightLineHeight(z: number): number {
  return AGENT.y + ((EYE.y - AGENT.y) * (z - AGENT.z)) / (EYE.z - AGENT.z);
}

function ground(heightAt: (x: number, z: number) => number): SightGround {
  return { grid: { halfSize: ISLAND_HALF_SIZE }, heightAt };
}

describe("terrain sight", () => {
  it("sees an agent over open ground", () => {
    const flat = ground(() => 0);

    expect(terrainSight(EYE, AGENT, flat)).toBe(1);
  });

  it("loses an agent behind a ridge", () => {
    const ridge = ground((_x, z) => (Math.abs(z - 500) < 100 ? 300 : 0));

    expect(terrainSight(EYE, AGENT, ridge)).toBe(0);
  });

  it("fades an agent out while the ground grazes the line of sight", () => {
    const justBelow = ground((_x, z) => sightLineHeight(z) - 1);
    const justAbove = ground((_x, z) => sightLineHeight(z) + 1);

    const grazing = terrainSight(EYE, AGENT, justBelow);
    const buried = terrainSight(EYE, AGENT, justAbove);

    expect(grazing).toBeGreaterThan(buried);
    expect(grazing).toBeLessThan(1);
    expect(buried).toBeGreaterThan(0);
  });

  it("ignores the ground beyond the island", () => {
    const eye = new Vector3(0, 100, ISLAND_HALF_SIZE + 1000);
    const agent = new Vector3(0, 1, ISLAND_HALF_SIZE - 100);

    const cliff = ground((_x, z) => (Math.abs(z) > ISLAND_HALF_SIZE ? 5000 : 0));

    expect(terrainSight(eye, agent, cliff)).toBeGreaterThan(0.9);
  });
});

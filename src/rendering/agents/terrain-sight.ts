import type { Vector3 } from "three/webgpu";
import { lerp, smoothstep } from "../../shared/math.ts";
import type { WorldGrid } from "../../world/world-grid.ts";

export interface SightGround {
  readonly grid: Pick<WorldGrid, "halfSize">;
  readonly heightAt: (x: number, z: number) => number;
}

const SIGHT_SAMPLES = 24;
const SIGHT_REACH = 0.97;
const SMALLEST_SOFTNESS = 2;
const SOFTNESS_PER_METER = 0.004;

export function terrainSight(eye: Vector3, target: Vector3, ground: SightGround): number {
  const { halfSize } = ground.grid;

  const softness = Math.max(SMALLEST_SOFTNESS, eye.distanceTo(target) * SOFTNESS_PER_METER);

  let lowest = Number.POSITIVE_INFINITY;

  for (let sample = 1; sample <= SIGHT_SAMPLES; sample += 1) {
    const amount = (sample / SIGHT_SAMPLES) * SIGHT_REACH;

    const x = lerp(eye.x, target.x, amount);
    const z = lerp(eye.z, target.z, amount);

    if (Math.abs(x) < halfSize && Math.abs(z) < halfSize) {
      lowest = Math.min(lowest, lerp(eye.y, target.y, amount) - ground.heightAt(x, z));
    }

    if (lowest < -softness) {
      return 0;
    }
  }

  return smoothstep(-softness, softness, lowest);
}

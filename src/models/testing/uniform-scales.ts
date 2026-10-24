import type { Skeleton } from "../rig/skeleton.ts";

export function uniformScales(skeleton: Skeleton): Float32Array {
  return new Float32Array(skeleton.bones.length * 3).fill(1);
}

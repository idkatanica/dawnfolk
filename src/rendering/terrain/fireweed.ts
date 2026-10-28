import { float, smoothstep, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";
import { smoothstep as smoothstepNumber } from "../../shared/math.ts";

export const FIREWEED = vec3(0.74, 0.3, 0.56);

const FRESH_ASH = 0.6;
const FADING_ASH = 0.35;
const LAST_ASH = 0.005;
const FIRST_TRACE = 0.08;

export function bloomFor(season: number): number {
  return smoothstepNumber(0.35, 0.75, season) * (1 - smoothstepNumber(2, 2.5, season));
}

export function fireweedNode(scorch: Node<"float">, bloom: Node<"float">): Node<"float"> {
  return smoothstep(LAST_ASH, FIRST_TRACE, scorch)
    .mul(float(1).sub(smoothstep(FADING_ASH, FRESH_ASH, scorch)))
    .mul(bloom);
}

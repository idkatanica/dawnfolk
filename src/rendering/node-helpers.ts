import { cos, mx_noise_float, sin, smoothstep, uniformArray, vec3 } from "three/tsl";
import { Color, type Node, Vector3 } from "three/webgpu";
import { SLOT_COLOR_TABLE } from "../models/materials.ts";

export const SNOW_COLOR = vec3(0.86, 0.9, 0.95);

function linearColorVector(hex: number): Vector3 {
  const color = new Color(hex);

  return new Vector3(color.r, color.g, color.b);
}

export function slotColorTable() {
  return uniformArray<"vec3">(SLOT_COLOR_TABLE.map(linearColorVector), "vec3");
}

export function rotateAroundUp(vector: Node<"vec3">, angle: Node<"float">): Node<"vec3"> {
  const cosine = cos(angle);
  const sine = sin(angle);

  return vec3(vector.x.mul(cosine).add(vector.z.mul(sine)), vector.y, vector.z.mul(cosine).sub(vector.x.mul(sine)));
}

export function snowCoverNode(surface: Node<"vec4">): Node<"float"> {
  return smoothstep(0.1, 0.45, surface.r);
}

export function unitNoise3(point: Node<"vec3">): Node<"float"> {
  return mx_noise_float(point).mul(0.5).add(0.5);
}

export function unitNoise(point: Node<"vec2">): Node<"float"> {
  return unitNoise3(vec3(point, 0));
}

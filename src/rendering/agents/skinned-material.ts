import {
  attribute,
  dot,
  equal,
  Fn,
  float,
  int,
  ivec2,
  mix,
  normalize,
  normalLocal,
  positionLocal,
  select,
  varying,
  vec3,
  vec4,
} from "three/tsl";
import { MeshStandardNodeMaterial, type Node } from "three/webgpu";
import { rotateAroundUp, slotColorTable } from "../node-helpers.ts";
import type { AgentPalette } from "./agent-palette.ts";
import { colorTexel, type PaletteLayout, rootTexel, TEXELS_PER_BONE } from "./palette-layout.ts";

export function createSkinnedMaterial(palette: AgentPalette, layout: PaletteLayout): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();
  const row = int(attribute("agentRow", "float"));
  const boneA = int(attribute("boneA", "float").add(0.5));
  const boneB = int(attribute("boneB", "float").add(0.5));
  const weight = attribute("boneWeight", "float");
  const slot = int(attribute("slot", "float").add(0.5));
  const shade = attribute("shade", "float");

  function texelAt(texel: Node<"int">) {
    return palette.node.load(ivec2(texel, row));
  }

  function skin(bone: Node<"int">, vector: Node<"vec4">) {
    const first = bone.mul(TEXELS_PER_BONE);

    return vec3(dot(texelAt(first), vector), dot(texelAt(first.add(1)), vector), dot(texelAt(first.add(2)), vector));
  }

  const point = vec4(positionLocal, 1);
  const root = texelAt(int(rootTexel(layout)));

  const skinned = mix(skin(boneA, point), skin(boneB, point), weight);

  material.positionNode = Fn(() => {
    const direction = vec4(normalLocal, 0);

    const skinnedNormal = normalize(mix(skin(boneA, direction), skin(boneB, direction), weight));

    normalLocal.assign(rotateAroundUp(skinnedNormal, root.w));

    return rotateAroundUp(skinned, root.w).add(root.xyz);
  })();

  const slotColors = slotColorTable();

  const color = layout.colorSlots.reduce<Node<"vec3">>(
    (current, colorSlot, index) =>
      select(equal(slot, int(colorSlot)), texelAt(int(colorTexel(layout, index))).xyz, current),
    slotColors.element(slot)
  );

  material.colorNode = varying(color.mul(shade), "agentColor");
  material.roughnessNode = float(0.82);
  material.metalnessNode = float(0);

  return material;
}

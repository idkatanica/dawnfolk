import {
  attribute,
  cos,
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
  sin,
  uniformArray,
  varying,
  vec3,
  vec4,
} from "three/tsl";
import { Color, MeshStandardNodeMaterial, type Node, Vector3 } from "three/webgpu";
import { SLOT_COLOR_TABLE } from "../../models/materials.ts";
import type { AgentPalette } from "./agent-palette.ts";
import { colorTexel, type PaletteLayout, rootTexel, TEXELS_PER_BONE } from "./palette-layout.ts";

function linearColorVector(hex: number): Vector3 {
  const color = new Color(hex);

  return new Vector3(color.r, color.g, color.b);
}

function rotateAroundUp(vector: Node<"vec3">, angle: Node<"float">): Node<"vec3"> {
  const cosine = cos(angle);
  const sine = sin(angle);

  return vec3(vector.x.mul(cosine).add(vector.z.mul(sine)), vector.y, vector.z.mul(cosine).sub(vector.x.mul(sine)));
}

export function createSkinnedMaterial(palette: AgentPalette, layout: PaletteLayout): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();
  const row = int(attribute("agentRow", "float"));
  const boneA = int(attribute("boneA", "float").add(0.5));
  const boneB = int(attribute("boneB", "float").add(0.5));
  const weight = attribute("boneWeight", "float");
  const slot = int(attribute("slot", "float").add(0.5));
  const shade = attribute("shade", "float");

  const texelAt = (texel: Node<"int">) => palette.node.load(ivec2(texel, row));

  const skin = (bone: Node<"int">, vector: Node<"vec4">) => {
    const first = bone.mul(TEXELS_PER_BONE);

    return vec3(dot(texelAt(first), vector), dot(texelAt(first.add(1)), vector), dot(texelAt(first.add(2)), vector));
  };

  const point = vec4(positionLocal, 1);
  const root = texelAt(int(rootTexel(layout)));

  const skinned = mix(skin(boneA, point), skin(boneB, point), weight);

  material.positionNode = Fn(() => {
    const direction = vec4(normalLocal, 0);

    const skinnedNormal = normalize(mix(skin(boneA, direction), skin(boneB, direction), weight));

    normalLocal.assign(rotateAroundUp(skinnedNormal, root.w));

    return rotateAroundUp(skinned, root.w).add(root.xyz);
  })();

  const slotColors = uniformArray<"vec3">(SLOT_COLOR_TABLE.map(linearColorVector), "vec3");

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

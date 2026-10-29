import {
  abs,
  float,
  max,
  mix,
  mrt,
  normalView,
  output,
  positionView,
  screenSize,
  screenUV,
  select,
  smoothstep,
  sqrt,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type { MeshStandardNodeMaterial, Node, TextureNode, UniformNode } from "three/webgpu";

export const OUTLINE_TARGET = "outline";

const LINE_WIDTH = 1.25;
const LINE_OPACITY = 0.85;
const LINE_COLOR = vec3(0.02, 0.018, 0.016);
const FADE_START = 300;
const FADE_END = 1200;
const DEPTH_GAP_START = 0.03;
const DEPTH_GAP_END = 0.1;
const GRAZING_SLACK = 4;
const CREASE_START = 0.7;
const CREASE_END = 0.92;
const CREASE_STRENGTH = 0.55;
const KIND_GAP_START = 0.05;
const KIND_GAP_END = 0.1;
const SKY_DISTANCE = 100_000;
const NEIGHBORS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

export interface OutlineControls {
  readonly pixelRatio: UniformNode<"float", number>;
  readonly strength: UniformNode<"float", number>;
}

function surfaceOf(weight: number): Node<"vec4"> {
  return vec4(normalView.xy, positionView.z.negate(), weight);
}

function distanceOf(surface: Node<"vec4">): Node<"float"> {
  return select(surface.z.lessThan(0.001), float(SKY_DISTANCE), surface.z);
}

function normalOf(surface: Node<"vec4">): Node<"vec3"> {
  const facing = float(1).sub(surface.x.mul(surface.x)).sub(surface.y.mul(surface.y));

  return vec3(surface.x, surface.y, sqrt(max(facing, 0)));
}

export function createOutlineControls(): OutlineControls {
  return { pixelRatio: uniform(1), strength: uniform(1) };
}

export function sceneTargets() {
  return mrt({ [OUTLINE_TARGET]: surfaceOf(0), output });
}

export function markOutlined(material: MeshStandardNodeMaterial, weight = 1): void {
  material.mrtNode = mrt({ [OUTLINE_TARGET]: surfaceOf(weight) });
}

export function outlinedColor(color: TextureNode, surfaces: TextureNode, controls: OutlineControls): Node<"vec3"> {
  const step = vec2(LINE_WIDTH, LINE_WIDTH).mul(controls.pixelRatio).div(screenSize);
  const center = surfaces.sample(screenUV);
  const distance = center.z;
  const centerNormal = normalOf(center);
  const slack = float(1).add(float(1).sub(centerNormal.z).mul(GRAZING_SLACK));

  let silhouette: Node<"float"> = float(0);
  let crease: Node<"float"> = float(0);

  for (const [column, row] of NEIGHBORS) {
    const neighbor = surfaces.sample(screenUV.add(vec2(column, row).mul(step)));
    const gap = distanceOf(neighbor).sub(distance).div(distance);

    const isBehind = smoothstep(slack.mul(DEPTH_GAP_START), slack.mul(DEPTH_GAP_END), gap);
    const isOtherKind = smoothstep(KIND_GAP_START, KIND_GAP_END, center.w.sub(neighbor.w));
    const isSameSurface = float(1).sub(smoothstep(slack.mul(DEPTH_GAP_START), slack.mul(DEPTH_GAP_END), abs(gap)));
    const bend = float(1).sub(smoothstep(CREASE_START, CREASE_END, centerNormal.dot(normalOf(neighbor))));

    silhouette = max(silhouette, max(isBehind, isOtherKind));
    crease = max(crease, bend.mul(isSameSurface));
  }

  const fade = float(1).sub(smoothstep(FADE_START, FADE_END, distance));
  const edge = max(silhouette, crease.mul(CREASE_STRENGTH))
    .mul(center.w)
    .mul(fade)
    .mul(controls.strength)
    .mul(LINE_OPACITY);

  return mix(color.rgb, LINE_COLOR, edge);
}

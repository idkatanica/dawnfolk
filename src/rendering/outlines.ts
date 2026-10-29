import {
  Fn,
  float,
  ivec2,
  max,
  mix,
  mrt,
  normalView,
  output,
  positionView,
  round,
  screenCoordinate,
  select,
  smoothstep,
  sqrt,
  step,
  uniform,
  vec3,
  vec4,
} from "three/tsl";
import {
  BlendMode,
  MaterialBlending,
  type MeshStandardNodeMaterial,
  type MRTNode,
  type Node,
  type TextureNode,
  type UniformNode,
} from "three/webgpu";

export const OUTLINE_TARGET = "outline";

const LINE_WIDTH = 1.5;
const LINE_COLOR = vec3(0.015, 0.013, 0.012);
const FADE_START = 600;
const FADE_END = 900;
const DEPTH_GAP = 0.04;
const GRAZING_SLACK = 4;
const KIND_GAP = 0.5;
const SKY_DISTANCE = 100_000;
const NEAREST_DISTANCE = 0.01;
const NEIGHBORS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export interface OutlineControls {
  readonly pixelRatio: UniformNode<"float", number>;
  readonly strength: UniformNode<"float", number>;
}

function surfaceOf(isOutlined: boolean): Node<"vec4"> {
  return vec4(normalView.xy, positionView.z.negate(), isOutlined ? 1 : 0);
}

function distanceOf(surface: Node<"vec4">): Node<"float"> {
  return select(surface.z.lessThan(NEAREST_DISTANCE), float(SKY_DISTANCE), surface.z);
}

function facingOf(surface: Node<"vec4">): Node<"float"> {
  return sqrt(max(float(1).sub(surface.x.mul(surface.x)).sub(surface.y.mul(surface.y)), 0));
}

export function createOutlineControls(): OutlineControls {
  return { pixelRatio: uniform(1), strength: uniform(1) };
}

const sceneSurface = Fn(({ material }) => (material.transparent ? vec4(0) : surfaceOf(false)));

export function sceneTargets(): MRTNode {
  return mrt({ [OUTLINE_TARGET]: sceneSurface(), output }).setBlendMode(
    OUTLINE_TARGET,
    new BlendMode(MaterialBlending)
  );
}

export function markOutlined(material: MeshStandardNodeMaterial): void {
  material.mrtNode = mrt({ [OUTLINE_TARGET]: surfaceOf(true) });
}

export function outlinedColor(color: TextureNode, surfaces: TextureNode, controls: OutlineControls): Node<"vec3"> {
  const pixel = ivec2(screenCoordinate.xy);
  const width = max(round(controls.pixelRatio.mul(LINE_WIDTH)), 1).toInt();
  const center = surfaces.load(pixel);
  const distance = max(center.z, NEAREST_DISTANCE);
  const gapLimit = float(1)
    .add(float(1).sub(facingOf(center)).mul(GRAZING_SLACK))
    .mul(DEPTH_GAP);

  let edge: Node<"float"> = float(0);

  for (const [column, row] of NEIGHBORS) {
    const neighbor = surfaces.load(pixel.add(ivec2(column, row).mul(width)));
    const gap = distanceOf(neighbor).sub(distance).div(distance);

    edge = max(edge, max(step(gapLimit, gap), step(KIND_GAP, center.w.sub(neighbor.w))));
  }

  const fade = float(1).sub(smoothstep(FADE_START, FADE_END, distance));

  return mix(color.rgb, LINE_COLOR, edge.mul(center.w).mul(fade).mul(controls.strength));
}

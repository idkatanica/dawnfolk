import {
  abs,
  attribute,
  clamp,
  color,
  float,
  fwidth,
  length,
  max,
  min,
  mix,
  select,
  sign,
  smoothstep,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { CustomBlending, MeshBasicNodeMaterial, type Node, OneFactor, OneMinusSrcAlphaFactor } from "three/webgpu";
import { billboardNodes, type CameraAxes, facingBillboard } from "../effects/billboards.ts";
import { MARKER_HALO_PIXELS, MARKER_RING_PIXELS, MARKER_SELECTION_PIXELS, MarkerShape } from "./marker-look.ts";

export const MARKER_STYLE_ATTRIBUTE = "markerStyle";

export const MarkerPass = {
  Fill: 2,
  Halo: 0,
  Ring: 1,
} as const;

export type MarkerPassCode = (typeof MarkerPass)[keyof typeof MarkerPass];

interface MarkerPaint {
  readonly color: Node<"vec3">;
  readonly coverage: Node<"float">;
}

const RING_COLOR = vec3(1, 1, 1);
const SELECTION_COLOR = color(0xdd_6f_35);
const HALO_OPACITY = 0.7;
const HALO_CORE_PIXELS = 0.75;
const CORNER_ROUNDING = 1;
const ROOT_THREE = Math.sqrt(3);

function circleDistance(point: Node<"vec2">, radius: Node<"float">): Node<"float"> {
  return length(point).sub(radius);
}

function diamondDistance(point: Node<"vec2">, radius: Node<"float">): Node<"float"> {
  const turned = abs(vec2(point.x.add(point.y), point.y.sub(point.x)).mul(Math.SQRT1_2));

  const reach = turned.sub(radius.mul(Math.SQRT1_2).sub(CORNER_ROUNDING));

  return length(max(reach, 0))
    .add(min(max(reach.x, reach.y), 0))
    .sub(CORNER_ROUNDING);
}

function triangleDistance(point: Node<"vec2">, radius: Node<"float">): Node<"float"> {
  const halfSide = radius.sub(CORNER_ROUNDING).mul(ROOT_THREE / 2);

  const across = abs(point.x).sub(halfSide);
  const up = point.y.add(halfSide.div(ROOT_THREE));

  const isPastCorner = across.add(up.mul(ROOT_THREE)).greaterThan(0);

  const foldedAcross = select(isPastCorner, across.sub(up.mul(ROOT_THREE)).mul(0.5), across);
  const foldedUp = select(isPastCorner, across.mul(-ROOT_THREE).sub(up).mul(0.5), up);

  const alongEdge = foldedAcross.sub(clamp(foldedAcross, halfSide.mul(-2), 0));

  return length(vec2(alongEdge, foldedUp)).mul(sign(foldedUp)).negate().sub(CORNER_ROUNDING);
}

function shapeDistance(shape: Node<"float">, point: Node<"vec2">, radius: Node<"float">): Node<"float"> {
  const isCircle = shape.lessThan(MarkerShape.Circle + 0.5);
  const isDiamond = shape.lessThan(MarkerShape.Diamond + 0.5);

  return select(
    isCircle,
    circleDistance(point, radius),
    select(isDiamond, diamondDistance(point, radius), triangleDistance(point, radius))
  );
}

function coverageInside(edge: Node<"float">, smoothing: Node<"float">): Node<"float"> {
  return clamp(float(0.5).sub(edge.div(smoothing)), 0, 1);
}

function paintOf(pass: MarkerPassCode, edge: Node<"float">, fill: Node<"vec3">, selection: Node<"float">): MarkerPaint {
  if (pass === MarkerPass.Halo) {
    return {
      color: vec3(0, 0, 0),
      coverage: float(1)
        .sub(smoothstep(HALO_CORE_PIXELS, MARKER_HALO_PIXELS, edge))
        .mul(HALO_OPACITY),
    };
  }

  const smoothing = max(fwidth(edge), 0.001);

  const body = coverageInside(edge, smoothing);

  if (pass === MarkerPass.Ring) {
    return { color: RING_COLOR, coverage: body };
  }

  const inner = coverageInside(edge.add(MARKER_RING_PIXELS), smoothing);
  const insideSelection = coverageInside(edge.add(MARKER_SELECTION_PIXELS), smoothing);
  const insideSelectedRing = coverageInside(edge.add(MARKER_SELECTION_PIXELS + MARKER_RING_PIXELS), smoothing);

  const selected = mix(SELECTION_COLOR, mix(RING_COLOR, fill, insideSelectedRing), insideSelection);

  return {
    color: mix(fill, selected, selection),
    coverage: mix(inner, body, selection),
  };
}

export function createMarkerMaterial(
  axes: CameraAxes,
  brightness: Node<"float">,
  pass: MarkerPassCode
): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false, fog: false, transparent: true });
  const { corner, look, placement } = billboardNodes();
  const style = attribute(MARKER_STYLE_ATTRIBUTE, "vec4");

  material.blending = CustomBlending;
  material.blendSrc = OneFactor;
  material.blendDst = OneMinusSrcAlphaFactor;
  material.positionNode = facingBillboard(axes, placement.xyz, corner, placement.w);

  const shape = varying(corner, "markerCorner");
  const pixels = style.y;

  const point = vec2(shape.x, shape.y.sub(0.5)).mul(pixels);
  const radius = pixels.mul(0.5).sub(MARKER_HALO_PIXELS);

  const paint = paintOf(pass, shapeDistance(style.x, point, radius), look.xyz, style.z);

  material.colorNode = paint.color.mul(paint.coverage).mul(brightness).mul(look.w);
  material.opacityNode = paint.coverage.mul(look.w);

  return material;
}

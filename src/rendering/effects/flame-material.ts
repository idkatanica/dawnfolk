import {
  abs,
  cameraPosition,
  clamp,
  float,
  max,
  mix,
  normalize,
  pow,
  select,
  smoothstep,
  time,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { CustomBlending, MeshBasicNodeMaterial, OneFactor, OneMinusSrcAlphaFactor } from "three/webgpu";
import { unitNoise } from "../node-helpers.ts";
import { billboardNodes, type CameraAxes, facingBillboard } from "./billboards.ts";

const RIM_COLOR = vec3(0.68, 0.07, 0.008);
const BODY_COLOR = vec3(1.7, 0.41, 0.04);
const CORE_COLOR = vec3(2.4, 1.1, 0.2);
const TOP_DOWN_SQUASH = 0.42;
const SEED_SPREAD = 37;

export function createFlameMaterial(axes: CameraAxes): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ depthWrite: false, transparent: true });
  const { corner, look, placement } = billboardNodes();

  material.blending = CustomBlending;
  material.blendSrc = OneFactor;
  material.blendDst = OneMinusSrcAlphaFactor;
  material.fog = false;
  material.positionNode = facingBillboard(axes, placement.xyz, corner, placement.w);

  const downward = normalize(placement.xyz.sub(cameraPosition)).y.negate();

  const upright = varying(mix(float(1), float(TOP_DOWN_SQUASH), smoothstep(0.35, 0.97, downward)), "flameUpright");
  const shape = varying(corner, "flameCorner");
  const seed = varying(look.x.mul(SEED_SPREAD), "flameSeed");
  const strength = varying(look.y, "flameStrength");

  const across = shape.x.add(0.5);
  const along = shape.y.div(upright);
  const clock = time.mul(1.8).add(seed);

  const tip = unitNoise(vec2(across.mul(5).add(seed), clock.mul(1.4)))
    .mul(0.38)
    .add(0.62);
  const sway = unitNoise(vec2(seed.add(3), along.mul(1.3).sub(clock.mul(0.9))))
    .sub(0.5)
    .mul(0.3)
    .mul(along);
  const flicker = unitNoise(vec2(across.mul(9).sub(seed), along.mul(2.2).sub(clock.mul(2.2))))
    .mul(0.4)
    .add(0.8);

  const height = along.div(tip);
  const offset = abs(across.sub(0.5).add(sway));

  const profile = pow(max(float(1).sub(height), 0), 0.55)
    .mul(0.27)
    .mul(smoothstep(-0.04, 0.16, height));
  const inside = select(height.lessThan(1), float(1), float(0));

  const body = float(1)
    .sub(smoothstep(profile.mul(0.25), profile, offset))
    .mul(inside);

  const heat = body.mul(float(1).sub(height.mul(0.85))).mul(flicker);
  const alpha = body.mul(smoothstep(1, 0.7, height)).mul(clamp(strength.mul(1.4), 0, 1));

  const color = mix(mix(RIM_COLOR, BODY_COLOR, smoothstep(0.1, 0.55, heat)), CORE_COLOR, smoothstep(0.62, 1, heat));

  material.colorNode = color.mul(alpha);
  material.opacityNode = alpha.mul(0.75);

  return material;
}

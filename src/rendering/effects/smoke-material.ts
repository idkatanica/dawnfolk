import {
  cameraPosition,
  float,
  fract,
  length,
  mix,
  mx_noise_float,
  smoothstep,
  sqrt,
  time,
  uniform,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { MeshBasicNodeMaterial, Vector2 } from "three/webgpu";
import { billboardNodes, type CameraAxes, facingBillboard } from "./billboards.ts";

const SOOT = vec3(0.05, 0.048, 0.046);
const PALE_SMOKE = vec3(0.62, 0.62, 0.62);
const EMBER_LIGHT = vec3(1, 0.42, 0.12);
const LIGHT_PUFF_START = 12;
const HEAVY_PUFF_START = 22;
const LIGHT_PUFF_END = 60;
const HEAVY_PUFF_END = 120;
const LIGHT_OPACITY = 0.14;
const WIND_LEAN = 1.4;
const HEAVY_OPACITY = 0.34;
const NEAR_FADE_START = 15;
const NEAR_FADE_END = 140;

export class SmokeLook {
  readonly brightness = uniform(1);
  readonly wind = uniform(new Vector2(1, 0));
}

export function createSmokeMaterial(axes: CameraAxes, look: SmokeLook): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ depthWrite: false, transparent: true });
  const { corner, look: puff, placement } = billboardNodes();

  const seed = puff.x;
  const heaviness = puff.y;
  const rise = puff.z;
  const warmth = puff.w;

  const life = fract(time.mul(0.07).mul(rise).add(seed));

  const lift = life.mul(placement.w);
  const growth = sqrt(life);

  const drift = look.wind.mul(lift.mul(WIND_LEAN));
  const startSize = mix(float(LIGHT_PUFF_START), float(HEAVY_PUFF_START), heaviness);
  const endSize = mix(float(LIGHT_PUFF_END), float(HEAVY_PUFF_END), heaviness);

  const center = placement.xyz.add(vec3(drift.x, lift, drift.y));
  const size = mix(startSize, endSize, growth).mul(seed.mul(0.5).add(0.75));

  material.positionNode = facingBillboard(axes, center, corner, size);

  const shape = varying(corner, "smokeCorner");
  const age = varying(life, "smokeAge");
  const heavy = varying(heaviness, "smokeHeaviness");
  const heat = varying(warmth, "smokeWarmth");
  const distance = varying(length(center.sub(cameraPosition)), "smokeDistance");
  const puffSeed = varying(seed, "smokeSeed");

  const radius = length(vec2(shape.x, shape.y.sub(0.5))).mul(2);
  const billow = mx_noise_float(vec3(shape.mul(3).add(puffSeed.mul(17)), age.mul(1.5)))
    .mul(0.225)
    .add(0.775);

  const softness = float(1).sub(smoothstep(0, 1, radius));
  const fade = smoothstep(0, 0.1, age).mul(float(1).sub(smoothstep(0.45, 1, age)));
  const nearFade = smoothstep(NEAR_FADE_START, NEAR_FADE_END, distance);
  const shade = mix(float(0.6), float(0.22), heavy).add(age.mul(0.2));
  const cooling = float(1).sub(age);

  const albedo = mix(SOOT, PALE_SMOKE, shade);
  const light = look.brightness.mul(1.1).add(EMBER_LIGHT.mul(heat.mul(cooling.mul(cooling)).mul(0.6)));
  const opacity = mix(float(LIGHT_OPACITY), float(HEAVY_OPACITY), heavy);

  material.colorNode = albedo.mul(light);
  material.opacityNode = softness.mul(softness).mul(billow).mul(fade).mul(nearFade).mul(opacity);

  return material;
}

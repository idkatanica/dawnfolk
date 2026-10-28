import {
  cameraPosition,
  cos,
  dot,
  float,
  fract,
  length,
  max,
  mix,
  mx_noise_float,
  normalize,
  pow,
  sin,
  smoothstep,
  sqrt,
  time,
  uniform,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { MeshBasicNodeMaterial, Vector2, Vector3 } from "three/webgpu";
import { billboardNodes, type CameraAxes, distanceFromBillboardCenter, facingBillboard } from "./billboards.ts";

const SOOT = vec3(0.16, 0.15, 0.145);
const PALE_SMOKE = vec3(0.78, 0.79, 0.8);
const EMBER_LIGHT = vec3(1, 0.42, 0.12);
const LIGHT_RISE_RATE = 0.075;
const HEAVY_RISE_RATE = 0.045;
const LIGHT_START_SIZE = 2.2;
const HEAVY_START_SIZE = 9;
const LIGHT_SPREAD = 0.46;
const HEAVY_SPREAD = 0.42;
const WIND_LEAN = 0.9;
const LIGHT_OPACITY = 0.24;
const HEAVY_OPACITY = 0.42;
const SWIRL = 0.14;
const CLIMB_EASING = 1.25;
const NEAR_FADE_START = 6;
const NEAR_FADE_END = 60;
const SUN_SHARE = 0.55;

export function createSmokeMaterial(axes: CameraAxes, look: SmokeLook): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ depthWrite: false, transparent: true });
  const { corner, look: puff, placement } = billboardNodes();

  const seed = puff.x;
  const heaviness = puff.y;
  const density = puff.z;
  const warmth = puff.w;
  const height = placement.w;

  const rate = mix(float(LIGHT_RISE_RATE), float(HEAVY_RISE_RATE), heaviness);
  const life = fract(time.mul(rate).add(seed));

  const climb = float(1).sub(pow(float(1).sub(life), CLIMB_EASING));
  const lift = climb.mul(height);

  const bend = look.wind.mul(lift.mul(WIND_LEAN).mul(climb.mul(0.6).add(0.4)));
  const startSize = mix(float(LIGHT_START_SIZE), float(HEAVY_START_SIZE), heaviness);
  const spread = mix(float(LIGHT_SPREAD), float(HEAVY_SPREAD), heaviness);
  const size = startSize.add(lift.mul(spread)).mul(fract(seed.mul(7.31)).mul(0.3).add(0.85));

  const swirlPhase = time.mul(0.6).add(seed.mul(23));
  const swirl = vec2(sin(swirlPhase), cos(swirlPhase.mul(0.8))).mul(size.mul(SWIRL).mul(climb));

  const center = placement.xyz.add(vec3(bend.x.add(swirl.x), lift, bend.y.add(swirl.y)));

  material.positionNode = facingBillboard(axes, center, corner, size);

  const shape = varying(corner, "smokeCorner");
  const age = varying(life, "smokeAge");
  const heavy = varying(heaviness, "smokeHeaviness");
  const thickness = varying(density, "smokeDensity");
  const heat = varying(warmth, "smokeWarmth");
  const distance = varying(length(center.sub(cameraPosition)), "smokeDistance");
  const towardCamera = varying(normalize(cameraPosition.sub(center)), "smokeTowardCamera");
  const puffSeed = varying(fract(seed.mul(13.7)), "smokeSeed");

  const offset = vec2(shape.x, shape.y.sub(0.5)).mul(2);
  const radius = distanceFromBillboardCenter(shape).mul(2);
  const bulge = sqrt(max(float(1).sub(radius.mul(radius)), 0));
  const normal = normalize(axes.right.mul(offset.x).add(axes.up.mul(offset.y)).add(towardCamera.mul(bulge)));

  const billow = mx_noise_float(vec3(shape.mul(2.6).add(puffSeed.mul(9)), age.mul(1.2)))
    .mul(0.45)
    .add(0.65);

  const softness = float(1).sub(smoothstep(0.15, 1, radius));
  const fade = smoothstep(0, 0.03, age).mul(float(1).sub(smoothstep(0.35, 1, age)));
  const nearFade = smoothstep(NEAR_FADE_START, NEAR_FADE_END, distance);
  const thinning = mix(float(1), float(0.45), age);

  const sunFacing = max(dot(normal, look.sunDirection), 0);
  const light = look.brightness.add(
    look.sunlight.mul(sunFacing.mul(SUN_SHARE)).sub(look.sunlight.mul(SUN_SHARE * 0.4))
  );
  const shade = mix(float(0.92), float(0.28), heavy).add(age.mul(0.25));
  const cooling = float(1).sub(age);

  const albedo = mix(SOOT, PALE_SMOKE, shade);
  const glow = EMBER_LIGHT.mul(heat.mul(cooling.mul(cooling)).mul(0.5));
  const opacity = mix(float(LIGHT_OPACITY), float(HEAVY_OPACITY), heavy).mul(thickness);

  material.colorNode = albedo.mul(light).add(glow);
  material.opacityNode = softness.mul(softness).mul(billow).mul(fade).mul(nearFade).mul(thinning).mul(opacity);

  return material;
}

export class SmokeLook {
  readonly brightness = uniform(1);
  readonly sunlight = uniform(1);
  readonly sunDirection = uniform(new Vector3(0, 1, 0));
  readonly wind = uniform(new Vector2(1, 0));
}

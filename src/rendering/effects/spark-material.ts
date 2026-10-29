import { cos, float, fract, mix, sin, smoothstep, time, varying, vec2, vec3 } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { billboardNodes, type CameraAxes, distanceFromBillboardCenter, facingBillboard } from "./billboards.ts";
import { blendAsGlow } from "./glow-blending.ts";
import type { SmokeLook } from "./smoke-material.ts";

const COOL_SPARK = vec3(3.2, 0.8, 0.12);
const HOT_SPARK = vec3(6, 3, 0.9);
const SPARK_SIZE = 0.55;
const SPARK_RATE = 0.42;
const SWIRL = 2.5;

export function createSparkMaterial(axes: CameraAxes, look: SmokeLook): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ depthWrite: false, transparent: true });

  blendAsGlow(material);

  const { corner, look: spark, placement } = billboardNodes();

  const seed = spark.x;
  const heat = spark.y;

  const life = fract(time.mul(SPARK_RATE).add(seed.mul(7.3)));
  const lift = life.mul(placement.w);
  const swirl = vec2(sin(time.mul(2.3).add(seed.mul(40))), cos(time.mul(1.9).add(seed.mul(23)))).mul(life.mul(SWIRL));

  const drift = look.wind.mul(lift.mul(0.8)).add(swirl);
  const center = placement.xyz.add(vec3(drift.x, lift, drift.y));

  material.positionNode = facingBillboard(axes, center, corner, float(SPARK_SIZE).mul(float(1).sub(life.mul(0.5))));
  material.fog = false;

  const shape = varying(corner, "sparkCorner");
  const age = varying(life, "sparkAge");
  const warmth = varying(heat, "sparkHeat");

  const glow = float(1).sub(smoothstep(0, 0.5, distanceFromBillboardCenter(shape)));
  const fade = smoothstep(0, 0.08, age).mul(float(1).sub(smoothstep(0.55, 1, age)));

  material.colorNode = mix(COOL_SPARK, HOT_SPARK, warmth.mul(float(1).sub(age))).mul(glow.mul(fade));
  material.opacityNode = glow.mul(fade);

  return material;
}

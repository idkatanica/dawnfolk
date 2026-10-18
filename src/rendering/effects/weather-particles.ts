import {
  attribute,
  cameraPosition,
  float,
  fract,
  hash,
  instanceIndex,
  length,
  mix,
  sin,
  smoothstep,
  time,
  uniform,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { Mesh, MeshBasicNodeMaterial, Vector2 } from "three/webgpu";
import type { WeatherKind } from "../../content/weather.ts";
import { saturate } from "../../shared/math.ts";
import { type CameraAxes, createQuadGeometry, distanceFromBillboardCenter } from "./billboards.ts";

const BOX_SIZE = 90;
const BOX_HEIGHT = 60;
const MAXIMUM_DROPS = 9000;
const LIGHTEST_PRECIPITATION = 0.04;

type Precipitation = "rain" | "snow";

export function precipitationOf(kind: WeatherKind): Precipitation {
  if (kind === "snow" || kind === "blizzard") {
    return "snow";
  }

  return "rain";
}

export class WeatherParticles {
  readonly mesh: Mesh;
  readonly #fallSpeed = uniform(14);
  readonly #geometry = createQuadGeometry("dropCorner");
  readonly #isSnow = uniform(0);
  readonly #opacity = uniform(0.3);
  readonly #wind = uniform(new Vector2());

  constructor(axes: CameraAxes) {
    const material = new MeshBasicNodeMaterial({ depthWrite: false, transparent: true });
    const corner = attribute("dropCorner", "vec2");
    const seed = float(instanceIndex);

    const scatter = vec2(hash(seed), hash(seed.add(0.37))).mul(BOX_SIZE);

    const wrapped = fract(scatter.sub(cameraPosition.xz).div(BOX_SIZE).add(0.5)).sub(0.5).mul(BOX_SIZE);

    const fall = fract(hash(seed.add(0.71)).sub(time.mul(this.#fallSpeed).div(BOX_HEIGHT)));
    const sway = sin(time.mul(1.3).add(seed)).mul(this.#isSnow).mul(0.8);

    const height = fall.mul(BOX_HEIGHT).sub(BOX_HEIGHT * 0.45);

    const slant = this.#wind.mul(fall.mul(BOX_HEIGHT).div(this.#fallSpeed).mul(0.12));

    const center = vec3(
      cameraPosition.x.add(wrapped.x).add(slant.x).add(sway),
      cameraPosition.y.add(height),
      cameraPosition.z.add(wrapped.y).add(slant.y)
    );

    const width = mix(float(0.03), float(0.14), this.#isSnow);
    const tall = mix(float(1.1), float(0.14), this.#isSnow);
    const slabFade = smoothstep(0, 0.15, fall).mul(smoothstep(1, 0.85, fall));
    const rangeFade = smoothstep(BOX_SIZE * 0.5, BOX_SIZE * 0.3, length(wrapped));

    material.positionNode = center
      .add(axes.right.mul(corner.x.mul(width)))
      .add(vec3(0, 1, 0).mul(corner.y.mul(tall)))
      .add(vec3(this.#wind.x, 0, this.#wind.y).mul(corner.y.mul(0.03)));

    const shape = varying(corner, "dropCorner");
    const fade = varying(slabFade.mul(rangeFade), "dropFade");

    const softness = smoothstep(0.5, 0.1, distanceFromBillboardCenter(shape));
    const streak = smoothstep(0, 0.45, shape.y).mul(smoothstep(1, 0.7, shape.y));

    material.colorNode = mix(vec3(0.72, 0.78, 0.86), vec3(1, 1, 1), this.#isSnow);
    material.opacityNode = mix(streak, softness, this.#isSnow).mul(fade).mul(this.#opacity);

    this.mesh = new Mesh(this.#geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11;
    this.mesh.visible = false;
  }

  update(precipitation: number, kind: Precipitation, windX: number, windZ: number): void {
    const strength = saturate((precipitation - LIGHTEST_PRECIPITATION) / (1 - LIGHTEST_PRECIPITATION));
    const isSnow = kind === "snow";

    const count = Math.round(strength * MAXIMUM_DROPS);

    this.#geometry.instanceCount = count;
    this.mesh.visible = count > 0;
    this.#isSnow.value = isSnow ? 1 : 0;
    this.#fallSpeed.value = isSnow ? 2.2 : 15;
    this.#opacity.value = isSnow ? 0.85 : 0.32;
    this.#wind.value.set(windX, windZ);
  }

  dispose(): void {
    this.#geometry.dispose();
  }
}

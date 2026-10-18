import {
  attribute,
  cameraPosition,
  distance,
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
import {
  Float32BufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  Uint16BufferAttribute,
  Vector2,
  Vector3,
} from "three/webgpu";
import type { WeatherKind } from "../../content/weather.ts";
import { clamp } from "../../shared/math.ts";
import type { CameraAxes } from "./billboards.ts";

const NEAREST_BOX = 90;
const FARTHEST_BOX = 900;
const BOX_PER_DISTANCE = 0.75;
const BOX_HEIGHT_SHARE = 0.65;
const MAXIMUM_DROPS = 12_000;
const LIGHTEST_PRECIPITATION = 0.04;

export type Precipitation = "rain" | "snow";

export function precipitationOf(kind: WeatherKind): Precipitation {
  if (kind === "snow" || kind === "blizzard") {
    return "snow";
  }

  return "rain";
}

function createStreakGeometry(): InstancedBufferGeometry {
  const geometry = new InstancedBufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(12), 3));
  geometry.setAttribute("dropCorner", new Float32BufferAttribute([-0.5, 0, 0.5, 0, 0.5, 1, -0.5, 1], 2));
  geometry.setIndex(new Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1));
  geometry.instanceCount = 0;

  return geometry;
}

export interface WeatherView {
  readonly focus: Vector3;
  readonly viewDistance: number;
}

export class WeatherParticles {
  readonly mesh: Mesh;
  readonly #anchor = uniform(new Vector3());
  readonly #boxSize = uniform(NEAREST_BOX);
  readonly #fallSpeed = uniform(14);
  readonly #geometry = createStreakGeometry();
  readonly #isSnow = uniform(0);
  readonly #opacity = uniform(0.3);
  readonly #wind = uniform(new Vector2());

  constructor(axes: CameraAxes) {
    const material = new MeshBasicNodeMaterial({ depthWrite: false, transparent: true });
    const corner = attribute("dropCorner", "vec2");
    const seed = float(instanceIndex);
    const boxSize = this.#boxSize;
    const boxHeight = boxSize.mul(BOX_HEIGHT_SHARE);
    const scale = boxSize.div(NEAREST_BOX);

    const scatter = vec2(hash(seed), hash(seed.add(0.37))).mul(boxSize);

    const wrapped = fract(scatter.sub(this.#anchor.xz).div(boxSize).add(0.5)).sub(0.5).mul(boxSize);

    const fall = fract(hash(seed.add(0.71)).sub(time.mul(this.#fallSpeed).mul(scale).div(boxHeight)));
    const sway = sin(time.mul(1.3).add(seed)).mul(this.#isSnow).mul(scale.mul(0.8));

    const height = fall.mul(boxHeight).sub(boxHeight.mul(0.15));

    const slant = this.#wind.mul(fall.mul(boxHeight).div(this.#fallSpeed.mul(scale)).mul(0.12));

    const center = vec3(
      this.#anchor.x.add(wrapped.x).add(slant.x).add(sway),
      this.#anchor.y.add(height),
      this.#anchor.z.add(wrapped.y).add(slant.y)
    );

    const width = mix(float(0.05), float(0.16), this.#isSnow).mul(scale);
    const tall = mix(float(1.4), float(0.16), this.#isSnow).mul(scale);
    const slabFade = smoothstep(0, 0.15, fall).mul(smoothstep(1, 0.85, fall));
    const rangeFade = smoothstep(boxSize.mul(0.5), boxSize.mul(0.3), length(wrapped));
    const lensFade = smoothstep(boxSize.mul(0.04), boxSize.mul(0.12), distance(center, cameraPosition));

    material.positionNode = center
      .add(axes.right.mul(corner.x.mul(width)))
      .add(vec3(0, 1, 0).mul(corner.y.mul(tall)))
      .add(vec3(this.#wind.x, 0, this.#wind.y).mul(corner.y.mul(0.03).mul(scale)));

    const shape = varying(corner, "dropCorner");
    const fade = varying(slabFade.mul(rangeFade).mul(lensFade), "dropFade");

    const softness = smoothstep(0.5, 0.1, length(vec2(shape.x, shape.y.sub(0.5))));
    const streak = smoothstep(0, 0.45, shape.y).mul(smoothstep(1, 0.7, shape.y));

    material.colorNode = mix(vec3(0.72, 0.78, 0.86), vec3(1, 1, 1), this.#isSnow);
    material.opacityNode = mix(streak, softness, this.#isSnow).mul(fade).mul(this.#opacity);

    this.mesh = new Mesh(this.#geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11;
    this.mesh.visible = false;
  }

  update(precipitation: number, kind: Precipitation, windX: number, windZ: number, view: WeatherView): void {
    const strength = clamp((precipitation - LIGHTEST_PRECIPITATION) / (1 - LIGHTEST_PRECIPITATION), 0, 1);
    const isSnow = kind === "snow";

    const count = Math.round(strength * MAXIMUM_DROPS);

    this.#geometry.instanceCount = count;
    this.mesh.visible = count > 0;
    this.#anchor.value.copy(view.focus);
    this.#boxSize.value = clamp(view.viewDistance * BOX_PER_DISTANCE, NEAREST_BOX, FARTHEST_BOX);
    this.#isSnow.value = isSnow ? 1 : 0;
    this.#fallSpeed.value = isSnow ? 2.2 : 15;
    this.#opacity.value = isSnow ? 0.85 : 0.45;
    this.#wind.value.set(windX, windZ);
  }

  dispose(): void {
    this.#geometry.dispose();
  }
}

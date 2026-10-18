import {
  abs,
  attribute,
  cameraPosition,
  clamp,
  cos,
  distance,
  dot,
  float,
  fract,
  hash,
  instanceIndex,
  length,
  mix,
  normalize,
  sin,
  smoothstep,
  time,
  uniform,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import {
  Color,
  Float32BufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  type PerspectiveCamera,
  Uint16BufferAttribute,
  Vector2,
  Vector3,
} from "three/webgpu";
import { fallsAsSnow, type WeatherKind } from "../../content/weather.ts";
import { clamp as clampNumber } from "../../shared/math.ts";
import type { CameraAxes } from "./billboards.ts";

const NEAREST_SPAN = 70;
const SPAN_PER_DISTANCE = 1.6;
const HEIGHT_PER_SPAN = 0.45;
const NATURAL_SPAN = 96;
const SHARE_BELOW_FOCUS = 0.25;
const MAXIMUM_DROPS = 20_000;
const LIGHTEST_PRECIPITATION = 0.04;
const RANDOMS_PER_DROP = 4;

export type Precipitation = "rain" | "snow";

export function precipitationOf(kind: WeatherKind, temperature: number): Precipitation {
  if (fallsAsSnow(kind, temperature)) {
    return "snow";
  }

  return "rain";
}

export function precipitationStrength(precipitation: number): number {
  return clampNumber((precipitation - LIGHTEST_PRECIPITATION) / (1 - LIGHTEST_PRECIPITATION), 0, 1);
}

interface PrecipitationLook {
  readonly color: number;
  readonly countShare: number;
  readonly fallSpeed: number;
  readonly longest: number;
  readonly opacity: number;
  readonly shortest: number;
  readonly size: number;
  readonly sway: number;
  readonly thickest: number;
  readonly thinnest: number;
  readonly windShare: number;
}

const LOOKS: Readonly<Record<Precipitation, PrecipitationLook>> = {
  rain: {
    color: 0xc8_d2_de,
    countShare: 1,
    fallSpeed: 26,
    longest: 0.04,
    opacity: 0.5,
    shortest: 0.013,
    size: 0.016,
    sway: 0,
    thickest: 0.0028,
    thinnest: 0.0015,
    windShare: 1.6,
  },
  snow: {
    color: 0xff_ff_ff,
    countShare: 1,
    fallSpeed: 2.6,
    longest: 0.011,
    opacity: 0.9,
    shortest: 0.0042,
    size: 0.09,
    sway: 0.7,
    thickest: 0.011,
    thinnest: 0.0042,
    windShare: 1,
  },
};

export interface WeatherView {
  readonly camera: PerspectiveCamera;
  readonly focus: Vector3;
  readonly realSeconds: number;
  readonly viewDistance: number;
}

export interface Precipitating {
  readonly brightness: number;
  readonly form: Precipitation;
  readonly precipitation: number;
  readonly windX: number;
  readonly windZ: number;
}

function createDropGeometry(): InstancedBufferGeometry {
  const geometry = new InstancedBufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(12), 3));
  geometry.setAttribute("dropCorner", new Float32BufferAttribute([-0.5, 0, 0.5, 0, 0.5, 1, -0.5, 1], 2));
  geometry.setIndex(new Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1));
  geometry.instanceCount = 0;

  return geometry;
}

export class WeatherParticles {
  readonly mesh: Mesh;
  readonly #anchor = uniform(new Vector3());
  readonly #color = uniform(new Color());
  readonly #drift = uniform(new Vector2());
  readonly #fallen = uniform(0);
  readonly #geometry = createDropGeometry();
  readonly #height = uniform(NEAREST_SPAN * HEIGHT_PER_SPAN);
  readonly #isSnow = uniform(0);
  readonly #longest = uniform(LOOKS.rain.longest);
  readonly #opacity = uniform(LOOKS.rain.opacity);
  readonly #scale = uniform(1);
  readonly #shortest = uniform(LOOKS.rain.shortest);
  readonly #size = uniform(LOOKS.rain.size);
  readonly #slant = uniform(new Vector2());
  readonly #span = uniform(NEAREST_SPAN);
  readonly #sway = uniform(0);
  readonly #thickest = uniform(LOOKS.rain.thickest);
  readonly #thinnest = uniform(LOOKS.rain.thinnest);
  readonly #viewportSpan = uniform(1);

  constructor(axes: CameraAxes) {
    const material = new MeshBasicNodeMaterial({ depthWrite: false, fog: false, transparent: true });
    const corner = attribute("dropCorner", "vec2");
    const first = instanceIndex.mul(RANDOMS_PER_DROP);
    const random = (salt: number) => hash(first.add(salt));

    const span = this.#span;
    const height = this.#height;

    const spread = vec2(random(0), random(1));
    const phase = random(2);
    const variety = random(3);

    const around = fract(spread.add(this.#drift).sub(this.#anchor.xz.div(span)).add(0.5)).sub(0.5);
    const fall = fract(phase.add(this.#fallen));
    const swirl = vec2(sin(time.mul(0.9).add(phase.mul(40))), cos(time.mul(0.7).add(variety.mul(30))));

    const offset = around.mul(span).add(swirl.mul(this.#sway));
    const altitude = float(1).sub(fall).sub(SHARE_BELOW_FOCUS).mul(height);

    const center = vec3(this.#anchor.x.add(offset.x), this.#anchor.y.add(altitude), this.#anchor.z.add(offset.y));

    const viewportMeters = distance(center, cameraPosition).mul(this.#viewportSpan);
    const natural = this.#size.mul(this.#scale).mul(variety.mul(0.6).add(0.7));
    const streakAxis = normalize(vec3(this.#slant.x.negate(), 1, this.#slant.y.negate()));

    const streakLength = clamp(
      natural.mul(mix(float(60), float(1), this.#isSnow)),
      viewportMeters.mul(this.#shortest),
      viewportMeters.mul(this.#longest)
    );
    const width = clamp(natural, viewportMeters.mul(this.#thinnest), viewportMeters.mul(this.#thickest));
    const axis = normalize(mix(streakAxis, axes.up, this.#isSnow));

    const side = normalize(axes.right.sub(axis.mul(dot(axes.right, axis))));

    material.positionNode = center
      .add(side.mul(corner.x.mul(width)))
      .add(axis.mul(corner.y.sub(0.5).mul(mix(streakLength, width, this.#isSnow))));

    const slabFade = smoothstep(0, 0.12, fall).mul(smoothstep(1, 0.85, fall));
    const rangeFade = smoothstep(0.5, 0.36, length(around));
    const lensFade = smoothstep(span.mul(0.015), span.mul(0.05), distance(center, cameraPosition));

    const shape = varying(corner, "dropCorner");
    const fade = varying(slabFade.mul(rangeFade).mul(lensFade), "dropFade");

    const across = smoothstep(0.5, 0.15, abs(shape.x));
    const streak = across.mul(smoothstep(0, 0.15, shape.y)).mul(smoothstep(1, 0.35, shape.y));
    const flake = smoothstep(0.5, 0.2, length(vec2(shape.x, shape.y.sub(0.5))));

    material.colorNode = this.#color;
    material.opacityNode = mix(streak, flake, this.#isSnow).mul(fade).mul(this.#opacity);

    this.mesh = new Mesh(this.#geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11;
    this.mesh.visible = false;
  }

  update(weather: Precipitating, view: WeatherView): void {
    const strength = precipitationStrength(weather.precipitation);
    const look = LOOKS[weather.form];

    const count = Math.round(strength * MAXIMUM_DROPS * look.countShare);

    this.#geometry.instanceCount = count;
    this.mesh.visible = count > 0;

    if (count === 0) {
      return;
    }

    const span = Math.max(NEAREST_SPAN, view.viewDistance * SPAN_PER_DISTANCE);
    const scale = Math.max(1, span / NATURAL_SPAN);
    const height = span * HEIGHT_PER_SPAN;
    const seconds = view.realSeconds;

    const driftX = weather.windX * look.windShare * scale;
    const driftZ = weather.windZ * look.windShare * scale;

    this.#anchor.value.copy(view.focus);
    this.#span.value = span;
    this.#height.value = height;
    this.#scale.value = scale;
    this.#fallen.value = (this.#fallen.value + (look.fallSpeed * scale * seconds) / height) % 1;
    this.#drift.value.set(
      (this.#drift.value.x + (driftX * seconds) / span) % 1,
      (this.#drift.value.y + (driftZ * seconds) / span) % 1
    );
    this.#slant.value.set(driftX / (look.fallSpeed * scale), driftZ / (look.fallSpeed * scale));
    this.#viewportSpan.value = 2 * Math.tan((view.camera.fov * Math.PI) / 360);
    this.#isSnow.value = weather.form === "snow" ? 1 : 0;
    this.#color.value.setHex(look.color).multiplyScalar(weather.brightness);
    this.#opacity.value = look.opacity * (0.55 + strength * 0.45);
    this.#size.value = look.size;
    this.#sway.value = look.sway * scale;
    this.#shortest.value = look.shortest;
    this.#longest.value = look.longest;
    this.#thinnest.value = look.thinnest;
    this.#thickest.value = look.thickest;
  }

  dispose(): void {
    this.#geometry.dispose();
  }
}

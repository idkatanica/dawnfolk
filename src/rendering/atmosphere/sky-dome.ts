import {
  abs,
  cameraPosition,
  dot,
  Fn,
  float,
  floor,
  fract,
  If,
  length,
  max,
  mix,
  mx_fractal_noise_float,
  normalize,
  positionWorld,
  pow,
  select,
  sin,
  smoothstep,
  step,
  time,
  uniform,
  vec2,
  vec3,
} from "three/tsl";
import {
  BackSide,
  Color,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three/webgpu";

const DOME_RADIUS = 30_000;
const STAR_CELLS_PER_FACE = 150;
const STAR_SHARE = 0.16;
const CLOUD_HORIZON = 0.015;

function starHash(seed: Node<"vec3">, salt: number): Node<"float"> {
  const mixed = dot(seed.add(salt * 19.19), vec3(12.9898, 78.233, 37.719));

  return fract(sin(mixed.mod(6283.185)).mul(43_758.5453));
}

function starField(direction: Node<"vec3">) {
  const absolute = abs(direction);

  const isSideX = absolute.x.greaterThan(max(absolute.y, absolute.z));
  const isTopY = absolute.y.greaterThan(absolute.z);

  const faceCoordinates = select(
    isSideX,
    direction.yz.div(absolute.x),
    select(isTopY, direction.xz.div(absolute.y), direction.xy.div(absolute.z))
  );

  const faceIndex = select(isSideX, float(1), select(isTopY, float(2), float(3)));
  const scaled = faceCoordinates.mul(STAR_CELLS_PER_FACE).add(STAR_CELLS_PER_FACE * 2);

  const cell = floor(scaled);

  const seed = vec3(cell, faceIndex.mul(97.31));

  const presence = starHash(seed, 0);
  const offset = vec2(starHash(seed, 1), starHash(seed, 2)).sub(0.5).mul(0.6);
  const brightness = starHash(seed, 3);

  const distanceToStar = length(fract(scaled).sub(0.5).sub(offset));
  const twinkle = sin(time.mul(brightness.mul(3).add(1.2)).add(brightness.mul(40)))
    .mul(0.25)
    .add(0.75);

  const shape = smoothstep(0.24, 0.02, distanceToStar);

  return vec3(0.85, 0.9, 1).mul(
    shape
      .mul(step(1 - STAR_SHARE, presence))
      .mul(brightness.mul(1.6).add(0.3))
      .mul(twinkle)
  );
}

export class SkyDome {
  readonly abyssColor = uniform(new Color(0x7f_93_ad));
  readonly cloudCover = uniform(0.35);
  readonly cloudLitColor = uniform(new Color(0xff_ff_ff));
  readonly cloudOffset = uniform(new Vector2());
  readonly cloudShadeColor = uniform(new Color(0xb4_bf_cc));
  readonly horizonColor = uniform(new Color(0xc8_dc_ec));
  readonly mesh: Mesh;
  readonly moonDirection = uniform(new Vector3(0, -1, 0));
  readonly moonVisibility = uniform(0);
  readonly starVisibility = uniform(0);
  readonly sunColor = uniform(new Color(0xff_f4_e2));
  readonly sunDirection = uniform(new Vector3(0, 1, 0));
  readonly sunVisibility = uniform(1);
  readonly zenithColor = uniform(new Color(0x5f_93_d0));

  constructor() {
    const material = new MeshBasicNodeMaterial({ depthWrite: false, fog: false, side: BackSide });

    material.colorNode = this.#skyColor();
    this.mesh = new Mesh(new SphereGeometry(DOME_RADIUS, 16, 8), material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }

  #skyColor() {
    return Fn(() => {
      const direction = normalize(positionWorld.sub(cameraPosition));

      const height = direction.y;

      const sky = mix(this.horizonColor, this.zenithColor, pow(max(height, 0), 0.5));
      const abyss = mix(this.horizonColor, this.abyssColor, smoothstep(0, 0.45, height.negate()));

      const color = mix(abyss, sky, step(0, height)).toVar();

      If(height.greaterThanEqual(0).and(this.starVisibility.greaterThan(0)), () => {
        color.addAssign(starField(direction).mul(this.starVisibility));
      });

      If(height.greaterThan(CLOUD_HORIZON), () => {
        color.assign(this.#clouds(direction, color));
      });

      return color.add(this.#sun(direction)).add(this.#moon(direction));
    })();
  }

  #sun(direction: Node<"vec3">) {
    const alignment = max(dot(direction, this.sunDirection), 0);

    const disc = smoothstep(0.999_45, 0.9997, alignment);
    const glow = pow(alignment, 10).mul(0.28).add(pow(alignment, 220).mul(0.7));

    return this.sunColor.mul(disc.mul(5).add(glow)).mul(this.sunVisibility);
  }

  #moon(direction: Node<"vec3">) {
    const alignment = max(dot(direction, this.moonDirection), 0);

    const disc = smoothstep(0.9995, 0.999_68, alignment);
    const glow = pow(alignment, 400).mul(0.25);

    return vec3(0.92, 0.94, 1).mul(disc.mul(1.6).add(glow)).mul(this.moonVisibility);
  }

  #clouds(direction: Node<"vec3">, background: Node<"vec3">) {
    const height = max(direction.y, 0);
    const threshold = float(1).sub(this.cloudCover).mul(0.75).add(0.18);
    const horizonFade = smoothstep(CLOUD_HORIZON, 0.2, direction.y);
    const sunSide = dot(normalize(vec3(direction.x, 0.25, direction.z)), this.sunDirection)
      .mul(0.5)
      .add(0.5);

    const projected = direction.xz.div(height.add(0.12)).mul(0.9).sub(this.cloudOffset);

    const density = mx_fractal_noise_float(vec3(projected, time.mul(0.004)), 4, 2.1, 0.5)
      .mul(0.5)
      .add(0.5);
    const detail = mx_fractal_noise_float(vec3(projected.mul(3.1), time.mul(0.01)), 2, 2, 0.5).mul(0.08);

    const coverage = smoothstep(threshold, threshold.add(0.22), density.add(detail));
    const shade = smoothstep(threshold, threshold.add(0.5), density);

    const lit = mix(this.cloudLitColor, this.cloudShadeColor, shade.mul(0.85).add(sunSide.oneMinus().mul(0.15)));

    return mix(background, lit, coverage.mul(horizonFade).mul(0.92));
  }
}

import {
  abs,
  attribute,
  cameraPosition,
  clamp,
  cos,
  distance,
  dot,
  float,
  floor,
  ivec2,
  length,
  max,
  mix,
  normalize,
  select,
  sin,
  smoothstep,
  textureLoad,
  time,
  uint,
  uniform,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import {
  Color,
  Float32BufferAttribute,
  Group,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  type PerspectiveCamera,
  Uint16BufferAttribute,
  Vector2,
  type Vector3,
} from "three/webgpu";
import { fallsAsSnow, type WeatherKind } from "../../content/weather.ts";
import { clamp as clampNumber } from "../../shared/math.ts";
import type { WorldGrid } from "../../world/world-grid.ts";
import { sampleHeightNode } from "../terrain/height-sampling.ts";
import type { TerrainTextures } from "../terrain/terrain-textures.ts";
import type { CameraAxes } from "./billboards.ts";
import { type LatticeArea, LatticeCover, latticeElement, scramble, unitHash } from "./precipitation-lattice.ts";

const NEAREST_SPAN = 70;
const SPAN_PER_DISTANCE = 1.6;
const NATURAL_VIEW = 60;
const NATURAL_SPAN = NATURAL_VIEW * SPAN_PER_DISTANCE;
const TILE_SIZE = 12;
const COLUMN_HEIGHT = 43;
const DROPS_PER_TILE = 312;
const RANGE_FADE_START = 0.72;
const LIGHTEST_PRECIPITATION = 0.04;
const FAINTEST_DROP = 0.002;
const CYCLES = 256;
const SALT_OCTAVE = 0x9e_37_79_b9;
const SALT_PHASE = 0x3c_6e_f3_72;
const SALT_VARIETY = 0xa5_4f_f5_3a;
const SALT_CYCLE = 0x51_0e_52_7f;
const SALT_ACROSS = 0x9b_05_68_8c;
const SALT_ALONG = 0x1f_83_d9_ab;

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

class DropUniforms {
  readonly color = uniform(new Color());
  readonly driftShare = uniform(new Vector2());
  readonly fallen = uniform(0);
  readonly focus = uniform(new Vector2());
  readonly isSnow = uniform(0);
  readonly longest = uniform(LOOKS.rain.longest);
  readonly opacity = uniform(LOOKS.rain.opacity);
  readonly reach = uniform(NEAREST_SPAN / 2);
  readonly shortest = uniform(LOOKS.rain.shortest);
  readonly size = uniform(LOOKS.rain.size);
  readonly slant = uniform(new Vector2());
  readonly span = uniform(NEAREST_SPAN);
  readonly sway = uniform(0);
  readonly thickest = uniform(LOOKS.rain.thickest);
  readonly thinnest = uniform(LOOKS.rain.thinnest);
  readonly viewportSpan = uniform(1);
}

interface DropSources {
  readonly axes: CameraAxes;
  readonly grid: WorldGrid;
  readonly textures: TerrainTextures;
  readonly uniforms: DropUniforms;
}

function createDropGeometry(): InstancedBufferGeometry {
  const geometry = new InstancedBufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(12), 3));
  geometry.setAttribute("dropCorner", new Float32BufferAttribute([-0.5, 0, 0.5, 0, 0.5, 1, -0.5, 1], 2));
  geometry.setIndex(new Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1));
  geometry.instanceCount = 0;

  return geometry;
}

class DropOctave {
  readonly mesh: Mesh;
  readonly #cover = new LatticeCover();
  readonly #geometry = createDropGeometry();
  readonly #level = uniform(0);
  readonly #material = new MeshBasicNodeMaterial({ depthWrite: false, fog: false, transparent: true });
  readonly #scale = uniform(1);

  constructor({ axes, grid, textures, uniforms }: DropSources) {
    const material = this.#material;
    const corner = attribute("dropCorner", "vec2");
    const last = grid.cellsPerSide - 1;
    const scale = this.#scale;

    const element = latticeElement(this.#cover, uint(this.#level).mul(SALT_OCTAVE));

    const phase = unitHash(element.seed, SALT_PHASE);
    const variety = unitHash(element.seed, SALT_VARIETY);
    const tileSize = scale.mul(TILE_SIZE);
    const columnHeight = scale.mul(COLUMN_HEIGHT);

    const progress = phase.add(uniforms.fallen);

    const cycle = floor(progress);

    const fall = progress.sub(cycle);
    const cycleSeed = scramble(
      element.seed.add(
        uint(cycle)
          .bitAnd(CYCLES - 1)
          .mul(SALT_CYCLE)
      )
    );

    const spread = vec2(unitHash(cycleSeed, SALT_ACROSS), unitHash(cycleSeed, SALT_ALONG));
    const height = columnHeight.mul(float(1).sub(fall));
    const swirl = vec2(sin(time.mul(0.9).add(phase.mul(40))), cos(time.mul(0.7).add(variety.mul(30))));

    const place = element.tile.add(spread).add(uniforms.driftShare).mul(tileSize);
    const wander = swirl.mul(uniforms.sway).mul(scale);

    const landing = place.add(uniforms.slant.mul(height));

    const cell = ivec2(clamp(floor(landing.add(grid.halfSize).div(grid.cellSize)), vec2(0, 0), vec2(last, last)));

    const surface = max(sampleHeightNode(textures.height, grid, landing), textureLoad(textures.water, cell).x);

    const center = vec3(place.x.add(wander.x), surface.add(height), place.y.add(wander.y));

    const viewportMeters = distance(center, cameraPosition).mul(uniforms.viewportSpan);
    const natural = uniforms.size.mul(scale).mul(variety.mul(0.6).add(0.7));
    const streakAxis = normalize(vec3(uniforms.slant.x.negate(), 1, uniforms.slant.y.negate()));
    const isOnIsland = max(abs(landing.x), abs(landing.y)).lessThan(grid.halfSize);

    const streakLength = clamp(
      natural.mul(mix(float(60), float(1), uniforms.isSnow)),
      viewportMeters.mul(uniforms.shortest),
      viewportMeters.mul(uniforms.longest)
    );
    const width = clamp(natural, viewportMeters.mul(uniforms.thinnest), viewportMeters.mul(uniforms.thickest));
    const axis = normalize(mix(streakAxis, axes.up, uniforms.isSnow));

    const side = normalize(axes.right.sub(axis.mul(dot(axes.right, axis))));

    const slabFade = smoothstep(0, 0.12, fall);
    const rangeFade = smoothstep(
      uniforms.reach,
      uniforms.reach.mul(RANGE_FADE_START),
      length(place.sub(uniforms.focus))
    );
    const lensFade = smoothstep(uniforms.span.mul(0.015), uniforms.span.mul(0.05), distance(center, cameraPosition));

    const visibility = element.presence
      .mul(slabFade)
      .mul(rangeFade)
      .mul(lensFade)
      .mul(select(isOnIsland, float(1), float(0)));

    const extent = select(visibility.greaterThan(FAINTEST_DROP), float(1), float(0));
    const rise = corner.y.sub(uniforms.isSnow.mul(0.5)).mul(mix(streakLength, width, uniforms.isSnow));

    material.positionNode = center.add(side.mul(corner.x.mul(width).mul(extent))).add(axis.mul(rise.mul(extent)));

    const shape = varying(corner, "dropCorner");
    const fade = varying(visibility, "dropFade");

    const across = smoothstep(0.5, 0.15, abs(shape.x));
    const streak = across.mul(smoothstep(0, 0.15, shape.y)).mul(smoothstep(1, 0.35, shape.y));
    const flake = smoothstep(0.5, 0.2, length(vec2(shape.x, shape.y.sub(0.5))));

    material.colorNode = uniforms.color;
    material.opacityNode = mix(streak, flake, uniforms.isSnow).mul(fade).mul(uniforms.opacity);

    this.mesh = new Mesh(this.#geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11;
    this.mesh.visible = false;
  }

  cover(level: number, shown: number, area: LatticeArea, drift: Vector2): void {
    const scale = 2 ** level;

    this.#level.value = level;
    this.#scale.value = scale;
    this.#cover.cover(area, TILE_SIZE * scale, shown, drift);
    this.#geometry.instanceCount = this.#cover.count;
    this.mesh.visible = this.#cover.count > 0;
  }

  hide(): void {
    this.#geometry.instanceCount = 0;
    this.mesh.visible = false;
  }

  dispose(): void {
    this.#geometry.dispose();
    this.#material.dispose();
  }
}

export class WeatherParticles {
  readonly group = new Group();
  readonly #coarse: DropOctave;
  readonly #drift = new Vector2();
  readonly #fine: DropOctave;
  readonly #halfSize: number;
  readonly #uniforms = new DropUniforms();
  #fallen = 0;

  constructor(axes: CameraAxes, textures: TerrainTextures, grid: WorldGrid) {
    const sources = { axes, grid, textures, uniforms: this.#uniforms };

    this.#fine = new DropOctave(sources);
    this.#coarse = new DropOctave(sources);
    this.#halfSize = grid.halfSize;
    this.group.add(this.#fine.mesh, this.#coarse.mesh);
  }

  update(weather: Precipitating, view: WeatherView): void {
    const strength = precipitationStrength(weather.precipitation);

    if (strength <= 0) {
      this.#fine.hide();
      this.#coarse.hide();

      return;
    }

    const look = LOOKS[weather.form];
    const seconds = view.realSeconds;
    const span = Math.max(NEAREST_SPAN, view.viewDistance * SPAN_PER_DISTANCE);
    const octave = Math.log2(Math.max(1, view.viewDistance / NATURAL_VIEW));
    const windX = weather.windX * look.windShare;
    const windZ = weather.windZ * look.windShare;

    const finer = Math.floor(octave);
    const perTile = DROPS_PER_TILE * strength * Math.max(1, (NATURAL_SPAN / span) ** 2);
    const area = { centerX: view.focus.x, centerZ: view.focus.z, halfSize: this.#halfSize, radius: span / 2 };

    const blend = octave - finer;

    this.#fallen = (this.#fallen + (look.fallSpeed * seconds) / COLUMN_HEIGHT) % CYCLES;
    this.#drift.x += (windX * seconds) / TILE_SIZE;
    this.#drift.y += (windZ * seconds) / TILE_SIZE;
    this.#fine.cover(finer, perTile * (4 ** -blend - blend / 4), area, this.#drift);
    this.#coarse.cover(finer + 1, perTile * blend, area, this.#drift);

    const uniforms = this.#uniforms;

    uniforms.fallen.value = this.#fallen;
    uniforms.driftShare.value.set(this.#drift.x - Math.floor(this.#drift.x), this.#drift.y - Math.floor(this.#drift.y));
    uniforms.focus.value.set(view.focus.x, view.focus.z);
    uniforms.span.value = span;
    uniforms.reach.value = span / 2;
    uniforms.slant.value.set(windX / look.fallSpeed, windZ / look.fallSpeed);
    uniforms.viewportSpan.value = 2 * Math.tan((view.camera.fov * Math.PI) / 360);
    uniforms.isSnow.value = weather.form === "snow" ? 1 : 0;
    uniforms.color.value.setHex(look.color).multiplyScalar(weather.brightness);
    uniforms.opacity.value = look.opacity * (0.55 + strength * 0.45);
    uniforms.size.value = look.size;
    uniforms.sway.value = look.sway;
    uniforms.shortest.value = look.shortest;
    uniforms.longest.value = look.longest;
    uniforms.thinnest.value = look.thinnest;
    uniforms.thickest.value = look.thickest;
  }

  dispose(): void {
    this.#fine.dispose();
    this.#coarse.dispose();
  }
}

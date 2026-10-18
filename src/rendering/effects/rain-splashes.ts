import {
  abs,
  attribute,
  cameraPosition,
  clamp,
  distance,
  float,
  floor,
  fwidth,
  ivec2,
  length,
  max,
  mix,
  select,
  smoothstep,
  sqrt,
  textureLoad,
  uint,
  uniform,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import {
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  type PerspectiveCamera,
  Uint16BufferAttribute,
  Vector2,
} from "three/webgpu";
import type { WorldGrid } from "../../world/world-grid.ts";
import { sampleHeightNode } from "../terrain/height-sampling.ts";
import type { TerrainTextures } from "../terrain/terrain-textures.ts";
import type { CameraAxes } from "./billboards.ts";
import { LatticeCover, latticeElement, scramble, unitHash } from "./precipitation-lattice.ts";

const TILE_SIZE = 8;
const SPLASHES_IN_VIEW = 3000;
const MOST_PER_TILE = 96;
const NEAREST_SPAN = 30;
const FARTHEST_SPAN = 420;
const SPAN_PER_DISTANCE = 1.3;
const RANGE_FADE_START = 0.6;
const SPLASHES_PER_SECOND = 1.6;
const CYCLES = 256;
const CLOSEST_VIEW = 260;
const FARTHEST_VIEW = 620;
const FAINTEST_SPLASH = 0.002;
const SNOW_START = 0.06;
const SNOW_END = 0.2;

const RIPPLE_RADIUS = 0.5;
const SMALLEST_RIPPLE = 0.006;
const LARGEST_RIPPLE = 0.016;
const RIPPLE_GAP = 0.38;
const RIPPLE_SHOW = 0.75;

const CROWN_SIZE = 0.32;
const SMALLEST_CROWN = 0.0045;
const LARGEST_CROWN = 0.009;
const CROWN_LIFE = 0.3;
const CROWN_DROPLETS = 5;
const CROWN_FAN = 0.42;
const CROWN_SHOW = 0.9;

const SALT_SPLASH = 0x2d_35_8d_cb;
const SALT_PHASE = 0x7a_5e_3b_19;
const SALT_CYCLE = 0x63_d8_3c_21;
const SALT_ACROSS = 0xd1_b5_4a_33;
const SALT_ALONG = 0x48_b2_f1_c7;

const NO_DRIFT = new Vector2();

export interface SplashView {
  readonly camera: PerspectiveCamera;
  readonly focusX: number;
  readonly focusZ: number;
  readonly realSeconds: number;
  readonly viewDistance: number;
}

function createSplashGeometry(): InstancedBufferGeometry {
  const geometry = new InstancedBufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(12), 3));
  geometry.setAttribute("splashCorner", new Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2));
  geometry.setIndex(new Uint16BufferAttribute([0, 2, 1, 0, 3, 2], 1));
  geometry.instanceCount = 0;

  return geometry;
}

function ripple(shape: Node<"vec2">, age: Node<"float">): Node<"float"> {
  const rim = length(shape);
  const leading = mix(float(0.12), float(1), sqrt(age));

  const width = max(fwidth(rim).mul(1.3), 0.05);
  const trailing = leading.sub(RIPPLE_GAP);

  const front = smoothstep(width, 0, abs(rim.sub(leading)));
  const wake = smoothstep(width, 0, abs(rim.sub(trailing)))
    .mul(smoothstep(0, 0.1, trailing))
    .mul(0.6);

  return max(front, wake).mul(float(1).sub(age).pow(1.5));
}

function crown(shape: Node<"vec2">, age: Node<"float">): Node<"float"> {
  const flight = clamp(age.div(CROWN_LIFE), 0, 1);
  const point = vec2(shape.x, shape.y.add(1).mul(0.5));
  const radius = float(0.16).mul(float(1).sub(flight.mul(0.55)));

  let droplets: Node<"float"> = float(0);

  for (let droplet = 0; droplet < CROWN_DROPLETS; droplet += 1) {
    const angle = (droplet - (CROWN_DROPLETS - 1) / 2) * CROWN_FAN;

    const center = vec2(
      flight.mul(0.75).add(0.2).mul(Math.sin(angle)),
      flight.mul(1.9).sub(flight.mul(flight).mul(1.5)).mul(Math.cos(angle)).add(0.06)
    );

    droplets = max(droplets, smoothstep(radius, radius.mul(0.35), length(point.sub(center))));
  }

  return droplets.mul(float(1).sub(flight));
}

export class RainSplashes {
  readonly mesh: Mesh;
  readonly #clock = uniform(0);
  readonly #cover = new LatticeCover();
  readonly #crownColor = uniform(new Color());
  readonly #focus = uniform(new Vector2());
  readonly #geometry = createSplashGeometry();
  readonly #halfSize: number;
  readonly #opacity = uniform(0);
  readonly #reach = uniform(NEAREST_SPAN / 2);
  readonly #rippleColor = uniform(new Color());
  readonly #viewportSpan = uniform(1);
  #cycles = 0;

  constructor(axes: CameraAxes, textures: TerrainTextures, grid: WorldGrid) {
    const material = new MeshBasicNodeMaterial({ depthWrite: false, side: DoubleSide, transparent: true });
    const corner = attribute("splashCorner", "vec2");
    const last = grid.cellsPerSide - 1;

    const element = latticeElement(this.#cover, uint(SALT_SPLASH));

    const progress = this.#clock.add(unitHash(element.seed, SALT_PHASE));

    const cycle = floor(progress);

    const age = progress.sub(cycle);
    const cycleSeed = scramble(
      element.seed.add(
        uint(cycle)
          .bitAnd(CYCLES - 1)
          .mul(SALT_CYCLE)
      )
    );

    const spot = element.tile
      .add(vec2(unitHash(cycleSeed, SALT_ACROSS), unitHash(cycleSeed, SALT_ALONG)))
      .mul(TILE_SIZE);

    const cell = ivec2(clamp(floor(spot.add(grid.halfSize).div(grid.cellSize)), vec2(0, 0), vec2(last, last)));
    const ground = sampleHeightNode(textures.height, grid, spot);

    const water = textureLoad(textures.water, cell).x;
    const snow = textureLoad(textures.surface, cell).r;

    const isOnWater = water.greaterThan(ground);
    const level = max(ground, water);
    const isOnIsland = max(abs(spot.x), abs(spot.y)).lessThan(grid.halfSize);
    const viewportMeters = distance(vec3(spot.x, level, spot.y), cameraPosition).mul(this.#viewportSpan);

    const lift = max(float(0.04), viewportMeters.mul(0.0015));
    const rippleSize = clamp(
      float(RIPPLE_RADIUS),
      viewportMeters.mul(SMALLEST_RIPPLE),
      viewportMeters.mul(LARGEST_RIPPLE)
    );
    const crownSize = clamp(float(CROWN_SIZE), viewportMeters.mul(SMALLEST_CROWN), viewportMeters.mul(LARGEST_CROWN));
    const life = select(isOnWater, float(1), select(age.lessThan(CROWN_LIFE), float(1), float(0)));

    const visibility = element.presence
      .mul(smoothstep(this.#reach, this.#reach.mul(RANGE_FADE_START), length(spot.sub(this.#focus))))
      .mul(float(1).sub(smoothstep(SNOW_START, SNOW_END, snow)))
      .mul(select(isOnIsland, float(1), float(0)))
      .mul(life);

    const extent = select(visibility.greaterThan(FAINTEST_SPLASH), float(1), float(0));
    const anchor = vec3(spot.x, level.add(lift), spot.y);

    const flat = vec3(corner.x, 0, corner.y).mul(rippleSize);
    const standing = axes.right
      .mul(corner.x)
      .add(axes.up.mul(corner.y.add(1).mul(0.5)))
      .mul(crownSize);

    material.positionNode = anchor.add(select(isOnWater, flat, standing).mul(extent));

    const shape = varying(corner, "splashCorner");
    const fade = varying(visibility, "splashFade");
    const splashAge = varying(age, "splashAge");
    const wetness = varying(select(isOnWater, float(1), float(0)), "splashOnWater");

    material.colorNode = mix(this.#crownColor, this.#rippleColor, wetness);
    material.opacityNode = mix(
      crown(shape, splashAge).mul(CROWN_SHOW),
      ripple(shape, splashAge).mul(RIPPLE_SHOW),
      wetness
    )
      .mul(fade)
      .mul(this.#opacity);

    this.#halfSize = grid.halfSize;
    this.mesh = new Mesh(this.#geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.visible = false;
  }

  update(strength: number, brightness: number, view: SplashView): void {
    const nearness = 1 - Math.min(1, Math.max(0, (view.viewDistance - CLOSEST_VIEW) / (FARTHEST_VIEW - CLOSEST_VIEW)));
    const span = Math.min(FARTHEST_SPAN, Math.max(NEAREST_SPAN, view.viewDistance * SPAN_PER_DISTANCE));

    const crowding = Math.min(MOST_PER_TILE, (SPLASHES_IN_VIEW * TILE_SIZE * TILE_SIZE) / (span * span));
    const area = { centerX: view.focusX, centerZ: view.focusZ, halfSize: this.#halfSize, radius: span / 2 };

    this.#cover.cover(area, TILE_SIZE, crowding * strength * nearness, NO_DRIFT);
    this.#geometry.instanceCount = this.#cover.count;
    this.mesh.visible = this.#cover.count > 0;

    if (this.#cover.count === 0) {
      return;
    }

    this.#cycles = (this.#cycles + view.realSeconds * SPLASHES_PER_SECOND) % CYCLES;
    this.#clock.value = this.#cycles;
    this.#focus.value.set(view.focusX, view.focusZ);
    this.#reach.value = span / 2;
    this.#viewportSpan.value = 2 * Math.tan((view.camera.fov * Math.PI) / 360);
    this.#rippleColor.value.setRGB(0.86, 0.9, 0.95).multiplyScalar(brightness);
    this.#crownColor.value.setRGB(0.92, 0.95, 1).multiplyScalar(brightness);
    this.#opacity.value = 0.8 * nearness;
  }

  dispose(): void {
    this.#geometry.dispose();
  }
}

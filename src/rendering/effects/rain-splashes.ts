import {
  attribute,
  cameraPosition,
  clamp,
  distance,
  float,
  floor,
  fract,
  hash,
  instanceIndex,
  ivec2,
  length,
  max,
  select,
  smoothstep,
  sqrt,
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
  InstancedBufferGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  type PerspectiveCamera,
  Uint16BufferAttribute,
  Vector2,
} from "three/webgpu";
import type { WorldGrid } from "../../world/world-grid.ts";
import { sampleHeightNode } from "../terrain/height-sampling.ts";
import type { TerrainTextures } from "../terrain/terrain-textures.ts";

const MAXIMUM_SPLASHES = 3000;
const NEAREST_SPAN = 30;
const FARTHEST_SPAN = 420;
const SPAN_PER_DISTANCE = 1.3;
const SPLASHES_PER_SECOND = 1.6;
const RANDOMS_PER_SPLASH = 4;
const CYCLE_SALT = 7919;
const CLOSEST_VIEW = 260;
const FARTHEST_VIEW = 620;
const NATURAL_RADIUS = 0.45;
const SMALLEST_RADIUS = 0.006;
const LARGEST_RADIUS = 0.016;
const WATER_SHOW = 1;
const GROUND_SHOW = 0.55;

export interface SplashView {
  readonly camera: PerspectiveCamera;
  readonly focusX: number;
  readonly focusZ: number;
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

export class RainSplashes {
  readonly mesh: Mesh;
  readonly #center = uniform(new Vector2());
  readonly #color = uniform(new Color());
  readonly #geometry = createSplashGeometry();
  readonly #opacity = uniform(0);
  readonly #span = uniform(NEAREST_SPAN);
  readonly #viewportSpan = uniform(1);

  constructor(textures: TerrainTextures, grid: WorldGrid) {
    const material = new MeshBasicNodeMaterial({ depthWrite: false, transparent: true });
    const corner = attribute("splashCorner", "vec2");
    const last = grid.cellsPerSide - 1;

    const cycle = time.mul(SPLASHES_PER_SECOND).add(hash(instanceIndex.mul(RANDOMS_PER_SPLASH)));

    const age = fract(cycle);
    const first = instanceIndex.mul(RANDOMS_PER_SPLASH).add(uint(floor(cycle)).mul(CYCLE_SALT));

    const spot = vec2(hash(first.add(1)), hash(first.add(2)))
      .sub(0.5)
      .mul(this.#span)
      .add(this.#center);
    const cell = ivec2(clamp(floor(spot.add(grid.halfSize).div(grid.cellSize)), vec2(0, 0), vec2(last, last)));

    const ground = sampleHeightNode(textures.height, grid, spot);
    const water = textureLoad(textures.water, cell).x;

    const isOnWater = water.greaterThan(ground);
    const isOnIsland = sampleHeightNode(textures.coast, grid, spot).greaterThan(0);
    const level = max(ground, water);
    const viewportMeters = distance(vec3(spot.x, level, spot.y), cameraPosition).mul(this.#viewportSpan);

    const radius = clamp(
      float(NATURAL_RADIUS),
      viewportMeters.mul(SMALLEST_RADIUS),
      viewportMeters.mul(LARGEST_RADIUS)
    ).mul(sqrt(age).mul(0.8).add(0.2));
    const lift = max(float(0.04), viewportMeters.mul(0.0015));

    material.positionNode = vec3(spot.x.add(corner.x.mul(radius)), level.add(lift), spot.y.add(corner.y.mul(radius)));

    const shape = varying(corner, "splashCorner");
    const fade = varying(
      float(1)
        .sub(age)
        .pow(1.5)
        .mul(select(isOnWater, float(WATER_SHOW), float(GROUND_SHOW)))
        .mul(select(isOnIsland, float(1), float(0))),
      "splashFade"
    );
    const reach = varying(length(spot.sub(this.#center)).div(this.#span), "splashReach");

    const rim = length(shape);

    const ring = smoothstep(0.62, 0.82, rim).mul(smoothstep(1, 0.86, rim));

    material.colorNode = this.#color;
    material.opacityNode = ring
      .mul(fade)
      .mul(smoothstep(0.5, 0.3, reach))
      .mul(this.#opacity);

    this.mesh = new Mesh(this.#geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.visible = false;
  }

  update(strength: number, brightness: number, view: SplashView): void {
    const nearness = 1 - Math.min(1, Math.max(0, (view.viewDistance - CLOSEST_VIEW) / (FARTHEST_VIEW - CLOSEST_VIEW)));

    const count = Math.round(MAXIMUM_SPLASHES * strength * nearness);

    this.#geometry.instanceCount = count;
    this.mesh.visible = count > 0;

    if (count === 0) {
      return;
    }

    this.#center.value.set(view.focusX, view.focusZ);
    this.#span.value = Math.min(FARTHEST_SPAN, Math.max(NEAREST_SPAN, view.viewDistance * SPAN_PER_DISTANCE));
    this.#viewportSpan.value = 2 * Math.tan((view.camera.fov * Math.PI) / 360);
    this.#color.value.setRGB(0.86, 0.9, 0.95).multiplyScalar(brightness);
    this.#opacity.value = 0.7 * nearness;
  }

  dispose(): void {
    this.#geometry.dispose();
  }
}

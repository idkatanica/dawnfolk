import { abs, atan, floor, fract, ivec2, length, max, mix, textureLoad, vec2 } from "three/tsl";
import { ClampToEdgeWrapping, DataTexture, FloatType, NearestFilter, type Node, RedFormat } from "three/webgpu";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { sampleHeight } from "../../world/terrain-sampling.ts";
import type { WorldGrid } from "../../world/world-grid.ts";

const COAST_SAMPLES = 2048;
const COAST_SEARCH_STEPS = 24;
const INLAND_START = 0.5;
const FULL_TURN = Math.PI * 2;

function coastRadius(mirror: WorldMirror, outwardX: number, outwardZ: number): number {
  const { grid, terrain } = mirror;

  function coastDistanceAt(radius: number): number {
    return sampleHeight(terrain.coastDistance, grid, outwardX * radius, outwardZ * radius);
  }

  const step = grid.cellSize / 2;
  const farthest = grid.halfSize - grid.cellSize;

  let inside = grid.halfSize * INLAND_START;

  while (inside + step < farthest && coastDistanceAt(inside + step) > 0) {
    inside += step;
  }

  let outside = Math.min(inside + step, farthest);

  for (let iteration = 0; iteration < COAST_SEARCH_STEPS; iteration += 1) {
    const middle = (inside + outside) / 2;

    if (coastDistanceAt(middle) > 0) {
      inside = middle;
    } else {
      outside = middle;
    }
  }

  return inside;
}

function measureCoastRadii(mirror: WorldMirror): Float32Array {
  const radii = new Float32Array(COAST_SAMPLES);

  for (let index = 0; index < COAST_SAMPLES; index += 1) {
    const angle = coastAngle(index);

    radii[index] = coastRadius(mirror, Math.cos(angle), Math.sin(angle));
  }

  return radii;
}

function radiusTexture(radii: Float32Array): DataTexture {
  const texture = new DataTexture(radii, radii.length, 1, RedFormat, FloatType);

  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return texture;
}

export function coastAngle(index: number): number {
  return (index / COAST_SAMPLES) * FULL_TURN;
}

export class IslandOutline {
  readonly coastRadii: Float32Array | null;
  readonly #grid: WorldGrid;
  readonly #texture: DataTexture | null;

  constructor(mirror: WorldMirror) {
    this.#grid = mirror.grid;

    if (mirror.shape === "square") {
      this.coastRadii = null;
      this.#texture = null;

      return;
    }

    this.coastRadii = measureCoastRadii(mirror);
    this.#texture = radiusTexture(this.coastRadii);
  }

  get hasCoast(): boolean {
    return this.#texture !== null;
  }

  insideNode(point: Node<"vec2">, margin: number): Node<"bool"> {
    if (this.#texture === null) {
      const { cellSize, halfSize } = this.#grid;

      return max(abs(point.x), abs(point.y)).lessThan(halfSize - cellSize / 2 - margin);
    }

    const sample = fract(atan(point.y, point.x).div(FULL_TURN)).mul(COAST_SAMPLES);

    const index = floor(sample);

    const following = index.add(1).mod(COAST_SAMPLES);
    const radius = mix(
      textureLoad(this.#texture, ivec2(vec2(index, 0))).x,
      textureLoad(this.#texture, ivec2(vec2(following, 0))).x,
      sample.sub(index)
    );

    return length(point).lessThan(radius.sub(margin));
  }

  dispose(): void {
    if (this.#texture !== null) {
      this.#texture.dispose();
    }
  }
}

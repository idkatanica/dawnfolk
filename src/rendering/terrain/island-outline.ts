import { abs, atan, floor, fract, ivec2, length, max, mix, textureLoad, vec2 } from "three/tsl";
import { ClampToEdgeWrapping, DataTexture, FloatType, NearestFilter, type Node, RedFormat } from "three/webgpu";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { FULL_TURN } from "../../shared/math.ts";
import { sampleHeight } from "../../world/terrain-sampling.ts";
import type { WorldGrid } from "../../world/world-grid.ts";

const COAST_SAMPLES = 2048;
const COAST_SEARCH_STEPS = 24;
const INLAND_START = 0.5;
const WALK_STEPS = 65_536;
const CROSSING_STEPS = 24;
const SAME_ANGLE = 1e-9;

export interface CoastPoint {
  readonly angle: number;
  readonly radius: number;
}

type LatticeLines = readonly [column: number, row: number, diagonal: number];

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

function coastAngle(index: number): number {
  return (index / COAST_SAMPLES) * FULL_TURN;
}

function radiusAt(radii: Float32Array, angle: number): number {
  const sample = ((((angle / FULL_TURN) % 1) + 1) % 1) * radii.length;

  const index = Math.floor(sample);

  const following = (index + 1) % radii.length;

  return radii[index] + (radii[following] - radii[index]) * (sample - index);
}

function latticeLinesAt(grid: WorldGrid, radii: Float32Array, angle: number): LatticeLines {
  const radius = radiusAt(radii, angle);

  const column = (Math.cos(angle) * radius + grid.halfSize) / grid.cellSize - 0.5;
  const row = (Math.sin(angle) * radius + grid.halfSize) / grid.cellSize - 0.5;

  return [Math.floor(column), Math.floor(row), Math.floor(column + row)];
}

function refineCrossing(grid: WorldGrid, radii: Float32Array, family: number, from: number, to: number): number {
  const before = latticeLinesAt(grid, radii, from)[family];

  let low = from;
  let high = to;

  for (let step = 0; step < CROSSING_STEPS; step += 1) {
    const middle = (low + high) / 2;

    if (latticeLinesAt(grid, radii, middle)[family] === before) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return (low + high) / 2;
}

function latticeCrossings(grid: WorldGrid, radii: Float32Array): number[] {
  const angles: number[] = [];

  let previous = latticeLinesAt(grid, radii, 0);

  for (let step = 1; step <= WALK_STEPS; step += 1) {
    const from = ((step - 1) / WALK_STEPS) * FULL_TURN;
    const to = (step / WALK_STEPS) * FULL_TURN;

    const current = latticeLinesAt(grid, radii, to);

    for (const [family, line] of current.entries()) {
      if (line !== previous[family]) {
        angles.push(refineCrossing(grid, radii, family, from, to) % FULL_TURN);
      }
    }

    previous = current;
  }

  return angles;
}

function traceCoast(grid: WorldGrid, radii: Float32Array): CoastPoint[] {
  const angles = [...latticeCrossings(grid, radii), ...Array.from(radii, (_, index) => coastAngle(index))].sort(
    (first, second) => first - second
  );

  const distinct = angles.filter((angle, index) => index === 0 || angle - angles[index - 1] > SAME_ANGLE);

  return distinct.map((angle) => ({ angle, radius: radiusAt(radii, angle) }));
}

export class IslandOutline {
  readonly coast: readonly CoastPoint[] | null;
  readonly #grid: WorldGrid;
  readonly #radii: Float32Array | null;
  readonly #texture: DataTexture | null;

  constructor(mirror: WorldMirror) {
    this.#grid = mirror.grid;

    if (mirror.shape === "square") {
      this.coast = null;
      this.#radii = null;
      this.#texture = null;

      return;
    }

    const radii = measureCoastRadii(mirror);

    this.coast = traceCoast(mirror.grid, radii);
    this.#radii = radii;
    this.#texture = radiusTexture(radii);
  }

  get hasCoast(): boolean {
    return this.#texture !== null;
  }

  atCoast(x: number, z: number): readonly [number, number] {
    if (this.#radii === null) {
      return [x, z];
    }

    const angle = Math.atan2(z, x);
    const radius = radiusAt(this.#radii, angle);

    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
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

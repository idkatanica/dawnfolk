import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from "three/webgpu";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { smoothstep } from "../../shared/math.ts";
import { createVolumeNoise, type VolumeNoise } from "../../shared/noise.ts";
import { createRandom } from "../../shared/random.ts";
import { sampleHeight } from "../../world/terrain-sampling.ts";
import type { WorldGrid } from "../../world/world-grid.ts";

const PERIMETER_POINTS = 1024;
const INLAND_START = 0.5;
const COAST_SEARCH_STEPS = 24;
const CLIFF_DROP = 60;
const CLIFF_RINGS = 6;
const UNDERSIDE_DEPTH = 1650;
const UNDERSIDE_RINGS = 26;
const CLIFF_BULGE = 9;
const RIM_OFFSET = 0.4;

interface PerimeterPoint {
  readonly outwardX: number;
  readonly outwardZ: number;
  readonly x: number;
  readonly z: number;
}

interface RingVertex {
  readonly cliffAmount: number;
  readonly depth: number;
}

interface VertexPlacement {
  readonly grid: WorldGrid;
  readonly noise: VolumeNoise;
  readonly plinth: number;
  readonly point: PerimeterPoint;
  readonly ring: RingVertex;
}

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

function perimeter(mirror: WorldMirror): PerimeterPoint[] {
  const points: PerimeterPoint[] = [];

  for (let index = 0; index < PERIMETER_POINTS; index += 1) {
    const angle = (index / PERIMETER_POINTS) * Math.PI * 2;
    const outwardX = Math.cos(angle);
    const outwardZ = Math.sin(angle);

    const radius = coastRadius(mirror, outwardX, outwardZ);

    points.push({ outwardX, outwardZ, x: outwardX * radius, z: outwardZ * radius });
  }

  return points;
}

function ringLayout(): RingVertex[] {
  const rings: RingVertex[] = [];

  for (let ring = 0; ring <= CLIFF_RINGS; ring += 1) {
    rings.push({ cliffAmount: 1 - ring / CLIFF_RINGS, depth: 0 });
  }

  for (let ring = 1; ring <= UNDERSIDE_RINGS; ring += 1) {
    rings.push({ cliffAmount: 0, depth: ring / UNDERSIDE_RINGS });
  }

  return rings;
}

function lowestCoastHeight(mirror: WorldMirror, points: readonly PerimeterPoint[]): number {
  let lowest = Number.POSITIVE_INFINITY;

  for (const point of points) {
    lowest = Math.min(lowest, sampleHeight(mirror.terrain.height, mirror.grid, point.x, point.z));
  }

  return lowest;
}

export function islandPlinthHeight(mirror: WorldMirror): number {
  return lowestCoastHeight(mirror, perimeter(mirror)) - CLIFF_DROP;
}

function undersideReach(depth: number): number {
  return 1 - 0.97 * depth ** 0.62;
}

function roundedRadius(x: number, z: number, depth: number, halfSize: number): number {
  const rimRadius = Math.hypot(x, z);
  const circleRadius = halfSize * 0.98;

  return rimRadius + (circleRadius - rimRadius) * smoothstep(0, 0.45, depth);
}

function placeVertex({ grid, noise, plinth, point, ring }: VertexPlacement): readonly [number, number, number] {
  const { x, z } = point;

  const angle = Math.atan2(z, x);

  const ridges = noise.fractal(Math.cos(angle) * 9, ring.depth * 2.4, Math.sin(angle) * 9, { octaves: 3 });
  const lumps = noise.fractal(x * 0.0021, ring.depth * 3.1 + 7, z * 0.0021, { octaves: 3 });

  if (ring.depth === 0) {
    const bulge = RIM_OFFSET + CLIFF_BULGE * (1 - ring.cliffAmount) * (0.6 + 0.4 * Math.abs(lumps + ridges));

    return [x + point.outwardX * bulge, plinth, z + point.outwardZ * bulge];
  }

  const radius =
    roundedRadius(x, z, ring.depth, grid.halfSize) * undersideReach(ring.depth) * (1 + ridges * 0.09 + lumps * 0.12);
  const spikes =
    Math.max(0, noise.fractal(Math.cos(angle) * 23, 4.2, Math.sin(angle) * 23, { octaves: 2 })) * ring.depth ** 2;

  const drop = ring.depth ** 1.1 * UNDERSIDE_DEPTH * (1 + spikes * 0.45) + lumps * 60 * ring.depth;

  return [Math.cos(angle) * radius, plinth - drop, Math.sin(angle) * radius];
}

export function buildIslandBaseGeometry(mirror: WorldMirror): BufferGeometry {
  const { grid } = mirror;
  const noise = createVolumeNoise(createRandom(mirror.seed + 17));
  const rings = ringLayout();
  const points = perimeter(mirror);
  const plinth = lowestCoastHeight(mirror, points) - CLIFF_DROP;

  const positions: number[] = [];
  const topPoints: number[] = [];
  const cliffAmounts: number[] = [];
  const outwards: number[] = [];
  const indices: number[] = [];

  for (const point of points) {
    for (const ring of rings) {
      positions.push(...placeVertex({ grid, noise, plinth, point, ring }));
      topPoints.push(point.x, point.z);
      cliffAmounts.push(ring.cliffAmount);
      outwards.push(point.outwardX, point.outwardZ);
    }
  }

  const tip = positions.length / 3;
  const ringCount = rings.length;

  positions.push(0, plinth - UNDERSIDE_DEPTH * 1.12, 0);
  topPoints.push(0, 0);
  cliffAmounts.push(0);
  outwards.push(0, 0);

  for (let point = 0; point < points.length; point += 1) {
    const next = (point + 1) % points.length;

    for (let ring = 0; ring < ringCount - 1; ring += 1) {
      const current = point * ringCount + ring;
      const following = next * ringCount + ring;

      indices.push(current, following, current + 1, following, following + 1, current + 1);
    }

    indices.push(point * ringCount + ringCount - 1, next * ringCount + ringCount - 1, tip);
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("topPoint", new Float32BufferAttribute(topPoints, 2));
  geometry.setAttribute("cliffAmount", new Float32BufferAttribute(cliffAmounts, 1));
  geometry.setAttribute("outward", new Float32BufferAttribute(outwards, 2));
  geometry.setIndex(new Uint32BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  return geometry;
}

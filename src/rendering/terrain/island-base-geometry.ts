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
const UNDERSIDE_RINGS = 14;
const UNDERSIDE_STRIDE = 4;
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

function cliffRings(): RingVertex[] {
  const rings: RingVertex[] = [];

  for (let ring = 0; ring <= CLIFF_RINGS; ring += 1) {
    rings.push({ cliffAmount: 1 - ring / CLIFF_RINGS, depth: 0 });
  }

  return rings;
}

function undersideRings(): RingVertex[] {
  const rings: RingVertex[] = [];

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

interface BaseOutline {
  readonly grid: WorldGrid;
  readonly noise: VolumeNoise;
  readonly plinth: number;
  readonly points: readonly PerimeterPoint[];
}

export interface IslandBaseGeometry {
  readonly cliff: BufferGeometry;
  readonly plinth: number;
  readonly underside: BufferGeometry;
}

function finishGeometry(positions: readonly number[], indices: readonly number[]): BufferGeometry {
  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(new Uint32BufferAttribute(indices, 1));

  return geometry;
}

function pushStrips(indices: number[], pointCount: number, ringCount: number, firstVertex: number): void {
  for (let point = 0; point < pointCount; point += 1) {
    const next = (point + 1) % pointCount;

    for (let ring = 0; ring < ringCount - 1; ring += 1) {
      const current = firstVertex + point * ringCount + ring;
      const following = firstVertex + next * ringCount + ring;

      indices.push(current, following, current + 1, following, following + 1, current + 1);
    }
  }
}

function buildCliff({ grid, noise, plinth, points }: BaseOutline): BufferGeometry {
  const rings = cliffRings();

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

  pushStrips(indices, points.length, rings.length, 0);

  const geometry = finishGeometry(positions, indices);

  geometry.setAttribute("topPoint", new Float32BufferAttribute(topPoints, 2));
  geometry.setAttribute("cliffAmount", new Float32BufferAttribute(cliffAmounts, 1));
  geometry.setAttribute("outward", new Float32BufferAttribute(outwards, 2));
  geometry.computeVertexNormals();

  return geometry;
}

function pushStitch(indices: number[], rimCount: number, coarseCount: number, ringCount: number): void {
  for (let coarse = 0; coarse < coarseCount; coarse += 1) {
    const below = rimCount + coarse * ringCount;
    const nextBelow = rimCount + ((coarse + 1) % coarseCount) * ringCount;
    const firstRim = coarse * UNDERSIDE_STRIDE;

    for (let step = 0; step < UNDERSIDE_STRIDE; step += 1) {
      indices.push(firstRim + step, (firstRim + step + 1) % rimCount, below);
    }

    indices.push((firstRim + UNDERSIDE_STRIDE) % rimCount, nextBelow, below);
  }
}

function buildUnderside({ grid, noise, plinth, points }: BaseOutline): BufferGeometry {
  const rimRing: RingVertex = { cliffAmount: 0, depth: 0 };
  const rings = undersideRings();
  const coarsePoints = points.filter((_, index) => index % UNDERSIDE_STRIDE === 0);

  const positions: number[] = [];
  const indices: number[] = [];

  for (const point of points) {
    positions.push(...placeVertex({ grid, noise, plinth, point, ring: rimRing }));
  }

  for (const point of coarsePoints) {
    for (const ring of rings) {
      positions.push(...placeVertex({ grid, noise, plinth, point, ring }));
    }
  }

  const tip = positions.length / 3;

  positions.push(0, plinth - UNDERSIDE_DEPTH * 1.12, 0);

  pushStitch(indices, points.length, coarsePoints.length, rings.length);
  pushStrips(indices, coarsePoints.length, rings.length, points.length);

  for (let point = 0; point < coarsePoints.length; point += 1) {
    const next = (point + 1) % coarsePoints.length;
    const lowest = points.length + rings.length - 1;

    indices.push(lowest + point * rings.length, lowest + next * rings.length, tip);
  }

  const geometry = finishGeometry(positions, indices);

  geometry.computeVertexNormals();

  return geometry;
}

export function buildIslandBaseGeometry(mirror: WorldMirror): IslandBaseGeometry {
  const points = perimeter(mirror);

  const outline: BaseOutline = {
    grid: mirror.grid,
    noise: createVolumeNoise(createRandom(mirror.seed + 17)),
    plinth: lowestCoastHeight(mirror, points) - CLIFF_DROP,
    points,
  };

  return { cliff: buildCliff(outline), plinth: outline.plinth, underside: buildUnderside(outline) };
}

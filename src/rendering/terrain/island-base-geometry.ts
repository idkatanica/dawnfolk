import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from "three/webgpu";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { smoothstep } from "../../shared/math.ts";
import { createVolumeNoise, type VolumeNoise } from "../../shared/noise.ts";
import { createRandom } from "../../shared/random.ts";
import { sampleHeight } from "../../world/terrain-sampling.ts";
import type { WorldGrid } from "../../world/world-grid.ts";

const COAST_POINTS = 1024;
const INLAND_START = 0.5;
const COAST_SEARCH_STEPS = 24;
const CLIFF_DROP = 60;
const CLIFF_RINGS = 6;
const UNDERSIDE_DEPTH = 1650;
const UNDERSIDE_RINGS = 14;
const UNDERSIDE_STRIDE = 4;
const CLIFF_BULGE = 9;
const SQUARE_RIM_OFFSET = 0.4;
const COAST_RIM_OFFSET = -0.4;
const SQUARE_UNDERSIDE_RADIUS = 1.08;
const COAST_UNDERSIDE_RADIUS = 0.98;

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

interface BaseOutline {
  readonly grid: WorldGrid;
  readonly noise: VolumeNoise;
  readonly plinth: number;
  readonly points: readonly PerimeterPoint[];
  readonly rimOffset: number;
  readonly undersideRadius: number;
}

export interface IslandBaseGeometry {
  readonly cliff: BufferGeometry;
  readonly plinth: number;
  readonly underside: BufferGeometry;
}

function squarePerimeter(grid: WorldGrid): PerimeterPoint[] {
  const points: PerimeterPoint[] = [];
  const last = grid.cellsPerSide - 1;

  function push(column: number, row: number, outwardX: number, outwardZ: number): void {
    points.push({ outwardX, outwardZ, x: grid.centerX(column), z: grid.centerZ(row) });
  }

  for (let column = 0; column < last; column += 1) {
    push(column, 0, 0, -1);
  }

  for (let row = 0; row < last; row += 1) {
    push(last, row, 1, 0);
  }

  for (let column = last; column > 0; column -= 1) {
    push(column, last, 0, 1);
  }

  for (let row = last; row > 0; row -= 1) {
    push(0, row, -1, 0);
  }

  return points;
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

function coastPerimeter(mirror: WorldMirror): PerimeterPoint[] {
  const points: PerimeterPoint[] = [];

  for (let index = 0; index < COAST_POINTS; index += 1) {
    const angle = (index / COAST_POINTS) * Math.PI * 2;
    const outwardX = Math.cos(angle);
    const outwardZ = Math.sin(angle);

    const radius = coastRadius(mirror, outwardX, outwardZ);

    points.push({ outwardX, outwardZ, x: outwardX * radius, z: outwardZ * radius });
  }

  return points;
}

function islandPerimeter(mirror: WorldMirror): PerimeterPoint[] {
  if (mirror.shape === "square") {
    return squarePerimeter(mirror.grid);
  }

  return coastPerimeter(mirror);
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

function lowestRimHeight(mirror: WorldMirror, points: readonly PerimeterPoint[]): number {
  let lowest = Number.POSITIVE_INFINITY;

  for (const point of points) {
    lowest = Math.min(lowest, sampleHeight(mirror.terrain.height, mirror.grid, point.x, point.z));
  }

  return lowest;
}

export function islandPlinthHeight(mirror: WorldMirror): number {
  return lowestRimHeight(mirror, islandPerimeter(mirror)) - CLIFF_DROP;
}

function undersideReach(depth: number): number {
  return 1 - 0.97 * depth ** 0.62;
}

function roundedRadius(outline: BaseOutline, x: number, z: number, depth: number): number {
  const rimRadius = Math.hypot(x, z);
  const circleRadius = outline.grid.halfSize * outline.undersideRadius;

  return rimRadius + (circleRadius - rimRadius) * smoothstep(0, 0.45, depth);
}

function placeVertex(outline: BaseOutline, point: PerimeterPoint, ring: RingVertex): readonly [number, number, number] {
  const { noise, plinth } = outline;
  const { x, z } = point;

  const angle = Math.atan2(z, x);

  const ridges = noise.fractal(Math.cos(angle) * 9, ring.depth * 2.4, Math.sin(angle) * 9, { octaves: 3 });
  const lumps = noise.fractal(x * 0.0021, ring.depth * 3.1 + 7, z * 0.0021, { octaves: 3 });

  if (ring.depth === 0) {
    const bulge = outline.rimOffset + CLIFF_BULGE * (1 - ring.cliffAmount) * (0.6 + 0.4 * Math.abs(lumps + ridges));

    return [x + point.outwardX * bulge, plinth, z + point.outwardZ * bulge];
  }

  const radius =
    roundedRadius(outline, x, z, ring.depth) * undersideReach(ring.depth) * (1 + ridges * 0.09 + lumps * 0.12);
  const spikes =
    Math.max(0, noise.fractal(Math.cos(angle) * 23, 4.2, Math.sin(angle) * 23, { octaves: 2 })) * ring.depth ** 2;

  const drop = ring.depth ** 1.1 * UNDERSIDE_DEPTH * (1 + spikes * 0.45) + lumps * 60 * ring.depth;

  return [Math.cos(angle) * radius, plinth - drop, Math.sin(angle) * radius];
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

function buildCliff(outline: BaseOutline): BufferGeometry {
  const rings = cliffRings();

  const positions: number[] = [];
  const topPoints: number[] = [];
  const cliffAmounts: number[] = [];
  const outwards: number[] = [];
  const indices: number[] = [];

  for (const point of outline.points) {
    for (const ring of rings) {
      positions.push(...placeVertex(outline, point, ring));
      topPoints.push(point.x, point.z);
      cliffAmounts.push(ring.cliffAmount);
      outwards.push(point.outwardX, point.outwardZ);
    }
  }

  pushStrips(indices, outline.points.length, rings.length, 0);

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

function buildUnderside(outline: BaseOutline): BufferGeometry {
  const rimRing: RingVertex = { cliffAmount: 0, depth: 0 };
  const rings = undersideRings();
  const coarsePoints = outline.points.filter((_, index) => index % UNDERSIDE_STRIDE === 0);

  const positions: number[] = [];
  const indices: number[] = [];

  for (const point of outline.points) {
    positions.push(...placeVertex(outline, point, rimRing));
  }

  for (const point of coarsePoints) {
    for (const ring of rings) {
      positions.push(...placeVertex(outline, point, ring));
    }
  }

  const tip = positions.length / 3;

  positions.push(0, outline.plinth - UNDERSIDE_DEPTH * 1.12, 0);

  pushStitch(indices, outline.points.length, coarsePoints.length, rings.length);
  pushStrips(indices, coarsePoints.length, rings.length, outline.points.length);

  for (let point = 0; point < coarsePoints.length; point += 1) {
    const next = (point + 1) % coarsePoints.length;
    const lowest = outline.points.length + rings.length - 1;

    indices.push(lowest + point * rings.length, lowest + next * rings.length, tip);
  }

  const geometry = finishGeometry(positions, indices);

  geometry.computeVertexNormals();

  return geometry;
}

export function buildIslandBaseGeometry(mirror: WorldMirror): IslandBaseGeometry {
  const points = islandPerimeter(mirror);
  const isSquare = mirror.shape === "square";

  const outline: BaseOutline = {
    grid: mirror.grid,
    noise: createVolumeNoise(createRandom(mirror.seed + 17)),
    plinth: lowestRimHeight(mirror, points) - CLIFF_DROP,
    points,
    rimOffset: isSquare ? SQUARE_RIM_OFFSET : COAST_RIM_OFFSET,
    undersideRadius: isSquare ? SQUARE_UNDERSIDE_RADIUS : COAST_UNDERSIDE_RADIUS,
  };

  return { cliff: buildCliff(outline), plinth: outline.plinth, underside: buildUnderside(outline) };
}

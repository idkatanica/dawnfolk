import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from "three/webgpu";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { smoothstep } from "../../shared/math.ts";
import { createVolumeNoise, type VolumeNoise } from "../../shared/noise.ts";
import { createRandom } from "../../shared/random.ts";
import type { WorldGrid } from "../../world/world-grid.ts";

const PERIMETER_STEP = 2;
const CLIFF_DROP = 60;
const CLIFF_RINGS = 6;
const UNDERSIDE_DEPTH = 1650;
const UNDERSIDE_RINGS = 26;
const CLIFF_BULGE = 9;
const RIM_OFFSET = 0.4;

interface PerimeterPoint {
  readonly column: number;
  readonly outwardX: number;
  readonly outwardZ: number;
  readonly row: number;
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

function perimeter(size: number): PerimeterPoint[] {
  const points: PerimeterPoint[] = [];
  const last = size - 1;

  for (let column = 0; column < last; column += PERIMETER_STEP) {
    points.push({ column, outwardX: 0, outwardZ: -1, row: 0 });
  }

  for (let row = 0; row < last; row += PERIMETER_STEP) {
    points.push({ column: last, outwardX: 1, outwardZ: 0, row });
  }

  for (let column = last; column > 0; column -= PERIMETER_STEP) {
    points.push({ column, outwardX: 0, outwardZ: 1, row: last });
  }

  for (let row = last; row > 0; row -= PERIMETER_STEP) {
    points.push({ column: 0, outwardX: -1, outwardZ: 0, row });
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

function lowestEdgeHeight(mirror: WorldMirror): number {
  const { grid, terrain } = mirror;

  const last = grid.cellsPerSide - 1;

  let lowest = Number.POSITIVE_INFINITY;

  for (let index = 0; index <= last; index += 1) {
    lowest = Math.min(
      lowest,
      terrain.height[grid.index(index, 0)],
      terrain.height[grid.index(index, last)],
      terrain.height[grid.index(0, index)],
      terrain.height[grid.index(last, index)]
    );
  }

  return lowest;
}

export function islandPlinthHeight(mirror: WorldMirror): number {
  return lowestEdgeHeight(mirror) - CLIFF_DROP;
}

function undersideReach(depth: number): number {
  return 1 - 0.97 * depth ** 0.62;
}

function roundedRadius(x: number, z: number, depth: number, halfSize: number): number {
  const squareRadius = Math.hypot(x, z);
  const circleRadius = halfSize * 1.08;

  return squareRadius + (circleRadius - squareRadius) * smoothstep(0, 0.45, depth);
}

function placeVertex({ grid, noise, plinth, point, ring }: VertexPlacement): readonly [number, number, number] {
  const x = grid.centerX(point.column);
  const z = grid.centerZ(point.row);

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
  const plinth = islandPlinthHeight(mirror);

  const points = perimeter(grid.cellsPerSide);

  const positions: number[] = [];
  const cells: number[] = [];
  const cliffAmounts: number[] = [];
  const outwards: number[] = [];
  const indices: number[] = [];

  for (const point of points) {
    for (const ring of rings) {
      positions.push(...placeVertex({ grid, noise, plinth, point, ring }));
      cells.push(point.column, point.row);
      cliffAmounts.push(ring.cliffAmount);
      outwards.push(point.outwardX, point.outwardZ);
    }
  }

  const tip = positions.length / 3;
  const ringCount = rings.length;

  positions.push(0, plinth - UNDERSIDE_DEPTH * 1.12, 0);
  cells.push(0, 0);
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
  geometry.setAttribute("topCell", new Float32BufferAttribute(cells, 2));
  geometry.setAttribute("cliffAmount", new Float32BufferAttribute(cliffAmounts, 1));
  geometry.setAttribute("outward", new Float32BufferAttribute(outwards, 2));
  geometry.setIndex(new Uint32BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  return geometry;
}

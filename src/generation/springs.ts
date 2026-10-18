import { clamp, hashToUnit } from "../shared/math.ts";
import { sampleHeight } from "../world/terrain-sampling.ts";
import type { River, RiverPoint, Spring, SpringKind } from "../world/water.ts";
import type { WorldGrid } from "../world/world-grid.ts";

const CAVE_SLOPE = 0.5;
const ROCKY_SLOPE = 0.3;
const SLOPE_REACHES = [10, 20, 30] as const;
const DIRECTION_REACH = 25;
const LAKE_REACH_CELLS = 2;
const SMALLEST_POOL = 9;
const LARGEST_POOL = 20;
const POOL_GROWTH = 2.5;
const ROCKY_POOL_SHARE = 0.75;
const POOL_DEPTH = 3.2;
const POOL_OUTLET_SHARE = 0.6;
const HIGHEST_POOL_BANK = 5;
const TIGHTEST_POOL = 4;
const POOL_SHRINK = 0.8;
const NARROWEST_CAVE = 6.5;
const WIDEST_CAVE = 10;
const CAVE_SETBACK = 3;
const CAVE_DEPTH = 3;
const CAVE_FLOOR_DEPTH = 1.2;
const CAVE_MASS_SETBACK = 3;
const CAVE_MASS_MARGIN = 6;
const POOL_RIM = 2;
const ROCKY_RIM = 4;
const SPRING_SALT = 83.1;
const SIZE_SALT = 17.3;

export interface SpringSiting {
  readonly grid: WorldGrid;
  readonly heights: Float32Array;
  readonly lakeIds: Int32Array;
  readonly riverThreshold: number;
}

export interface SpringPlan {
  readonly channels: (readonly RiverPoint[])[];
  readonly springs: Spring[];
}

interface Direction {
  readonly x: number;
  readonly z: number;
}

interface PoolShape {
  readonly radius: number;
  readonly x: number;
  readonly z: number;
}

interface SpringPlanEntry {
  readonly channel: readonly RiverPoint[];
  readonly spring: Spring;
}

interface SpringSite {
  readonly direction: Direction;
  readonly head: RiverPoint;
  readonly river: River;
  readonly sizing: number;
  readonly slope: number;
}

function downstreamDirection(river: River): Direction | null {
  const [head] = river.points;

  const ahead = river.points.find((point) => Math.hypot(point.x - head.x, point.z - head.z) >= DIRECTION_REACH);
  const target = ahead === undefined ? river.points.at(-1) : ahead;

  if (target === undefined) {
    return null;
  }

  const length = Math.hypot(target.x - head.x, target.z - head.z);

  if (length < 1e-3) {
    return null;
  }

  return { x: (target.x - head.x) / length, z: (target.z - head.z) / length };
}

function slopeBehind(head: RiverPoint, direction: Direction, siting: SpringSiting): number {
  const { grid, heights } = siting;

  const ground = sampleHeight(heights, grid, head.x, head.z);

  let steepest = 0;

  for (const reach of SLOPE_REACHES) {
    const behind = sampleHeight(heights, grid, head.x - direction.x * reach, head.z - direction.z * reach);

    steepest = Math.max(steepest, (behind - ground) / reach);
  }

  return steepest;
}

function isFedByLake(head: RiverPoint, siting: SpringSiting): boolean {
  const { grid, lakeIds } = siting;

  return grid.cellsInRadius(head.x, head.z, grid.cellSize * LAKE_REACH_CELLS).some((cell) => lakeIds[cell] >= 0);
}

function kindFor(slope: number): SpringKind {
  if (slope >= CAVE_SLOPE) {
    return "cave";
  }

  return slope >= ROCKY_SLOPE ? "rocky" : "pool";
}

function poolRadius(site: SpringSite, threshold: number, kind: SpringKind): number {
  const mouth = site.river.points.at(-1);
  const flow = mouth === undefined ? site.head.flow : mouth.flow;

  const growth = POOL_GROWTH * Math.log2(Math.max(1, flow / threshold));
  const radius = clamp(SMALLEST_POOL + growth * (0.8 + 0.4 * site.sizing), SMALLEST_POOL, LARGEST_POOL);

  return kind === "rocky" ? Math.max(SMALLEST_POOL, radius * ROCKY_POOL_SHARE) : radius;
}

function caveWidth(site: SpringSite): number {
  return clamp(site.head.width * 1.4 + 2.5 + 2 * site.sizing, NARROWEST_CAVE, WIDEST_CAVE);
}

function channelPoint(head: RiverPoint, x: number, z: number, width: number, depth: number): RiverPoint {
  return { depth, flow: head.flow, surface: head.surface, width, x, z };
}

function poolAround(site: SpringSite, radius: number): PoolShape {
  const { direction, head } = site;

  return {
    radius,
    x: head.x - direction.x * radius * POOL_OUTLET_SHARE,
    z: head.z - direction.z * radius * POOL_OUTLET_SHARE,
  };
}

function highestGroundIn(pool: PoolShape, site: SpringSite, siting: SpringSiting): number {
  let highest = Number.NEGATIVE_INFINITY;

  for (const cell of siting.grid.cellsInRadius(pool.x, pool.z, pool.radius)) {
    highest = Math.max(highest, siting.heights[cell] - site.head.surface);
  }

  return highest;
}

function fittedPool(site: SpringSite, siting: SpringSiting, radius: number): PoolShape {
  let pool = poolAround(site, radius);

  while (pool.radius > TIGHTEST_POOL && highestGroundIn(pool, site, siting) > HIGHEST_POOL_BANK) {
    pool = poolAround(site, Math.max(TIGHTEST_POOL, pool.radius * POOL_SHRINK));
  }

  return pool;
}

function poolSpring(site: SpringSite, siting: SpringSiting, wantedKind: SpringKind, seed: number): SpringPlanEntry {
  const { direction, head } = site;

  const pool = fittedPool(site, siting, poolRadius(site, siting.riverThreshold, wantedKind));

  const kind = pool.radius < SMALLEST_POOL ? "rocky" : wantedKind;
  const rim = kind === "rocky" ? ROCKY_RIM : POOL_RIM;
  const center = channelPoint(head, pool.x, pool.z, pool.radius * 2, POOL_DEPTH);

  return {
    channel: [center, { ...center, x: pool.x + direction.x * 0.01, z: pool.z + direction.z * 0.01 }],
    spring: {
      cells: siting.grid.cellsInRadius(pool.x, pool.z, pool.radius + rim),
      directionX: direction.x,
      directionZ: direction.z,
      kind,
      level: head.surface,
      radius: pool.radius,
      river: site.river.id,
      seed,
      x: pool.x,
      z: pool.z,
    },
  };
}

function caveSpring(site: SpringSite, siting: SpringSiting, seed: number): SpringPlanEntry {
  const { direction, head } = site;

  const width = caveWidth(site);

  const mouthX = head.x - direction.x * CAVE_SETBACK;
  const mouthZ = head.z - direction.z * CAVE_SETBACK;
  const massX = mouthX - direction.x * CAVE_MASS_SETBACK;
  const massZ = mouthZ - direction.z * CAVE_MASS_SETBACK;

  return {
    channel: [
      channelPoint(head, mouthX - direction.x * CAVE_DEPTH, mouthZ - direction.z * CAVE_DEPTH, width, CAVE_FLOOR_DEPTH),
      channelPoint(head, head.x, head.z, width, CAVE_FLOOR_DEPTH),
    ],
    spring: {
      cells: siting.grid.cellsInRadius(massX, massZ, width / 2 + CAVE_MASS_MARGIN),
      directionX: direction.x,
      directionZ: direction.z,
      kind: "cave",
      level: head.surface,
      radius: width / 2,
      river: site.river.id,
      seed,
      x: mouthX,
      z: mouthZ,
    },
  };
}

function siteAt(river: River, siting: SpringSiting): SpringSite | null {
  const [head] = river.points;

  const direction = downstreamDirection(river);

  if (direction === null || isFedByLake(head, siting)) {
    return null;
  }

  const column = siting.grid.columnAt(head.x);
  const row = siting.grid.rowAt(head.z);

  return {
    direction,
    head,
    river,
    sizing: hashToUnit(column, row, SIZE_SALT),
    slope: slopeBehind(head, direction, siting),
  };
}

export function placeSprings(rivers: readonly River[], siting: SpringSiting): SpringPlan {
  const channels: (readonly RiverPoint[])[] = [];
  const springs: Spring[] = [];

  for (const river of rivers) {
    const site = siteAt(river, siting);

    if (site === null) {
      continue;
    }

    const kind = kindFor(site.slope);
    const seed = hashToUnit(siting.grid.columnAt(site.head.x), siting.grid.rowAt(site.head.z), SPRING_SALT);

    const entry = kind === "cave" ? caveSpring(site, siting, seed) : poolSpring(site, siting, kind, seed);

    channels.push(entry.channel);
    springs.push(entry.spring);
  }

  return { channels, springs };
}

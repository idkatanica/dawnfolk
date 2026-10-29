import { clamp, hashToUnit } from "../shared/math.ts";
import { sampleHeight } from "../world/terrain-sampling.ts";
import type { River, RiverPoint, Spring } from "../world/water.ts";
import type { WorldGrid } from "../world/world-grid.ts";
import { isNearLake } from "./hydrology.ts";
import { pondFits } from "./ponds.ts";

const CAVE_SLOPE = 0.35;
const SLOPE_REACHES = [10, 20, 30] as const;
const DIRECTION_REACH = 25;
const LAKE_REACH_CELLS = 2;
const SMALLEST_POND = 12.5;
const SMALLEST_WANTED_POND = 19;
const LARGEST_POND = 25;
const POND_GROWTH = 3;
const POND_OUTLET_SHARE = 0.85;
const POND_SHRINK = 0.85;
const POND_SIZES = 4;
const POND_RIM = 5;
const NARROWEST_CAVE = 6.5;
const WIDEST_CAVE = 10;
const CAVE_SETBACK = 3;
const CAVE_DEPTH = 3;
const CAVE_FLOOR_DEPTH = 1.2;
const CAVE_MASS_SETBACK = 3;
const CAVE_MASS_MARGIN = 6;
const SPRING_SALT = 83.1;
const SIZE_SALT = 17.3;

interface SpringSiting {
  readonly grid: WorldGrid;
  readonly heights: Float32Array;
  readonly lakeIds: Int32Array;
  readonly riverThreshold: number;
}

interface SpringPlan {
  readonly channels: (readonly RiverPoint[])[];
  readonly springs: Spring[];
}

interface Direction {
  readonly x: number;
  readonly z: number;
}

interface SpringPlanEntry {
  readonly channel: readonly RiverPoint[] | null;
  readonly spring: Spring;
}

interface SpringSite {
  readonly direction: Direction;
  readonly head: RiverPoint;
  readonly river: River;
  readonly seed: number;
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

function slopeBehind(siting: SpringSiting, head: RiverPoint, direction: Direction): number {
  const { grid, heights } = siting;

  const ground = sampleHeight(heights, grid, head.x, head.z);

  let steepest = 0;

  for (const reach of SLOPE_REACHES) {
    const behind = sampleHeight(heights, grid, head.x - direction.x * reach, head.z - direction.z * reach);

    steepest = Math.max(steepest, (behind - ground) / reach);
  }

  return steepest;
}

function isFedByLake(siting: SpringSiting, head: RiverPoint): boolean {
  const { grid, lakeIds } = siting;

  return isNearLake(grid, lakeIds, head.x, head.z, grid.cellSize * LAKE_REACH_CELLS);
}

function pondRadius(site: SpringSite, threshold: number): number {
  const mouth = site.river.points.at(-1);
  const flow = mouth === undefined ? site.head.flow : mouth.flow;

  const growth = POND_GROWTH * Math.log2(Math.max(1, flow / threshold));

  return clamp(SMALLEST_WANTED_POND + growth * (0.8 + 0.4 * site.sizing), SMALLEST_WANTED_POND, LARGEST_POND);
}

function caveWidth(site: SpringSite): number {
  return clamp(site.head.width * 1.4 + 2.5 + 2 * site.sizing, NARROWEST_CAVE, WIDEST_CAVE);
}

function channelPoint(head: RiverPoint, x: number, z: number, width: number, depth: number): RiverPoint {
  return { depth, flow: head.flow, surface: head.surface, width, x, z };
}

function pondAround(site: SpringSite, radius: number): Spring {
  const { direction, head, seed } = site;

  return {
    cells: [],
    directionX: direction.x,
    directionZ: direction.z,
    kind: "pond",
    level: head.surface,
    radius,
    river: site.river.id,
    seed,
    x: head.x - direction.x * radius * POND_OUTLET_SHARE,
    z: head.z - direction.z * radius * POND_OUTLET_SHARE,
  };
}

function fittedPond(siting: SpringSiting, site: SpringSite): Spring | null {
  const wanted = pondRadius(site, siting.riverThreshold);

  for (let step = 0; step < POND_SIZES; step += 1) {
    const pond = pondAround(site, Math.max(SMALLEST_POND, wanted * POND_SHRINK ** step));

    if (pondFits(siting.grid, siting.heights, pond)) {
      return pond;
    }
  }

  return null;
}

function pondSpring(siting: SpringSiting, pond: Spring): SpringPlanEntry {
  return {
    channel: null,
    spring: { ...pond, cells: siting.grid.cellsInRadius(pond.x, pond.z, pond.radius + POND_RIM) },
  };
}

function caveSpring(siting: SpringSiting, site: SpringSite): SpringPlanEntry {
  const { direction, head, seed } = site;

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

function siteAt(siting: SpringSiting, river: River): SpringSite | null {
  const [head] = river.points;

  const direction = downstreamDirection(river);

  if (direction === null || isFedByLake(siting, head)) {
    return null;
  }

  const column = siting.grid.columnAt(head.x);
  const row = siting.grid.rowAt(head.z);

  return {
    direction,
    head,
    river,
    seed: hashToUnit(column, row, SPRING_SALT),
    sizing: hashToUnit(column, row, SIZE_SALT),
    slope: slopeBehind(siting, head, direction),
  };
}

function springAt(siting: SpringSiting, site: SpringSite): SpringPlanEntry {
  if (site.slope >= CAVE_SLOPE) {
    return caveSpring(siting, site);
  }

  const pond = fittedPond(siting, site);

  if (pond === null) {
    return caveSpring(siting, site);
  }

  return pondSpring(siting, pond);
}

export function placeSprings(siting: SpringSiting, rivers: readonly River[]): SpringPlan {
  const channels: (readonly RiverPoint[])[] = [];
  const springs: Spring[] = [];

  for (const river of rivers) {
    const site = siteAt(siting, river);

    if (site === null) {
      continue;
    }

    const entry = springAt(siting, site);

    if (entry.channel !== null) {
      channels.push(entry.channel);
    }

    springs.push(entry.spring);
  }

  return { channels, springs };
}

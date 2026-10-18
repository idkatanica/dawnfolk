import { clamp, saturate, smoothstep } from "../shared/math.ts";
import { MinHeap } from "../shared/min-heap.ts";
import {
  hasWater,
  type Lake,
  NO_WATER,
  type River,
  type RiverPoint,
  type WaterFeatures,
  type Waterfall,
} from "../world/water.ts";
import { NEIGHBOR_OFFSETS, type WorldGrid } from "../world/world-grid.ts";
import { interpolatePoint, makeSurfaceDescend, smoothRiverPath } from "./river-paths.ts";

const DIAGONAL_REACH = 0.75;
const BANK_DEPTH = 0.3;
const SHALLOWEST_WATER = 0.05;
const MINIMUM_BANK_WIDTH = 6;

interface HydrologyOptions {
  lakeMinimumArea: number;
  lakeMinimumCatchmentArea: number;
  lakeMinimumDepth: number;
  riverCatchmentArea: number;
}

export const DEFAULT_HYDROLOGY: HydrologyOptions = {
  lakeMinimumArea: 3000,
  lakeMinimumCatchmentArea: 420_000,
  lakeMinimumDepth: 1.6,
  riverCatchmentArea: 150_000,
};

interface CellThresholds {
  lakeMinimumCatchment: number;
  lakeMinimumCells: number;
  lakeMinimumDepth: number;
  riverThreshold: number;
}

function toCellThresholds(options: HydrologyOptions, grid: WorldGrid): CellThresholds {
  const cellArea = grid.cellSize * grid.cellSize;

  return {
    lakeMinimumCatchment: options.lakeMinimumCatchmentArea / cellArea,
    lakeMinimumCells: Math.max(1, options.lakeMinimumArea / cellArea),
    lakeMinimumDepth: options.lakeMinimumDepth,
    riverThreshold: options.riverCatchmentArea / cellArea,
  };
}

interface HydrologyResult {
  features: WaterFeatures;
  lakeIds: Int32Array;
  riverStrength: Uint8Array;
  waterSurface: Float32Array;
}

export interface DrainageNetwork {
  accumulation: Float32Array;
  filled: Float32Array;
  order: Int32Array;
  receivers: Int32Array;
}

export interface DrainageBasins {
  lakeIds: Int32Array;
  lakes: Lake[];
  network: DrainageNetwork;
  riverThreshold: number;
  waterSurface: Float32Array;
}

interface RiverChain {
  cells: number[];
  joinsCell: number;
  mouthReceiver: number;
}

export const NO_CELL = -1;
const REJECTED_LAKE = -2;
const FILL_EPSILON = 1e-3;
const FLOODED_DEPTH = 0.25;
const BANK_HEIGHT = 1.6;
const DEEPEST_BANK_CUT = 2;

function fillDepressions(heights: Float32Array, grid: WorldGrid): DrainageNetwork {
  const size = grid.cellsPerSide;
  const filled = Float32Array.from(heights);
  const closed = new Uint8Array(grid.cellCount);
  const receivers = new Int32Array(grid.cellCount).fill(NO_CELL);
  const order = new Int32Array(grid.cellCount);
  let processed = 0;

  const heap = new MinHeap(size * 16);

  function seedCell(cellIndex: number): void {
    if (closed[cellIndex] === 0) {
      closed[cellIndex] = 1;
      heap.push(cellIndex, filled[cellIndex]);
    }
  }

  for (let position = 0; position < size; position += 1) {
    seedCell(grid.index(position, 0));
    seedCell(grid.index(position, size - 1));
    seedCell(grid.index(0, position));
    seedCell(grid.index(size - 1, position));
  }

  while (heap.size > 0) {
    const cell = heap.pop();

    const column = grid.columnOf(cell);
    const row = grid.rowOf(cell);
    const level = filled[cell];

    order[processed] = cell;
    processed += 1;

    for (const offset of NEIGHBOR_OFFSETS) {
      const neighborColumn = column + offset.column;
      const neighborRow = row + offset.row;

      if (!grid.contains(neighborColumn, neighborRow)) {
        continue;
      }

      const neighbor = grid.index(neighborColumn, neighborRow);

      if (closed[neighbor] === 1) {
        continue;
      }

      const neighborLevel = Math.max(heights[neighbor], level + FILL_EPSILON);

      closed[neighbor] = 1;
      filled[neighbor] = neighborLevel;
      receivers[neighbor] = cell;
      heap.push(neighbor, neighborLevel);
    }
  }

  const accumulation = new Float32Array(grid.cellCount).fill(1);

  for (let position = processed - 1; position >= 0; position -= 1) {
    const cell = order[position];

    const receiver = receivers[cell];

    if (receiver !== NO_CELL) {
      accumulation[receiver] += accumulation[cell];
    }
  }

  return { accumulation, filled, order, receivers };
}

interface FloodedArea {
  cells: number[];
  level: number;
  maximumAccumulation: number;
  maximumDepth: number;
}

function collectFloodedArea(
  start: number,
  heights: Float32Array,
  network: DrainageNetwork,
  grid: WorldGrid,
  visited: Int32Array,
  marker: number
): FloodedArea {
  const area: FloodedArea = { cells: [], level: Number.POSITIVE_INFINITY, maximumAccumulation: 0, maximumDepth: 0 };
  const stack = [start];

  visited[start] = marker;

  for (let cell = stack.pop(); cell !== undefined; cell = stack.pop()) {
    area.cells.push(cell);
    area.maximumAccumulation = Math.max(area.maximumAccumulation, network.accumulation[cell]);
    area.level = Math.min(area.level, network.filled[cell]);
    area.maximumDepth = Math.max(area.maximumDepth, network.filled[cell] - heights[cell]);

    const column = grid.columnOf(cell);
    const row = grid.rowOf(cell);

    for (const offset of NEIGHBOR_OFFSETS) {
      const neighborColumn = column + offset.column;
      const neighborRow = row + offset.row;

      if (!grid.contains(neighborColumn, neighborRow)) {
        continue;
      }

      const neighbor = grid.index(neighborColumn, neighborRow);

      if (visited[neighbor] === NO_CELL && network.filled[neighbor] - heights[neighbor] >= FLOODED_DEPTH) {
        visited[neighbor] = marker;
        stack.push(neighbor);
      }
    }
  }

  return area;
}

function averageCell(cells: readonly number[], grid: WorldGrid): { x: number; z: number } {
  let sumX = 0;
  let sumZ = 0;

  for (const cell of cells) {
    sumX += grid.cellCenterX(cell);
    sumZ += grid.cellCenterZ(cell);
  }

  return { x: sumX / cells.length, z: sumZ / cells.length };
}

function isLakeKept(area: FloodedArea, centerDryness: number, options: CellThresholds): boolean {
  const catchmentNeeded = options.lakeMinimumCatchment * (1 + 6 * centerDryness);

  return (
    area.cells.length >= options.lakeMinimumCells &&
    area.maximumAccumulation >= catchmentNeeded &&
    area.maximumDepth >= options.lakeMinimumDepth
  );
}

function findLakes(
  heights: Float32Array,
  network: DrainageNetwork,
  grid: WorldGrid,
  dryness: Float32Array,
  options: CellThresholds,
  waterSurface: Float32Array,
  lakeIds: Int32Array
): Lake[] {
  const lakes: Lake[] = [];

  for (let cell = 0; cell < grid.cellCount; cell += 1) {
    if (lakeIds[cell] !== NO_CELL || network.filled[cell] - heights[cell] < FLOODED_DEPTH) {
      continue;
    }

    const id = lakes.length;

    const area = collectFloodedArea(cell, heights, network, grid, lakeIds, id);

    const center = averageCell(area.cells, grid);
    const centerDryness = dryness[grid.cellAt(center.x, center.z)];

    if (!isLakeKept(area, centerDryness, options)) {
      for (const floodedCell of area.cells) {
        lakeIds[floodedCell] = REJECTED_LAKE;
      }

      continue;
    }

    for (const floodedCell of area.cells) {
      waterSurface[floodedCell] = area.level;
    }

    lakes.push({
      cellCount: area.cells.length,
      centerX: center.x,
      centerZ: center.z,
      id,
      level: area.level,
      maximumDepth: area.maximumDepth,
    });
  }

  for (const [cell, lakeId] of lakeIds.entries()) {
    if (lakeId === REJECTED_LAKE) {
      lakeIds[cell] = NO_CELL;
    }
  }

  return lakes;
}

function buildUpstreamLists(isRiver: Uint8Array, receivers: Int32Array): Map<number, number[]> {
  const upstream = new Map<number, number[]>();

  for (const [cell, flag] of isRiver.entries()) {
    const receiver = receivers[cell];

    if (flag === 0 || receiver === NO_CELL || isRiver[receiver] === 0) {
      continue;
    }

    const list = upstream.get(receiver);

    if (list !== undefined) {
      list.push(cell);

      continue;
    }

    upstream.set(receiver, [cell]);
  }

  return upstream;
}

function largestByAccumulation(cells: readonly number[], accumulation: Float32Array): number {
  let best = NO_CELL;
  let bestAccumulation = -1;

  for (const cell of cells) {
    if (accumulation[cell] > bestAccumulation) {
      best = cell;
      bestAccumulation = accumulation[cell];
    }
  }

  return best;
}

function traceRiverChains(network: DrainageNetwork, lakeIds: Int32Array, options: CellThresholds): RiverChain[] {
  const isRiver = new Uint8Array(lakeIds.length);

  for (const [cell, accumulation] of network.accumulation.entries()) {
    if (accumulation >= options.riverThreshold && lakeIds[cell] === NO_CELL) {
      isRiver[cell] = 1;
    }
  }

  const upstream = buildUpstreamLists(isRiver, network.receivers);
  const pending: { joinsCell: number; mouth: number }[] = [];

  for (const [cell, flag] of isRiver.entries()) {
    const receiver = network.receivers[cell];

    if (flag === 1 && (receiver === NO_CELL || isRiver[receiver] === 0)) {
      pending.push({ joinsCell: NO_CELL, mouth: cell });
    }
  }

  const chains: RiverChain[] = [];

  for (let start = pending.pop(); start !== undefined; start = pending.pop()) {
    const cells = [start.mouth];
    let current = start.mouth;

    for (let sources = upstream.get(current); sources !== undefined; sources = upstream.get(current)) {
      const main = largestByAccumulation(sources, network.accumulation);

      for (const tributary of sources) {
        if (tributary !== main) {
          pending.push({ joinsCell: current, mouth: tributary });
        }
      }

      cells.push(main);
      current = main;
    }

    cells.reverse();
    chains.push({ cells, joinsCell: start.joinsCell, mouthReceiver: network.receivers[start.mouth] });
  }

  return chains;
}

function riverStrengthFor(flow: number, threshold: number): number {
  return Math.log2(Math.max(1, flow / threshold));
}

function riverPointFor(
  cell: number,
  heights: Float32Array,
  network: DrainageNetwork,
  grid: WorldGrid,
  threshold: number
): RiverPoint {
  const flow = network.accumulation[cell];

  const strength = riverStrengthFor(flow, threshold);

  return {
    depth: clamp(0.8 + 0.42 * strength, 0.8, 3.2),
    flow,
    surface: heights[cell] - 0.3,
    width: clamp(3.5 + 3.4 * strength, 3.5, 26),
    x: grid.cellCenterX(cell),
    z: grid.cellCenterZ(cell),
  };
}

function buildRivers(
  chains: readonly RiverChain[],
  heights: Float32Array,
  network: DrainageNetwork,
  grid: WorldGrid,
  lakes: readonly Lake[],
  lakeIds: Int32Array,
  threshold: number
): River[] {
  const rivers: River[] = [];

  for (const chain of chains) {
    const cells = [...chain.cells];

    if (chain.joinsCell !== NO_CELL) {
      cells.push(chain.joinsCell);
    }

    if (cells.length < 4) {
      continue;
    }

    const points = cells.map((cell) => riverPointFor(cell, heights, network, grid, threshold));
    const lakeId = lakeAtMouth(chain, lakeIds);

    if (lakeId >= 0) {
      appendLakeEntry(points, lakes[lakeId], chain.mouthReceiver, grid);
    }

    makeSurfaceDescend(points, 0.04);

    rivers.push({
      id: rivers.length,
      points: smoothRiverPath(points, 2),
      reachesEdge: chain.mouthReceiver === NO_CELL && chain.joinsCell === NO_CELL,
    });
  }

  return rivers;
}

function lakeAtMouth(chain: RiverChain, lakeIds: Int32Array): number {
  if (chain.mouthReceiver === NO_CELL || chain.joinsCell !== NO_CELL) {
    return NO_CELL;
  }

  return lakeIds[chain.mouthReceiver];
}

function appendLakeEntry(points: RiverPoint[], lake: Lake, lakeCell: number, grid: WorldGrid): void {
  const last = points.at(-1);

  if (last === undefined) {
    return;
  }

  for (const point of points) {
    point.surface = Math.max(point.surface, lake.level);
  }

  points.push({ ...last, surface: lake.level, x: grid.cellCenterX(lakeCell), z: grid.cellCenterZ(lakeCell) });
}

function bankWidthOf(point: RiverPoint): number {
  return Math.max(MINIMUM_BANK_WIDTH, point.width);
}

function channelBed(distanceFromCenter: number, point: RiverPoint, uncarvedHeight: number): number {
  const halfWidth = point.width / 2;

  if (distanceFromCenter < halfWidth) {
    const across = distanceFromCenter / halfWidth;

    return point.surface - point.depth * (1 - across * across * 0.7);
  }

  const bank = smoothstep(0, 1, (distanceFromCenter - halfWidth) / bankWidthOf(point));

  const shapedBank = point.surface - 0.3 * point.depth + (0.3 * point.depth + BANK_HEIGHT) * bank;
  const lowestBank = uncarvedHeight - (0.3 * point.depth + DEEPEST_BANK_CUT) * (1 - bank);

  return Math.max(shapedBank, lowestBank);
}

interface ChannelTargets {
  grid: WorldGrid;
  heights: Float32Array;
  lakeIds: Int32Array;
  riverStrength: Uint8Array;
  threshold: number;
  uncarvedHeights: Float32Array;
  waterSurface: Float32Array;
}

function carveSegment(start: RiverPoint, end: RiverPoint, targets: ChannelTargets): void {
  const { grid } = targets;
  const segmentX = end.x - start.x;
  const segmentZ = end.z - start.z;

  const reach =
    Math.max(start.width, end.width) / 2 + Math.max(MINIMUM_BANK_WIDTH, start.width, end.width) + grid.cellSize;
  const lengthSquared = Math.max(1e-6, segmentX * segmentX + segmentZ * segmentZ);

  const firstColumn = Math.max(0, grid.columnAt(Math.min(start.x, end.x) - reach));
  const lastColumn = Math.min(grid.cellsPerSide - 1, grid.columnAt(Math.max(start.x, end.x) + reach));
  const firstRow = Math.max(0, grid.rowAt(Math.min(start.z, end.z) - reach));
  const lastRow = Math.min(grid.cellsPerSide - 1, grid.rowAt(Math.max(start.z, end.z) + reach));

  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const x = grid.centerX(column);
      const z = grid.centerZ(row);

      const along = saturate(((x - start.x) * segmentX + (z - start.z) * segmentZ) / lengthSquared);

      const point = interpolatePoint(start, end, along);

      const distanceFromCenter = Math.hypot(x - point.x, z - point.z);

      carveCell(grid.index(column, row), distanceFromCenter, point, targets);
    }
  }
}

function carveCell(cell: number, distanceFromCenter: number, point: RiverPoint, targets: ChannelTargets): void {
  const halfWidth = point.width / 2;

  if (distanceFromCenter > halfWidth + bankWidthOf(point)) {
    return;
  }

  const bed = channelBed(distanceFromCenter, point, targets.uncarvedHeights[cell]);
  const isUnderWater =
    distanceFromCenter <= Math.max(halfWidth, targets.grid.cellSize * DIAGONAL_REACH) ||
    bed < point.surface - SHALLOWEST_WATER;

  if (!isUnderWater) {
    targets.heights[cell] = Math.min(targets.heights[cell], Math.max(bed, point.surface));

    return;
  }

  targets.heights[cell] = Math.min(targets.heights[cell], bed, point.surface - point.depth * BANK_DEPTH);

  if (targets.lakeIds[cell] !== NO_CELL) {
    return;
  }

  targets.waterSurface[cell] = Math.max(targets.waterSurface[cell], point.surface);

  const strength = Math.round(clamp(40 + riverStrengthFor(point.flow, targets.threshold) * 30, 0, 255));

  targets.riverStrength[cell] = Math.max(targets.riverStrength[cell], strength);
}

function carveRivers(rivers: readonly River[], targets: ChannelTargets): void {
  for (const river of rivers) {
    for (let pointIndex = 1; pointIndex < river.points.length; pointIndex += 1) {
      carveSegment(river.points[pointIndex - 1], river.points[pointIndex], targets);
    }
  }
}

interface EdgeDirection {
  directionX: number;
  directionZ: number;
}

function edgeDirection(x: number, z: number, grid: WorldGrid): EdgeDirection {
  const distanceWest = x + grid.halfSize;
  const distanceEast = grid.halfSize - x;
  const distanceNorth = z + grid.halfSize;
  const distanceSouth = grid.halfSize - z;

  const nearestDistance = Math.min(distanceWest, distanceEast, distanceNorth, distanceSouth);

  if (nearestDistance === distanceWest) {
    return { directionX: -1, directionZ: 0 };
  }

  if (nearestDistance === distanceEast) {
    return { directionX: 1, directionZ: 0 };
  }

  if (nearestDistance === distanceNorth) {
    return { directionX: 0, directionZ: -1 };
  }

  return { directionX: 0, directionZ: 1 };
}

function findWaterfalls(rivers: readonly River[], grid: WorldGrid): Waterfall[] {
  const waterfalls: Waterfall[] = [];

  for (const river of rivers) {
    const mouth = river.points.at(-1);

    if (!river.reachesEdge || mouth === undefined) {
      continue;
    }

    waterfalls.push({
      ...edgeDirection(mouth.x, mouth.z, grid),
      top: mouth.surface,
      width: mouth.width,
      x: mouth.x,
      z: mouth.z,
    });
  }

  return waterfalls;
}

function dropShallowWater(heights: Float32Array, waterSurface: Float32Array, riverStrength: Uint8Array): void {
  for (let cell = 0; cell < waterSurface.length; cell += 1) {
    if (waterSurface[cell] !== NO_WATER && !hasWater(waterSurface[cell], heights[cell])) {
      waterSurface[cell] = NO_WATER;
      riverStrength[cell] = 0;
    }
  }
}

export function analyzeDrainage(
  heights: Float32Array,
  grid: WorldGrid,
  dryness: Float32Array,
  options: HydrologyOptions = DEFAULT_HYDROLOGY
): DrainageBasins {
  const thresholds = toCellThresholds(options, grid);
  const network = fillDepressions(heights, grid);
  const waterSurface = new Float32Array(grid.cellCount).fill(NO_WATER);
  const lakeIds = new Int32Array(grid.cellCount).fill(NO_CELL);

  const lakes = findLakes(heights, network, grid, dryness, thresholds, waterSurface, lakeIds);

  return { lakeIds, lakes, network, riverThreshold: thresholds.riverThreshold, waterSurface };
}

export function computeHydrology(
  heights: Float32Array,
  grid: WorldGrid,
  dryness: Float32Array,
  options: HydrologyOptions = DEFAULT_HYDROLOGY
): HydrologyResult {
  const thresholds = toCellThresholds(options, grid);
  const { lakeIds, lakes, network, waterSurface } = analyzeDrainage(heights, grid, dryness, options);
  const riverStrength = new Uint8Array(grid.cellCount);

  const chains = traceRiverChains(network, lakeIds, thresholds);

  const rivers = buildRivers(chains, heights, network, grid, lakes, lakeIds, thresholds.riverThreshold);
  const uncarvedHeights = Float32Array.from(heights);

  carveRivers(rivers, {
    grid,
    heights,
    lakeIds,
    riverStrength,
    threshold: thresholds.riverThreshold,
    uncarvedHeights,
    waterSurface,
  });
  dropShallowWater(heights, waterSurface, riverStrength);

  return {
    features: { lakes, rivers, waterfalls: findWaterfalls(rivers, grid) },
    lakeIds,
    riverStrength,
    waterSurface,
  };
}

import { clamp } from "../../shared/math.ts";
import { MinHeap } from "../../shared/min-heap.ts";
import { NEIGHBOR_OFFSETS } from "../../world/world-grid.ts";
import type { WorldState } from "../world/world-state.ts";
import { nearestWalkableSpot } from "./walkable-ground.ts";

const NODE_SIZE = 40;
const LINE_SAMPLE_SPACING = 7;
const STEEP_SLOPE = 0.9;
const MODERATE_SLOPE = 0.55;
const IMPASSABLE_WATER_SHARE = 0.45;
const IMPASSABLE_STEEP_SHARE = 0.7;
const SEARCH_LIMIT = 6000;
const DIAGONAL_HEURISTIC = Math.SQRT2 - 1;
const LANDING_SEARCH_RADIUS = 120;
const NO_SHORE = 65_535;
const SHORE_INSET = 0.5;

export interface Waypoint {
  x: number;
  z: number;
}

export function aroundPoint(center: Waypoint, distance: number, angle: number): Waypoint {
  return { x: center.x + Math.cos(angle) * distance, z: center.z + Math.sin(angle) * distance };
}

export class NavigationGrid {
  readonly #cameFrom: Int32Array;
  readonly #closedInSearch: Int32Array;
  readonly #heap: MinHeap;
  readonly #nodeCost: Float32Array;
  readonly #nodesPerSide: number;
  readonly #pathCost: Float32Array;
  readonly #seenInSearch: Int32Array;
  readonly #shoreQueue: Int32Array;
  readonly #shoreSteps: Uint16Array;
  readonly #leadsToSteepShore: Uint8Array;
  readonly #world: WorldState;
  #builtHeightVersion = -1;
  #builtWaterVersion = -1;
  #searchNumber = 0;

  constructor(world: WorldState) {
    this.#world = world;
    this.#nodesPerSide = Math.ceil(world.grid.worldSize / NODE_SIZE);

    const nodeCount = this.#nodesPerSide * this.#nodesPerSide;

    this.#nodeCost = new Float32Array(nodeCount);
    this.#pathCost = new Float32Array(nodeCount);
    this.#cameFrom = new Int32Array(nodeCount);
    this.#seenInSearch = new Int32Array(nodeCount);
    this.#closedInSearch = new Int32Array(nodeCount);
    this.#heap = new MinHeap(nodeCount);
    this.#shoreQueue = new Int32Array(world.grid.cellCount);
    this.#shoreSteps = new Uint16Array(world.grid.cellCount);
    this.#leadsToSteepShore = new Uint8Array(world.grid.cellCount);
    this.rebuild();
  }

  rebuild(): void {
    for (let node = 0; node < this.#nodeCost.length; node += 1) {
      this.#nodeCost[node] = this.#measureNodeCost(node);
    }

    this.#measureShores();

    this.#builtHeightVersion = this.#world.heightVersion;
    this.#builtWaterVersion = this.#world.waterVersion;
  }

  rebuildIfChanged(): boolean {
    const world = this.#world;

    if (world.heightVersion === this.#builtHeightVersion && world.waterVersion === this.#builtWaterVersion) {
      return false;
    }

    this.rebuild();

    return true;
  }

  isPassable(x: number, z: number): boolean {
    return this.#world.isWalkableAt(x, z);
  }

  landingSpot(point: Waypoint, wadingDepth: number): Waypoint {
    const world = this.#world;

    const cell = world.grid.cellAt(point.x, point.z);

    if (cell < 0 || !world.isWater(cell) || world.waterDepth(cell) < wadingDepth) {
      return point;
    }

    return nearestWalkableSpot(world, point, LANDING_SEARCH_RADIUS);
  }

  stepAshore(x: number, z: number): Waypoint | null {
    const world = this.#world;
    const { grid } = world;

    const cell = grid.cellAt(x, z);

    if (cell < 0 || !world.isWater(cell)) {
      return null;
    }

    const steps = this.#shoreSteps[cell];

    if (steps === 0) {
      return this.#nearestDryLand(x, z);
    }

    if (steps === NO_SHORE) {
      return null;
    }

    return this.#nearestStepAshore(cell, x, z);
  }

  hasClearLine(fromX: number, fromZ: number, toX: number, toZ: number): boolean {
    const length = Math.hypot(toX - fromX, toZ - fromZ);

    const samples = Math.ceil(length / LINE_SAMPLE_SPACING);

    for (let sample = 1; sample <= samples; sample += 1) {
      const amount = sample / samples;

      if (!this.isPassable(fromX + (toX - fromX) * amount, fromZ + (toZ - fromZ) * amount)) {
        return false;
      }
    }

    return true;
  }

  findPath(from: Waypoint, to: Waypoint): Waypoint[] | null {
    if (this.hasClearLine(from.x, from.z, to.x, to.z)) {
      return [{ x: to.x, z: to.z }];
    }

    const start = this.#nodeAt(from.x, from.z);
    const goal = this.#nodeAt(to.x, to.z);

    if (!Number.isFinite(this.#nodeCost[goal])) {
      return null;
    }

    if (!this.#runSearch(start, goal)) {
      return null;
    }

    const route = this.#reconstruct(start, goal);

    route[route.length - 1] = { x: to.x, z: to.z };

    return this.#straighten(from, route);
  }

  #measureNodeCost(node: number): number {
    const world = this.#world;
    const cellsPerNode = Math.max(1, Math.round(NODE_SIZE / world.grid.cellSize));

    const firstColumn = (node % this.#nodesPerSide) * cellsPerNode;
    const firstRow = Math.floor(node / this.#nodesPerSide) * cellsPerNode;
    const step = Math.max(1, Math.floor(cellsPerNode / 2));

    let samples = 0;
    let waterSamples = 0;
    let steepness = 0;

    for (let row = firstRow; row < firstRow + cellsPerNode; row += step) {
      for (let column = firstColumn; column < firstColumn + cellsPerNode; column += step) {
        if (!world.grid.contains(column, row)) {
          continue;
        }

        const cell = world.grid.index(column, row);

        samples += 1;
        waterSamples += world.isWater(cell) || !world.isOnIsland(cell) ? 1 : 0;
        steepness += slopePenalty(world.slope(cell));
      }
    }

    return costFromShares(waterSamples / Math.max(1, samples), steepness / Math.max(1, samples));
  }

  #measureShores(): void {
    const world = this.#world;

    for (let cell = 0; cell < world.grid.cellCount; cell += 1) {
      this.#shoreSteps[cell] = world.isWater(cell) ? NO_SHORE : 0;
      this.#leadsToSteepShore[cell] = 0;
    }

    this.#spreadFromShore((cell) => world.isWalkable(cell), 0);
    this.#spreadFromShore((cell) => isDryLand(world, cell), 1);
  }

  #spreadFromShore(isShore: (cell: number) => boolean, leadsToSteepShore: number): void {
    const { grid } = this.#world;
    const steps = this.#shoreSteps;
    const queue = this.#shoreQueue;

    let length = 0;

    for (let cell = 0; cell < grid.cellCount; cell += 1) {
      if (steps[cell] === NO_SHORE && this.#bordersOn(cell, isShore)) {
        steps[cell] = 1;
        this.#leadsToSteepShore[cell] = leadsToSteepShore;
        queue[length] = cell;
        length += 1;
      }
    }

    for (let next = 0; next < length; next += 1) {
      const cell = queue[next];

      for (const neighbor of this.#neighborsOf(cell)) {
        if (steps[neighbor] === NO_SHORE) {
          steps[neighbor] = steps[cell] + 1;
          this.#leadsToSteepShore[neighbor] = leadsToSteepShore;
          queue[length] = neighbor;
          length += 1;
        }
      }
    }
  }

  #bordersOn(cell: number, isShore: (cell: number) => boolean): boolean {
    return this.#neighborsOf(cell).some((neighbor) => isShore(neighbor));
  }

  #neighborsOf(cell: number): number[] {
    const { grid } = this.#world;

    const column = grid.columnOf(cell);
    const row = grid.rowOf(cell);
    const neighbors: number[] = [];

    for (const offset of NEIGHBOR_OFFSETS) {
      if (grid.contains(column + offset.column, row + offset.row)) {
        neighbors.push(grid.index(column + offset.column, row + offset.row));
      }
    }

    return neighbors;
  }

  #nearestStepAshore(cell: number, x: number, z: number): Waypoint | null {
    const world = this.#world;
    const closer = this.#shoreSteps[cell] - 1;

    let nearest: Waypoint | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const neighbor of this.#neighborsOf(cell)) {
      if (!this.#isStepAshore(neighbor, closer, this.#leadsToSteepShore[cell] === 1)) {
        continue;
      }

      const spot = pointInside(world, neighbor, x, z);

      const distance = Math.hypot(spot.x - x, spot.z - z);

      if (distance < nearestDistance) {
        nearest = spot;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  #isStepAshore(cell: number, steps: number, isSteepShore: boolean): boolean {
    const world = this.#world;

    if (steps > 0) {
      return world.isWater(cell) && this.#shoreSteps[cell] === steps;
    }

    if (isSteepShore) {
      return isDryLand(world, cell);
    }

    return world.isWalkable(cell);
  }

  #nearestDryLand(x: number, z: number): Waypoint | null {
    const landing = nearestWalkableSpot(this.#world, { x, z }, LANDING_SEARCH_RADIUS);

    if (landing.x === x && landing.z === z) {
      return null;
    }

    return landing;
  }

  #nodeAt(x: number, z: number): number {
    const { halfSize } = this.#world.grid;

    const lastNode = this.#nodesPerSide - 1;

    const column = clamp(Math.floor((x + halfSize) / NODE_SIZE), 0, lastNode);
    const row = clamp(Math.floor((z + halfSize) / NODE_SIZE), 0, lastNode);

    return row * this.#nodesPerSide + column;
  }

  #nodeCenter(node: number): Waypoint {
    const { halfSize } = this.#world.grid;

    return {
      x: -halfSize + ((node % this.#nodesPerSide) + 0.5) * NODE_SIZE,
      z: -halfSize + (Math.floor(node / this.#nodesPerSide) + 0.5) * NODE_SIZE,
    };
  }

  #heuristic(node: number, goal: number): number {
    const columnDistance = Math.abs((node % this.#nodesPerSide) - (goal % this.#nodesPerSide));
    const rowDistance = Math.abs(Math.floor(node / this.#nodesPerSide) - Math.floor(goal / this.#nodesPerSide));

    return Math.max(columnDistance, rowDistance) + DIAGONAL_HEURISTIC * Math.min(columnDistance, rowDistance);
  }

  #runSearch(start: number, goal: number): boolean {
    this.#searchNumber += 1;

    const search = this.#searchNumber;

    this.#heap.clear();
    this.#pathCost[start] = 0;
    this.#seenInSearch[start] = search;
    this.#cameFrom[start] = -1;
    this.#heap.push(start, this.#heuristic(start, goal));

    for (let expanded = 0; this.#heap.size > 0 && expanded < SEARCH_LIMIT; expanded += 1) {
      const node = this.#heap.pop();

      if (node === goal) {
        return true;
      }

      if (this.#closedInSearch[node] !== search) {
        this.#closedInSearch[node] = search;
        this.#expand(node, goal, search);
      }
    }

    return false;
  }

  #expand(node: number, goal: number, search: number): void {
    const column = node % this.#nodesPerSide;
    const row = Math.floor(node / this.#nodesPerSide);

    for (const offset of NEIGHBOR_OFFSETS) {
      const neighborColumn = column + offset.column;
      const neighborRow = row + offset.row;

      if (!this.#containsNode(neighborColumn, neighborRow)) {
        continue;
      }

      const neighbor = neighborRow * this.#nodesPerSide + neighborColumn;

      const cost = this.#nodeCost[neighbor];

      if (!Number.isFinite(cost) || this.#closedInSearch[neighbor] === search) {
        continue;
      }

      const pathCost = this.#pathCost[node] + cost * offset.distance;

      if (this.#seenInSearch[neighbor] !== search || pathCost < this.#pathCost[neighbor]) {
        this.#seenInSearch[neighbor] = search;
        this.#pathCost[neighbor] = pathCost;
        this.#cameFrom[neighbor] = node;
        this.#heap.push(neighbor, pathCost + this.#heuristic(neighbor, goal));
      }
    }
  }

  #containsNode(column: number, row: number): boolean {
    return column >= 0 && row >= 0 && column < this.#nodesPerSide && row < this.#nodesPerSide;
  }

  #reconstruct(start: number, goal: number): Waypoint[] {
    const route: Waypoint[] = [];

    for (let node = goal; node !== -1 && node !== start; node = this.#cameFrom[node]) {
      route.push(this.#dryNodeCenter(node));
    }

    if (route.length === 0) {
      route.push(this.#dryNodeCenter(goal));
    }

    return route.reverse();
  }

  #dryNodeCenter(node: number): Waypoint {
    return nearestWalkableSpot(this.#world, this.#nodeCenter(node), NODE_SIZE / 2);
  }

  #straighten(from: Waypoint, route: readonly Waypoint[]): Waypoint[] {
    const straightened: Waypoint[] = [];

    let current = from;
    let next = 0;

    while (next < route.length) {
      const farthest = this.#farthestVisible(current, route, next);

      straightened.push(route[farthest]);
      current = route[farthest];
      next = farthest + 1;
    }

    return straightened;
  }

  #farthestVisible(from: Waypoint, route: readonly Waypoint[], first: number): number {
    for (let candidate = route.length - 1; candidate > first; candidate -= 1) {
      if (this.hasClearLine(from.x, from.z, route[candidate].x, route[candidate].z)) {
        return candidate;
      }
    }

    return first;
  }
}

function isDryLand(world: WorldState, cell: number): boolean {
  return world.isOnIsland(cell) && !world.isWater(cell);
}

function pointInside(world: WorldState, cell: number, x: number, z: number): Waypoint {
  const { grid } = world;

  const reach = grid.cellSize / 2 - SHORE_INSET;
  const centerX = grid.cellCenterX(cell);
  const centerZ = grid.cellCenterZ(cell);

  return { x: clamp(x, centerX - reach, centerX + reach), z: clamp(z, centerZ - reach, centerZ + reach) };
}

function slopePenalty(slope: number): number {
  if (slope > STEEP_SLOPE) {
    return 1;
  }

  if (slope > MODERATE_SLOPE) {
    return 0.4;
  }

  return 0;
}

function costFromShares(waterShare: number, steepShare: number): number {
  if (waterShare > IMPASSABLE_WATER_SHARE || steepShare > IMPASSABLE_STEEP_SHARE) {
    return Number.POSITIVE_INFINITY;
  }

  return 1 + steepShare * 6 + waterShare * 4;
}

import { clamp, distanceSquared } from "../../shared/math.ts";
import type { WorldState } from "../world/world-state.ts";
import type { Waypoint } from "./navigation.ts";

const EDGE_INSET = 0.5;
const STAND_DIRECTIONS = 8;

export function pointInsideCell(world: WorldState, cell: number, x: number, z: number): Waypoint {
  const { grid } = world;

  const reach = grid.cellSize / 2 - EDGE_INSET;
  const centerX = grid.cellCenterX(cell);
  const centerZ = grid.cellCenterZ(cell);

  return { x: clamp(x, centerX - reach, centerX + reach), z: clamp(z, centerZ - reach, centerZ + reach) };
}

export function isDryFooting(world: WorldState, cell: number): boolean {
  return world.isWalkable(cell) && !world.touchesWater(cell);
}

export function dryStandSpot(world: WorldState, target: Waypoint, standOff: number, from: Waypoint): Waypoint | null {
  const approach = Math.atan2(from.x - target.x, from.z - target.z);

  for (let turn = 0; turn < STAND_DIRECTIONS; turn += 1) {
    const side = turn % 2 === 0 ? 1 : -1;
    const angle = approach + side * Math.ceil(turn / 2) * ((2 * Math.PI) / STAND_DIRECTIONS);

    const spot = { x: target.x + Math.sin(angle) * standOff, z: target.z + Math.cos(angle) * standOff };

    if (isDryFooting(world, world.grid.cellAt(spot.x, spot.z))) {
      return spot;
    }
  }

  return null;
}

export function nearestDrySpot(world: WorldState, point: Waypoint, searchRadius: number): Waypoint {
  if (isDryFooting(world, world.grid.cellAt(point.x, point.z))) {
    return point;
  }

  let nearest: Waypoint | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const cell of world.grid.cellsInRadius(point.x, point.z, searchRadius)) {
    if (!isDryFooting(world, cell)) {
      continue;
    }

    const spot = pointInsideCell(world, cell, point.x, point.z);

    const distance = distanceSquared(point.x, point.z, spot.x, spot.z);

    if (distance < nearestDistance) {
      nearest = spot;
      nearestDistance = distance;
    }
  }

  return nearest === null ? nearestWalkableSpot(world, point, searchRadius) : nearest;
}

export function nearestWalkableSpot(world: WorldState, point: Waypoint, searchRadius: number): Waypoint {
  if (world.isWalkableAt(point.x, point.z)) {
    return point;
  }

  let nearest = point;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const cell of world.grid.cellsInRadius(point.x, point.z, searchRadius)) {
    if (!world.isWalkable(cell)) {
      continue;
    }

    const spot = pointInsideCell(world, cell, point.x, point.z);

    const distance = distanceSquared(point.x, point.z, spot.x, spot.z);

    if (distance < nearestDistance) {
      nearest = spot;
      nearestDistance = distance;
    }
  }

  return nearest;
}

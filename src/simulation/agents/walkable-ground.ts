import { clamp, distanceSquared } from "../../shared/math.ts";
import type { WorldState } from "../world/world-state.ts";
import type { Waypoint } from "./navigation.ts";

const EDGE_INSET = 0.5;

export function pointInsideCell(world: WorldState, cell: number, x: number, z: number): Waypoint {
  const { grid } = world;

  const reach = grid.cellSize / 2 - EDGE_INSET;
  const centerX = grid.cellCenterX(cell);
  const centerZ = grid.cellCenterZ(cell);

  return { x: clamp(x, centerX - reach, centerX + reach), z: clamp(z, centerZ - reach, centerZ + reach) };
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

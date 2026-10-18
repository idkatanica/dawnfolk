import { clamp, distanceSquared } from "../../shared/math.ts";
import type { WorldState } from "../world/world-state.ts";
import type { Waypoint } from "./navigation.ts";

const EDGE_INSET = 0.5;

export function nearestWalkableSpot(world: WorldState, point: Waypoint, searchRadius: number): Waypoint {
  if (world.isWalkableAt(point.x, point.z)) {
    return point;
  }

  const { grid } = world;

  const reach = grid.cellSize / 2 - EDGE_INSET;

  let nearest = point;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const cell of grid.cellsInRadius(point.x, point.z, searchRadius)) {
    if (!world.isWalkable(cell)) {
      continue;
    }

    const centerX = grid.cellCenterX(cell);
    const centerZ = grid.cellCenterZ(cell);

    const x = clamp(point.x, centerX - reach, centerX + reach);
    const z = clamp(point.z, centerZ - reach, centerZ + reach);

    const distance = distanceSquared(point.x, point.z, x, z);

    if (distance < nearestDistance) {
      nearest = { x, z };
      nearestDistance = distance;
    }
  }

  return nearest;
}

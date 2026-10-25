import { ANIMAL_KINDS, ANIMALS } from "../../content/animals.ts";
import type { WorldState } from "../world/world-state.ts";
import { isInOpenWater } from "./hops.ts";
import { hasArrived, type Mover } from "./movement.ts";

const LARGEST_BODY_RADIUS = Math.max(...ANIMAL_KINDS.map((kind) => ANIMALS[kind].bodyRadius));
const SOFTNESS = 0.5;
const GOAL_MARGIN = 1;
const CROWD_FRUSTRATION = 0.5;
const NO_PUSH = { x: 0, z: 0 };

interface Push {
  readonly mover: Mover;
  readonly x: number;
  readonly z: number;
}

function isWalking(mover: Mover): boolean {
  return mover.hop === null && !hasArrived(mover);
}

function isNearGoal(mover: Mover): boolean {
  const distance = Math.hypot(mover.goalX - mover.x, mover.goalZ - mover.z);

  return distance < mover.arrivalDistance + mover.radius * 2 + GOAL_MARGIN;
}

function mayBePushed(mover: Mover): boolean {
  return isWalking(mover) && !isNearGoal(mover);
}

export function keepApart(movers: readonly Mover[], world: WorldState, seconds: number): void {
  const crowd = new Map<number, Mover[]>();

  for (const mover of movers) {
    const cell = world.grid.cellAt(mover.x, mover.z);
    const neighbours = crowd.get(cell);

    if (neighbours === undefined) {
      crowd.set(cell, [mover]);
    } else {
      neighbours.push(mover);
    }
  }

  const pushes = movers.filter(mayBePushed).map((mover) => pushAway(mover, crowd, world));

  for (const push of pushes) {
    nudge(push, world, seconds);
  }
}

function pushAway(mover: Mover, crowd: ReadonlyMap<number, readonly Mover[]>, world: WorldState): Push {
  const { grid } = world;

  const bounds = grid.circleBounds(mover.x, mover.z, mover.radius + LARGEST_BODY_RADIUS);

  let x = 0;
  let z = 0;

  for (let row = bounds.firstRow; row <= bounds.lastRow; row += 1) {
    for (let column = bounds.firstColumn; column <= bounds.lastColumn; column += 1) {
      const neighbours = crowd.get(grid.index(column, row));

      if (neighbours === undefined) {
        continue;
      }

      for (const other of neighbours) {
        const push = pushFrom(mover, other);

        x += push.x;
        z += push.z;
      }
    }
  }

  return { mover, x, z };
}

function pushFrom(mover: Mover, other: Mover): { x: number; z: number } {
  if (other === mover) {
    return NO_PUSH;
  }

  const apart = mover.radius + other.radius;
  const offsetX = mover.x - other.x;
  const offsetZ = mover.z - other.z;

  if (offsetX * offsetX + offsetZ * offsetZ >= apart * apart) {
    return NO_PUSH;
  }

  const distance = Math.hypot(offsetX, offsetZ);

  const share = isWalking(other) ? SOFTNESS / 2 : SOFTNESS;
  const overlap = (apart - distance) * share;

  if (distance === 0) {
    return { x: Math.cos(mover.heading) * overlap, z: -Math.sin(mover.heading) * overlap };
  }

  return { x: (offsetX / distance) * overlap, z: (offsetZ / distance) * overlap };
}

function nudge(push: Push, world: WorldState, seconds: number): void {
  const { mover } = push;

  const length = Math.hypot(push.x, push.z);

  if (length === 0) {
    return;
  }

  const scale = Math.min(1, mover.radius / length);
  const x = mover.x + push.x * scale;
  const z = mover.z + push.z * scale;

  const cell = world.grid.cellAt(x, z);

  if (!world.isOnIsland(cell) || world.isObstructed(cell) || isInOpenWater(world, x, z)) {
    return;
  }

  if (push.x * mover.velocityX + push.z * mover.velocityZ < 0) {
    mover.stuckSeconds += seconds * CROWD_FRUSTRATION;
  }

  mover.x = x;
  mover.z = z;
}

import { setDestination } from "../../agents/movement.ts";
import type { Waypoint } from "../../agents/navigation.ts";
import type { WorldState } from "../../world/world-state.ts";
import { dropCarrying, runSpeed } from "../person.ts";
import type { PersonTick } from "../society-context.ts";
import { type Job, walk } from "./job.ts";

export const DANGER_AWARENESS = 70;

const FLEE_OFFSETS: readonly number[] = [0, 0.5, -0.5, 1, -1, 1.6, -1.6];
const FLEE_DISTANCE = 150;
const LOOKAHEAD_STEP = 38;
const LOOKAHEAD_STEPS = 4;
const HOT_GROUND = 0.03;
const BURNT_OUT = 0.8;
const STEEP = 1;

export class FleeJob implements Job {
  readonly kind = "flee";

  constructor(tick: PersonTick, danger: Waypoint) {
    const { person } = tick;

    const heading = safestHeading(tick.context.world, person.mover, danger);

    const refuge = {
      x: person.mover.x + Math.sin(heading) * FLEE_DISTANCE,
      z: person.mover.z + Math.cos(heading) * FLEE_DISTANCE,
    };

    person.fear = 1;
    person.mover.canWade = true;
    dropCarrying(person);
    setDestination(person.mover, refuge, tick.context.navigation, { mayPlanRoute: false });
  }

  update(tick: PersonTick): Job | null {
    if (!walk(tick, runSpeed(tick.person))) {
      return this;
    }

    tick.person.fear *= 0.5;

    const danger = tick.context.hazards.dangerNear(tick.person.mover.x, tick.person.mover.z, DANGER_AWARENESS);

    if (danger !== null) {
      return new FleeJob(tick, danger);
    }

    tick.person.mover.canWade = false;

    return null;
  }
}

function safestHeading(world: WorldState, from: Waypoint, danger: Waypoint): number {
  const away = Math.atan2(from.x - danger.x, from.z - danger.z);

  let bestScore = Number.NEGATIVE_INFINITY;
  let bestHeading = away;

  for (const offset of FLEE_OFFSETS) {
    const heading = away + offset;

    const score = routeScore(world, from, heading) - Math.abs(offset) * 0.8;

    if (score > bestScore) {
      bestScore = score;
      bestHeading = heading;
    }
  }

  return bestHeading;
}

function routeScore(world: WorldState, from: Waypoint, heading: number): number {
  let score = 0;

  for (let step = 1; step <= LOOKAHEAD_STEPS; step += 1) {
    const cell = world.grid.cellAt(
      from.x + Math.sin(heading) * LOOKAHEAD_STEP * step,
      from.z + Math.cos(heading) * LOOKAHEAD_STEP * step
    );

    if (cell < 0) {
      return score - 8;
    }

    score += cellScore(world, cell) / step;
  }

  return score;
}

function cellScore(world: WorldState, cell: number): number {
  const { fields } = world;

  let score = 0;

  if (fields.fire[cell] > 0) {
    score -= 6;
  } else if (fields.heat[cell] > HOT_GROUND) {
    score -= 1.5;
  }

  if (world.isWater(cell)) {
    score += world.waterDepth(cell) < 1 ? 1 : 0.2;
  } else if (fields.scorch[cell] > BURNT_OUT) {
    score += 0.6;
  }

  if (world.slope(cell) > STEEP) {
    score -= 2;
  }

  return score;
}

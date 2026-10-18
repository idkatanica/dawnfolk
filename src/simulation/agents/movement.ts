import { groundDefinition } from "../../content/grounds.ts";
import { wrapAngle } from "../../shared/math.ts";
import type { WorldState } from "../world/world-state.ts";
import type { NavigationGrid, Waypoint } from "./navigation.ts";
import { nearestWalkableSpot } from "./walkable-ground.ts";

const SHORT_TRIP = 90;
const FINAL_ARRIVAL_DISTANCE = 1.2;
const WAYPOINT_ARRIVAL_DISTANCE = 6;
const SWIMMING_SPEED = 0.45;
const DEFLECTIONS: readonly number[] = [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9];
const PROBE_DISTANCE = 2.5;
const CLIMBABLE_SLOPE = 1.2;
const WADING_DEPTH = 1.1;
const GIVE_UP_SECONDS = 2.5;
const TURN_RATE = 8;
const UPHILL_DRAG = 1.6;
const DEFLECTION_FRUSTRATION = 0.3;
const SHORE_SEARCH_RADIUS = 40;
const REPLAN_PROGRESS = 2;
const MAXIMUM_FUTILE_REPLANS = 3;

export interface Mover {
  canWade: boolean;
  closestReplanDistance: number;
  futileReplans: number;
  goalX: number;
  goalZ: number;
  heading: number;
  path: Waypoint[];
  pathIndex: number;
  stuckSeconds: number;
  velocityX: number;
  velocityZ: number;
  x: number;
  z: number;
}

export function createMover(x: number, z: number, heading: number): Mover {
  return {
    canWade: false,
    closestReplanDistance: Number.POSITIVE_INFINITY,
    futileReplans: 0,
    goalX: x,
    goalZ: z,
    heading,
    path: [],
    pathIndex: 0,
    stuckSeconds: 0,
    velocityX: 0,
    velocityZ: 0,
    x,
    z,
  };
}

export function setDestination(
  mover: Mover,
  destination: Waypoint,
  navigation: NavigationGrid,
  mayPlanRoute = true
): void {
  mover.goalX = destination.x;
  mover.goalZ = destination.z;
  mover.path = planRoute(mover, destination, navigation, mayPlanRoute);
  mover.pathIndex = 0;
  forgetReplans(mover);
  mover.stuckSeconds = 0;
}

function planRoute(mover: Mover, destination: Waypoint, navigation: NavigationGrid, mayPlanRoute: boolean): Waypoint[] {
  const distance = Math.hypot(destination.x - mover.x, destination.z - mover.z);

  if (distance < SHORT_TRIP || !mayPlanRoute) {
    return [{ x: destination.x, z: destination.z }];
  }

  const route = navigation.findPath(mover, destination);

  if (route === null) {
    return [{ x: destination.x, z: destination.z }];
  }

  return route;
}

export function hasArrived(mover: Mover): boolean {
  return mover.pathIndex >= mover.path.length;
}

export function stopMoving(mover: Mover): void {
  mover.velocityX = 0;
  mover.velocityZ = 0;
}

export function faceTowards(mover: Mover, x: number, z: number): void {
  mover.heading = Math.atan2(x - mover.x, z - mover.z);
}

export function moveAlong(
  mover: Mover,
  seconds: number,
  speed: number,
  world: WorldState,
  navigation: NavigationGrid
): boolean {
  if (hasArrived(mover)) {
    stopMoving(mover);

    return true;
  }

  const waypoint = mover.path[mover.pathIndex];
  const isFinalWaypoint = mover.pathIndex === mover.path.length - 1;

  const distanceLeft = Math.hypot(waypoint.x - mover.x, waypoint.z - mover.z);
  const arrivalDistance = isFinalWaypoint ? FINAL_ARRIVAL_DISTANCE : WAYPOINT_ARRIVAL_DISTANCE;

  if (distanceLeft < arrivalDistance) {
    mover.pathIndex += 1;
    stopMoving(mover);
    forgetReplans(mover);

    return hasArrived(mover);
  }

  const step = Math.min(distanceLeft, speed * terrainSpeedFactor(mover, world) * seconds);
  const desiredHeading = Math.atan2(waypoint.x - mover.x, waypoint.z - mover.z);

  if (!tryStep(mover, desiredHeading, step, seconds, world)) {
    stopMoving(mover);
    mover.stuckSeconds += seconds;
  }

  if (mover.stuckSeconds <= GIVE_UP_SECONDS) {
    return false;
  }

  return replan(mover, navigation);
}

function terrainSpeedFactor(mover: Mover, world: WorldState): number {
  const cell = world.grid.cellAt(mover.x, mover.z);

  if (cell < 0) {
    return 1;
  }

  if (world.isWater(cell)) {
    return SWIMMING_SPEED;
  }

  return groundDefinition(world.terrain.ground[cell]).walkSpeed;
}

interface StepAttempt {
  isEscapingWater: boolean;
  seconds: number;
  step: number;
}

function tryStep(mover: Mover, desiredHeading: number, step: number, seconds: number, world: WorldState): boolean {
  if (stepTowards(mover, desiredHeading, { isEscapingWater: false, seconds, step }, world)) {
    return true;
  }

  if (waterDepthIn(world.grid.cellAt(mover.x, mover.z), world) === 0) {
    return false;
  }

  const shoreHeading = headingToShore(mover, desiredHeading, world);

  return stepTowards(mover, shoreHeading, { isEscapingWater: true, seconds, step }, world);
}

function headingToShore(mover: Mover, desiredHeading: number, world: WorldState): number {
  const shore = nearestWalkableSpot(world, { x: mover.x, z: mover.z }, SHORE_SEARCH_RADIUS);

  if (shore.x === mover.x && shore.z === mover.z) {
    return desiredHeading;
  }

  return Math.atan2(shore.x - mover.x, shore.z - mover.z);
}

function stepTowards(mover: Mover, desiredHeading: number, attempt: StepAttempt, world: WorldState): boolean {
  const { seconds, step } = attempt;

  const probe = Math.max(step, PROBE_DISTANCE);

  for (const deflection of DEFLECTIONS) {
    const heading = desiredHeading + deflection;

    const directionX = Math.sin(heading);
    const directionZ = Math.cos(heading);

    const probeX = mover.x + directionX * probe;
    const probeZ = mover.z + directionZ * probe;

    if (!canEnter(mover, probeX, probeZ, attempt.isEscapingWater, world)) {
      continue;
    }

    const rise = world.heightAt(probeX, probeZ) - world.heightAt(mover.x, mover.z);

    const distance = step * uphillSlowdown(rise, probe);

    mover.velocityX = (directionX * distance) / seconds;
    mover.velocityZ = (directionZ * distance) / seconds;
    mover.x += directionX * distance;
    mover.z += directionZ * distance;
    mover.heading += wrapAngle(heading - mover.heading) * Math.min(1, seconds * TURN_RATE);

    if (deflection !== 0) {
      mover.stuckSeconds += seconds * DEFLECTION_FRUSTRATION;
    }

    return true;
  }

  return false;
}

function uphillSlowdown(rise: number, run: number): number {
  if (rise <= 0) {
    return 1;
  }

  return 1 / (1 + (rise / run) * UPHILL_DRAG);
}

function canEnter(mover: Mover, x: number, z: number, isEscapingWater: boolean, world: WorldState): boolean {
  const target = world.grid.cellAt(x, z);

  if (target < 0 || world.slope(target) > CLIMBABLE_SLOPE) {
    return false;
  }

  if (!world.isWater(target)) {
    return true;
  }

  const depth = world.waterDepth(target);

  if (mover.canWade && depth < WADING_DEPTH) {
    return true;
  }

  const here = world.grid.cellAt(mover.x, mover.z);

  if (here === target) {
    return isEscapingWater;
  }

  return depth < waterDepthIn(here, world);
}

function waterDepthIn(cell: number, world: WorldState): number {
  if (cell < 0 || !world.isWater(cell)) {
    return 0;
  }

  return world.waterDepth(cell);
}

function forgetReplans(mover: Mover): void {
  mover.closestReplanDistance = Number.POSITIVE_INFINITY;
  mover.futileReplans = 0;
}

function replan(mover: Mover, navigation: NavigationGrid): boolean {
  mover.stuckSeconds = 0;

  const distanceToGoal = Math.hypot(mover.goalX - mover.x, mover.goalZ - mover.z);

  if (distanceToGoal < mover.closestReplanDistance - REPLAN_PROGRESS) {
    mover.closestReplanDistance = distanceToGoal;
    mover.futileReplans = 0;
  } else {
    mover.futileReplans += 1;
  }

  if (mover.futileReplans >= MAXIMUM_FUTILE_REPLANS) {
    return giveUp(mover);
  }

  const route = navigation.findPath(mover, { x: mover.goalX, z: mover.goalZ });

  if (route === null) {
    return giveUp(mover);
  }

  mover.path = route;
  mover.pathIndex = 0;

  return false;
}

function giveUp(mover: Mover): boolean {
  mover.pathIndex = mover.path.length;
  stopMoving(mover);

  return true;
}

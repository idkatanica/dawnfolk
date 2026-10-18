import { plantSpeciesDefinition } from "../../../content/plants.ts";
import type { PersonPose } from "../../../world/agent-poses.ts";
import type { VegetationStore } from "../../../world/vegetation-store.ts";
import { faceTowards, moveAlong, setDestination, stopMoving } from "../../agents/movement.ts";
import type { Waypoint } from "../../agents/navigation.ts";
import { nearestWalkableSpot } from "../../agents/walkable-ground.ts";
import { isCarryingAnything, type Person, walkSpeed } from "../person.ts";
import type { PersonTick, SocietyContext } from "../society-context.ts";

const RUNNING_SPEED = 3.4;
const DRY_DESTINATION_RADIUS = 40;
const WORK_ARRIVAL_DISTANCE = 0.3;
const SHORTEST_APPROACH = 0.01;

export type JobKind =
  | "build"
  | "chop"
  | "deliver"
  | "eat"
  | "farm"
  | "fish"
  | "flee"
  | "gather"
  | "hunt"
  | "idle"
  | "migrate"
  | "play"
  | "pray"
  | "quarry"
  | "sleep"
  | "tend"
  | "warm";

export const JOB_LABELS: Readonly<Record<JobKind, string>> = {
  build: "Building",
  chop: "Chopping wood",
  deliver: "Carrying goods to camp",
  eat: "Eating",
  farm: "Working the field",
  fish: "Fishing",
  flee: "Running from danger",
  gather: "Gathering berries",
  hunt: "Hunting",
  idle: "Resting",
  migrate: "Moving to a new camp",
  play: "Playing",
  pray: "Praying at the totem",
  quarry: "Breaking stone",
  sleep: "Sleeping",
  tend: "Feeding the campfire",
  warm: "Warming up by the fire",
};

export interface Job {
  readonly claimedPlant?: number;
  readonly kind: JobKind;
  update: (tick: PersonTick) => Job | null;
}

function travelPose(person: Person, speed: number): PersonPose {
  if (speed > RUNNING_SPEED) {
    return "run";
  }

  if (isCarryingAnything(person)) {
    return "carry";
  }

  return "walk";
}

export interface WorkTarget {
  readonly radius: number;
  readonly reach: number;
  readonly x: number;
  readonly z: number;
}

export function plantTarget(vegetation: VegetationStore, plant: number, reach: number): WorkTarget {
  const { radiusPerMeter } = plantSpeciesDefinition(vegetation.species[plant]);

  return { radius: radiusPerMeter * vegetation.height[plant], reach, x: vegetation.x[plant], z: vegetation.z[plant] };
}

function approachDirection(person: Person, target: WorkTarget): Waypoint {
  const awayX = person.mover.x - target.x;
  const awayZ = person.mover.z - target.z;

  const distance = Math.hypot(awayX, awayZ);

  if (distance < SHORTEST_APPROACH) {
    return { x: 1, z: 0 };
  }

  return { x: awayX / distance, z: awayZ / distance };
}

export function headToWork(person: Person, target: WorkTarget, context: SocietyContext): void {
  const direction = approachDirection(person, target);
  const standOff = target.radius + target.reach;

  const spot = { x: target.x + direction.x * standOff, z: target.z + direction.z * standOff };

  const drySpot = nearestWalkableSpot(context.world, spot, DRY_DESTINATION_RADIUS);

  setDestination(person.mover, drySpot, context.navigation, { arrivalDistance: WORK_ARRIVAL_DISTANCE });
}

export function headTo(person: Person, destination: Waypoint, context: SocietyContext): void {
  const dryDestination = nearestWalkableSpot(context.world, destination, DRY_DESTINATION_RADIUS);

  setDestination(person.mover, dryDestination, context.navigation);
}

export function walk(tick: PersonTick, speed: number): boolean {
  const { context, person } = tick;

  person.speed = speed;
  person.pose = travelPose(person, speed);

  const isThere = moveAlong(person.mover, tick.seconds, speed, context.world, context.navigation);

  if (isThere) {
    person.speed = 0;
  }

  return isThere;
}

export function standStill(person: Person, pose: PersonPose): void {
  person.pose = pose;
  person.speed = 0;
  stopMoving(person.mover);
}

type ErrandProgress = "finished" | "travelling" | "working";

type ErrandPhase = "travel" | "work";

export class Errand {
  readonly #focus: Waypoint | null;
  readonly #workPose: PersonPose;
  readonly #workSeconds: number;
  #elapsedWork = 0;
  #phase: ErrandPhase = "travel";

  constructor(workSeconds: number, workPose: PersonPose, focus: Waypoint | null = null) {
    this.#focus = focus;
    this.#workSeconds = workSeconds;
    this.#workPose = workPose;
  }

  update(tick: PersonTick): ErrandProgress {
    if (!this.#isAtWorkplace(tick)) {
      return "travelling";
    }

    standStill(tick.person, this.#workPose);
    this.#faceFocus(tick);
    this.#elapsedWork += tick.seconds;

    if (this.#elapsedWork < this.#workSeconds) {
      return "working";
    }

    return "finished";
  }

  restartWork(): void {
    this.#elapsedWork = 0;
  }

  #faceFocus(tick: PersonTick): void {
    const focus = this.#focus;

    if (focus === null) {
      return;
    }

    faceTowards(tick.person.mover, focus.x, focus.z);
  }

  #isAtWorkplace(tick: PersonTick): boolean {
    if (this.#phase === "work") {
      return true;
    }

    if (!walk(tick, walkSpeed(tick.person))) {
      return false;
    }

    this.#phase = "work";

    return true;
  }
}

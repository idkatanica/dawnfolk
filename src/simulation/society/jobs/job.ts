import type { PersonPose } from "../../../world/agent-poses.ts";
import { moveAlong, setDestination, stopMoving } from "../../agents/movement.ts";
import type { Waypoint } from "../../agents/navigation.ts";
import { nearestWalkableSpot } from "../../agents/walkable-ground.ts";
import { isCarryingAnything, type Person, walkSpeed } from "../person.ts";
import type { PersonTick, SocietyContext } from "../society-context.ts";

const RUNNING_SPEED = 3.4;
const DRY_DESTINATION_RADIUS = 40;

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

export function aroundPoint(center: Waypoint, distance: number, angle: number): Waypoint {
  return { x: center.x + Math.cos(angle) * distance, z: center.z + Math.sin(angle) * distance };
}

export type ErrandProgress = "finished" | "travelling" | "working";

type ErrandPhase = "travel" | "work";

export class Errand {
  readonly #workPose: PersonPose;
  readonly #workSeconds: number;
  #elapsedWork = 0;
  #phase: ErrandPhase = "travel";

  constructor(workSeconds: number, workPose: PersonPose) {
    this.#workSeconds = workSeconds;
    this.#workPose = workPose;
  }

  update(tick: PersonTick): ErrandProgress {
    if (!this.#isAtWorkplace(tick)) {
      return "travelling";
    }

    standStill(tick.person, this.#workPose);
    this.#elapsedWork += tick.seconds;

    if (this.#elapsedWork < this.#workSeconds) {
      return "working";
    }

    return "finished";
  }

  restartWork(): void {
    this.#elapsedWork = 0;
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

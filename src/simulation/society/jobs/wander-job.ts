import { FULL_TURN } from "../../../shared/math.ts";
import { aroundPoint } from "../../agents/navigation.ts";
import { type Person, runSpeed, walkSpeed } from "../person.ts";
import type { PersonTick } from "../society-context.ts";
import { campPoint } from "../tribe-places.ts";
import { headTo, type Job, standStill, walk } from "./job.ts";

type WanderKind = "idle" | "play";

type WanderPhase = "linger" | "travel";

const WANDER_RANGES: Readonly<Record<WanderKind, readonly [number, number]>> = {
  idle: [6, 24],
  play: [6, 32],
};

export class WanderJob implements Job {
  readonly kind: WanderKind;
  #lingerSeconds: number;
  #phase: WanderPhase = "travel";

  constructor(tick: PersonTick, kind: WanderKind) {
    const { random } = tick.context;
    const [nearest, farthest] = WANDER_RANGES[kind];

    const destination = aroundPoint(
      campPoint(tick.tribe),
      random.between(nearest, farthest),
      random.next() * FULL_TURN
    );

    this.kind = kind;
    this.#lingerSeconds = random.between(5, 13);
    headTo(tick.person, destination, tick.context);
  }

  update(tick: PersonTick): Job | null {
    if (this.#phase === "travel") {
      this.#travel(tick);

      return this;
    }

    standStill(tick.person, this.kind);
    this.#lingerSeconds -= tick.seconds;

    if (this.#lingerSeconds > 0) {
      return this;
    }

    return null;
  }

  #travel(tick: PersonTick): void {
    if (walk(tick, wanderSpeed(this.kind, tick.person))) {
      this.#phase = "linger";
    }
  }
}

function wanderSpeed(kind: WanderKind, person: Person): number {
  if (kind === "play") {
    return runSpeed(person) * 0.7;
  }

  return walkSpeed(person) * 0.7;
}

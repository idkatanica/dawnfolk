import { fractionalPart, wrapAngle } from "../../shared/math.ts";

export interface MotionStep {
  readonly clip: number;
  readonly gameSeconds: number;
  readonly heading: number;
  readonly rate: number;
  readonly realSeconds: number;
}

export const BLEND_SECONDS = 0.3;
export const TURN_RATE = 6;

export class AgentMotion {
  blend = 1;
  clip: number;
  heading: number;
  phase: number;
  previousClip: number;
  previousPhase: number;
  #previousRate = 0;
  #rate = 0;

  constructor(clip: number, phase: number, heading: number) {
    this.clip = clip;
    this.previousClip = clip;
    this.phase = fractionalPart(phase);
    this.previousPhase = this.phase;
    this.heading = heading;
  }

  advance(step: MotionStep): void {
    if (step.clip !== this.clip) {
      this.#switchClip(step.clip);
    }

    this.#rate = step.rate;
    this.phase = fractionalPart(this.phase + step.gameSeconds * step.rate);
    this.previousPhase = fractionalPart(this.previousPhase + step.gameSeconds * this.#previousRate);
    this.blend = Math.min(1, this.blend + step.realSeconds / BLEND_SECONDS);
    this.#turnToward(step.heading, step.realSeconds);
  }

  #switchClip(clip: number): void {
    this.previousClip = this.clip;
    this.previousPhase = this.phase;
    this.#previousRate = this.#rate;
    this.clip = clip;
    this.blend = 0;
  }

  #turnToward(heading: number, realSeconds: number): void {
    const difference = wrapAngle(heading - this.heading);
    const largestTurn = TURN_RATE * realSeconds;

    if (Math.abs(difference) <= largestTurn) {
      this.heading = heading;

      return;
    }

    this.heading = wrapAngle(this.heading + Math.sign(difference) * largestTurn);
  }
}

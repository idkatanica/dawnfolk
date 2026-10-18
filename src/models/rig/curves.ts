import { FULL_TURN, fractionalPart } from "../../shared/math.ts";

export type Keyframe = readonly [time: number, value: number];

export function degrees(value: number): number {
  return (value * Math.PI) / 180;
}

export function wave(phase: number, offset = 0): number {
  return Math.sin(FULL_TURN * (phase + offset));
}

export function cosineWave(phase: number, offset = 0): number {
  return Math.cos(FULL_TURN * (phase + offset));
}

export function cyclicDistance(phase: number, center: number): number {
  const difference = fractionalPart(phase - center);

  return Math.min(difference, 1 - difference);
}

export function pulse(phase: number, center: number, width: number): number {
  const distance = cyclicDistance(phase, center) / width;

  return Math.exp(-distance * distance);
}

export function arc(phase: number, start: number, duration: number): number {
  const progress = (fractionalPart(phase) - start) / duration;

  if (progress <= 0 || progress >= 1) {
    return 0;
  }

  return Math.sin(Math.PI * progress);
}

function smoothBlend(amount: number): number {
  return amount * amount * (3 - 2 * amount);
}

export function keyframes(phase: number, keys: readonly Keyframe[]): number {
  const lastKey = keys.at(-1);

  if (lastKey === undefined) {
    throw new RangeError("A keyframe track needs at least one key");
  }

  const time = fractionalPart(phase);

  const nextIndex = keys.findIndex(([keyTime]) => keyTime > time);

  if (nextIndex > 0) {
    const [previousTime, previousValue] = keys[nextIndex - 1];
    const [nextTime, nextValue] = keys[nextIndex];

    return previousValue + (nextValue - previousValue) * smoothBlend((time - previousTime) / (nextTime - previousTime));
  }

  const [firstTime, firstValue] = keys[0];

  const span = 1 - lastKey[0] + firstTime;
  const elapsed = nextIndex === 0 ? time + 1 - lastKey[0] : time - lastKey[0];

  return lastKey[1] + (firstValue - lastKey[1]) * smoothBlend(elapsed / span);
}

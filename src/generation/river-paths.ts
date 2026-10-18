import type { RiverPoint } from "../world/water.ts";

export function smoothRiverPath(points: readonly RiverPoint[], iterations: number): RiverPoint[] {
  let current = [...points];

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    current = chaikinPass(current);
  }

  return current;
}

function chaikinPass(points: readonly RiverPoint[]): RiverPoint[] {
  const first = points.at(0);
  const last = points.at(-1);

  if (points.length < 3 || first === undefined || last === undefined) {
    return [...points];
  }

  const smoothed: RiverPoint[] = [first];

  for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
    const start = points[pointIndex - 1];
    const end = points[pointIndex];

    smoothed.push(interpolatePoint(start, end, 0.25), interpolatePoint(start, end, 0.75));
  }

  smoothed.push(last);

  return smoothed;
}

export function interpolatePoint(start: RiverPoint, end: RiverPoint, amount: number): RiverPoint {
  return {
    depth: start.depth + (end.depth - start.depth) * amount,
    flow: start.flow + (end.flow - start.flow) * amount,
    surface: start.surface + (end.surface - start.surface) * amount,
    width: start.width + (end.width - start.width) * amount,
    x: start.x + (end.x - start.x) * amount,
    z: start.z + (end.z - start.z) * amount,
  };
}

export function makeSurfaceDescend(points: RiverPoint[], minimumDrop: number): void {
  for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
    const previous = points[pointIndex - 1];
    const current = points[pointIndex];

    current.surface = Math.min(current.surface, previous.surface - minimumDrop);
  }
}

export function riverLength(points: readonly RiverPoint[]): number {
  let length = 0;

  for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
    const previous = points[pointIndex - 1];
    const current = points[pointIndex];

    length += Math.hypot(current.x - previous.x, current.z - previous.z);
  }

  return length;
}

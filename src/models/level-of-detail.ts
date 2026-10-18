export interface DetailSteps {
  readonly pathStep: number;
  readonly segmentFloor: number;
}

export function segmentsAtLeast(detail: DetailSteps, least: number, segments: number): number {
  return Math.max(Math.min(least, detail.segmentFloor), segments);
}

export function alongPath<Point>(points: readonly Point[], detail: DetailSteps): Point[] {
  const last = points.length - 1;

  return points.filter((_, index) => index === 0 || index === last || index % detail.pathStep === 0);
}

export function segmentsUpTo(detail: DetailSteps, segments: number): number {
  return Math.min(segments, detail.segmentFloor);
}

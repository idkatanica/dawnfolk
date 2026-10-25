export interface DetailSteps {
  readonly hasSmallParts: boolean;
}

export function segmentsAtLeast(detail: DetailSteps, least: number, segments: number): number {
  return Math.max(Math.min(least, detail.hasSmallParts ? 8 : 4), segments);
}

export function alongPath<Point>(points: readonly Point[], detail: DetailSteps): Point[] {
  const last = points.length - 1;

  return points.filter((_, index) => index === 0 || index === last || detail.hasSmallParts || index % 2 === 0);
}

export function segmentsUpTo(detail: DetailSteps, segments: number): number {
  return Math.min(segments, detail.hasSmallParts ? 8 : 4);
}

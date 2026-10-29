import { curveBodySections, curveSections, curveTube } from "./mesh/path-curves.ts";
import type { BodySection, LoftSection, TubePoint } from "./mesh/shapes.ts";

export interface DetailSteps {
  readonly curveSteps: number;
  readonly hasSmallParts: boolean;
}

export function segmentsAtLeast(detail: DetailSteps, least: number, segments: number): number {
  return Math.max(Math.min(least, detail.hasSmallParts ? 8 : 4), segments);
}

export function segmentsUpTo(detail: DetailSteps, segments: number): number {
  return Math.min(segments, detail.hasSmallParts ? 8 : 4);
}

export function thinned<Point>(points: readonly Point[]): Point[] {
  return points.filter((_point, index) => {
    return index % 2 === 0 || index === points.length - 1;
  });
}

export function alongPath<Point>(points: readonly Point[], detail: DetailSteps): Point[] {
  return detail.hasSmallParts ? [...points] : thinned(points);
}

export function alongTube(points: readonly TubePoint[], detail: DetailSteps): TubePoint[] {
  return curveTube(alongPath(points, detail), detail.curveSteps);
}

export function alongSections(sections: readonly LoftSection[], detail: DetailSteps): LoftSection[] {
  return curveSections(alongPath(sections, detail), detail.curveSteps);
}

export function alongBody(sections: readonly BodySection[], detail: DetailSteps): BodySection[] {
  return curveBodySections(alongPath(sections, detail), detail.curveSteps);
}

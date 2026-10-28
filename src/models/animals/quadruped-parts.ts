import { Vector3 } from "three";
import { alongPath, type DetailSteps } from "../level-of-detail.ts";
import { MaterialSlot } from "../materials.ts";
import type { MeshBuilder, SurfacePoint, VertexStyle } from "../mesh/mesh-builder.ts";
import type { Shape } from "../mesh/shape.ts";
import { sphere, type TubePoint, tube } from "../mesh/shapes.ts";
import { outermostHit, surfaceTransform } from "../mesh/surface-probe.ts";
import { combine, sideMirror, type Triple } from "../mesh/transforms.ts";
import { rigidStyle } from "../rig/skin-weights.ts";
import { legStyle } from "./quadruped-rigging.ts";
import { LEG_ENDS, LEG_SIDES, type LegEnd, QuadrupedBone, type QuadrupedFrame } from "./quadruped-skeleton.ts";

type LegPoint = readonly [radius: number, y: number, z: number, inset?: number];

interface LegOptions {
  readonly blend: number;
  readonly detail: DetailSteps;
  readonly frame: QuadrupedFrame;
  readonly paths: Readonly<Record<LegEnd, readonly TubePoint[]>>;
  readonly seam: number;
  readonly segments: number;
  readonly slot: number | ((point: SurfacePoint) => number);
}

interface EyeOptions {
  readonly direction: Triple;
  readonly origin: Triple;
  readonly radius: number;
  readonly sink: number;
}

export function legPath(x: number, points: readonly LegPoint[]): TubePoint[] {
  return points.map(([radius, y, z, inset = 0]) => ({ radius, x: x - inset, y, z }));
}

export function addLegs(builder: MeshBuilder, options: LegOptions): void {
  const { blend, detail, frame, paths, seam, segments, slot } = options;

  const legs: Readonly<Record<LegEnd, Shape>> = {
    front: tube(alongPath(paths.front, detail), { radialSegments: segments }),
    hind: tube(alongPath(paths.hind, detail), { radialSegments: segments }),
  };

  for (const side of LEG_SIDES) {
    for (const end of LEG_ENDS) {
      const style: VertexStyle = { ...legStyle(frame, end, side, blend), slot };

      builder.add(legs[end], {
        seam,
        style,
        transform: sideMirror(side),
      });
    }
  }
}

export function hoofBelow(height: number): (point: SurfacePoint) => number {
  return (point) => (point.position.y < height ? MaterialSlot.Hoof : MaterialSlot.Coat);
}

export function addEyes(builder: MeshBuilder, head: Shape, options: EyeOptions): void {
  const { direction, origin, radius, sink } = options;

  const hit = outermostHit(head, new Vector3(...origin), new Vector3(...direction));

  if (hit === null) {
    return;
  }

  const eye = sphere(radius, 6, 4);
  const style = { ...rigidStyle(QuadrupedBone.Head), slot: MaterialSlot.Eye };

  for (const side of LEG_SIDES) {
    builder.add(eye, {
      style,
      transform: combine(sideMirror(side), surfaceTransform(hit, radius * sink)),
    });
  }
}

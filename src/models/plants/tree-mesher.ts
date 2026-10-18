import { Vector3 } from "three";
import { clamp, fractionalPart, lerp, smoothstep } from "../../shared/math.ts";
import { createVolumeNoise } from "../../shared/noise.ts";
import { createRandom } from "../../shared/random.ts";
import { MaterialSlot, type MaterialSlotIndex } from "../materials.ts";
import { MeshBuilder, type SurfacePoint, type VertexStyle } from "../mesh/mesh-builder.ts";
import type { MeshData } from "../mesh/mesh-data.ts";
import { deformShape, type Shape } from "../mesh/shape.ts";
import { blob, cone, icosphere, type LoftSection, loft, ribbon, type TubePoint, tube } from "../mesh/shapes.ts";
import { transformOf } from "../mesh/transforms.ts";
import {
  type Foliage,
  type FoliageBlob,
  type FoliageFrond,
  type FoliageSkirt,
  type FoliageStrand,
  type TreeStructure,
  toVector,
} from "./tree-structure.ts";

export type PlantDetailLevel = "high" | "low" | "medium";

export interface TreeLook {
  readonly bark: MaterialSlotIndex;
  readonly foliage: MaterialSlotIndex;
  readonly hasBarkMarks: boolean;
}

const MESH_NOISE = createVolumeNoise(createRandom(5150));

const BLOB_LIMITS: Readonly<Record<PlantDetailLevel, number>> = { high: 9, low: 1, medium: 4 };

const STRAND_ROOT_DEPTH = 0.85;

const GROUNDED_CROWN_LIFT = 0.8;

const SWAY_GROWTH = 1.4;

export const FOLIAGE_FLUTTER = 1;

const BRANCH_SIDES: Readonly<Record<PlantDetailLevel, readonly number[]>> = {
  high: [7, 5, 4],
  low: [4, 3, 3],
  medium: [5, 4, 3],
};

export function plantSway(height: number, plantHeight: number): number {
  return clamp(height / plantHeight, 0, 1) ** SWAY_GROWTH;
}

function woodStyle(height: number, look: TreeLook, depth: number): VertexStyle {
  return {
    shade: (point) => 0.68 + 0.32 * smoothstep(0, height * 0.25, point.position.y),
    slot: (point) => barkSlot(point, look, depth),
    sway: (point) => plantSway(point.position.y, height),
  };
}

function barkSlot(point: SurfacePoint, look: TreeLook, depth: number): number {
  if (!look.hasBarkMarks || depth > 0) {
    return look.bark;
  }

  const { x, y, z } = point.position;

  const mark = fractionalPart(y * 1.4 + MESH_NOISE.sample(x * 3, y * 0.7, z * 3) * 0.6);

  return mark < 0.14 ? MaterialSlot.Bark : look.bark;
}

function crownCenter(structure: TreeStructure): Vector3 {
  const centers = structure.foliage.map(foliageCenter);

  const sum = centers.reduce((total, center) => total.add(center), new Vector3());

  return sum.multiplyScalar(1 / Math.max(1, centers.length));
}

function foliageCenter(foliage: Foliage): Vector3 {
  if (foliage.kind === "strand" || foliage.kind === "frond") {
    const [first] = foliage.points;

    return toVector(first);
  }

  return new Vector3(...foliage.center);
}

function foliageStyle(structure: TreeStructure, look: TreeLook, tint: number, center: Vector3): VertexStyle {
  const outward = new Vector3();

  return {
    flutter: FOLIAGE_FLUTTER,
    shade: (point) => {
      outward.copy(point.position).sub(center).normalize();

      const facing = outward.dot(point.normal) * 0.5 + 0.5;
      const lift = smoothstep(0, structure.height, point.position.y) * 0.15;

      return clamp(0.5 + 0.38 * facing + lift + tint, 0.3, 1.15);
    },
    slot: look.foliage,
    sway: (point) => plantSway(point.position.y, structure.height),
  };
}

function addBranches(builder: MeshBuilder, structure: TreeStructure, look: TreeLook, level: PlantDetailLevel): void {
  const maximumDepth = { high: 2, low: 0, medium: 1 }[level];

  for (const branch of structure.branches) {
    if (branch.depth > maximumDepth) {
      continue;
    }

    const points = level === "high" ? branch.points : thinned(branch.points);
    const sides = BRANCH_SIDES[level][Math.min(2, branch.depth)];

    builder.add(tube(points, { hasStartCap: branch.depth > 0, radialSegments: sides }), {
      style: woodStyle(structure.height, look, branch.depth),
    });
  }
}

function thinned(points: readonly TubePoint[]): TubePoint[] {
  const kept = points.filter((_point, index) => index % 2 === 0);
  const last = points.at(-1);

  if (last === undefined || kept.at(-1) === last) {
    return kept;
  }

  return [...kept, last];
}

function skirtShape(skirt: FoliageSkirt, segments: number, teeth: number): Shape {
  const { bottom, droop, radius, top } = skirt;

  const sections: LoftSection[] = [
    { radiusX: 0, radiusZ: 0, y: bottom + droop * 0.8 },
    { radiusX: radius * 0.55, radiusZ: radius * 0.55, y: bottom + droop * 0.55 },
    { radiusX: radius, radiusZ: radius, y: bottom },
    { radiusX: radius * 0.62, radiusZ: radius * 0.62, y: bottom + (top - bottom) * 0.38 },
    { radiusX: radius * 0.16, radiusZ: radius * 0.16, y: top - (top - bottom) * 0.08 },
    { radiusX: 0, radiusZ: 0, y: top },
  ];

  return deformShape(loft(sections, segments), (vertex) => {
    if (vertex.y > bottom + 0.01) {
      return [0, 0, 0];
    }

    const tooth = Math.abs(fractionalPart(vertex.around * teeth) * 2 - 1);

    return [vertex.x * 0.12 * tooth, -droop * (1 - tooth), vertex.z * 0.12 * tooth];
  });
}

function addSkirt(
  builder: MeshBuilder,
  structure: TreeStructure,
  look: TreeLook,
  skirt: FoliageSkirt,
  level: PlantDetailLevel
): void {
  const segments = { high: 14, low: 7, medium: 9 }[level];
  const teeth = { high: 11, low: 6, medium: 8 }[level];
  const center = new Vector3(skirt.center[0], (skirt.bottom + skirt.top) / 2, skirt.center[2]);

  builder.add(skirtShape(skirt, segments, teeth), {
    style: foliageStyle(structure, look, skirt.tint, center),
    transform: transformOf({ position: [skirt.center[0], 0, skirt.center[2]] }),
  });
}

function addBlob(
  builder: MeshBuilder,
  structure: TreeStructure,
  look: TreeLook,
  foliage: FoliageBlob,
  detail: number
): void {
  const [x, y, z] = foliage.center;
  const center = crownCenter(structure);

  const shape =
    detail > 0
      ? blob({
          detail,
          noise: MESH_NOISE,
          offset: [x * 0.37, y * 0.29, z * 0.41],
          radius: foliage.radius,
          roughness: 0.3,
        })
      : icosphere(foliage.radius, 0);

  builder.add(shape, {
    style: foliageStyle(structure, look, foliage.tint, center),
    transform: transformOf({ position: foliage.center, scale: [1, foliage.squash, 1] }),
  });
}

function addStrand(
  builder: MeshBuilder,
  structure: TreeStructure,
  look: TreeLook,
  strand: FoliageStrand,
  sides: number
): void {
  const [root] = strand.points;

  const rootSway = plantSway(root.y, structure.height);

  builder.add(tube(strand.points, { radialSegments: sides }), {
    style: {
      ...foliageStyle(structure, look, strand.tint, crownCenter(structure)),
      sway: (point) => lerp(rootSway, 1, point.along),
    },
  });
}

function addFrond(
  builder: MeshBuilder,
  structure: TreeStructure,
  look: TreeLook,
  frond: FoliageFrond,
  level: PlantDetailLevel
): void {
  const [root] = frond.points;

  const rootSway = plantSway(root.y, structure.height);
  const points = level === "high" ? frond.points : thinned(frond.points);

  builder.add(ribbon(points, { fold: 0.35 }), {
    style: {
      ...foliageStyle(structure, look, frond.tint, crownCenter(structure)),
      sway: (point) => lerp(rootSway, 1, point.along),
    },
  });
}

function relativeDistance(foliage: FoliageBlob, point: TubePoint): number {
  const [x, y, z] = foliage.center;

  return Math.hypot(
    (point.x - x) / foliage.radius,
    (point.y - y) / (foliage.radius * foliage.squash),
    (point.z - z) / foliage.radius
  );
}

function anchoredStrand(strand: FoliageStrand, blobs: readonly FoliageBlob[]): FoliageStrand {
  const [root] = strand.points;

  if (blobs.length === 0) {
    return strand;
  }

  const host = blobs.reduce((closest, foliage) =>
    relativeDistance(foliage, root) < relativeDistance(closest, root) ? foliage : closest
  );

  const distance = relativeDistance(host, root);

  if (distance <= STRAND_ROOT_DEPTH) {
    return strand;
  }

  const [x, y, z] = host.center;
  const pull = 1 - STRAND_ROOT_DEPTH / distance;

  const shift = new Vector3(x - root.x, y - root.y, z - root.z).multiplyScalar(pull);

  return {
    ...strand,
    points: strand.points.map((point) => ({
      ...point,
      x: point.x + shift.x,
      y: point.y + shift.y,
      z: point.z + shift.z,
    })),
  };
}

interface MergedBlob {
  readonly center: Vector3;
  readonly radius: number;
  readonly squash: number;
  readonly tint: number;
  readonly weight: number;
}

function mergeClosest(blobs: MergedBlob[]): MergedBlob[] {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestFirst = 0;
  let bestSecond = 1;

  for (let first = 0; first < blobs.length; first += 1) {
    for (let second = first + 1; second < blobs.length; second += 1) {
      const distance = blobs[first].center.distanceTo(blobs[second].center);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestFirst = first;
        bestSecond = second;
      }
    }
  }

  const first = blobs[bestFirst];
  const second = blobs[bestSecond];

  const weight = first.weight + second.weight;

  const center = first.center
    .clone()
    .multiplyScalar(first.weight / weight)
    .addScaledVector(second.center, second.weight / weight);

  const merged: MergedBlob = {
    center,
    radius: Math.max(first.radius, second.radius) + bestDistance * 0.35,
    squash: (first.squash + second.squash) / 2,
    tint: (first.tint + second.tint) / 2,
    weight,
  };

  return [...blobs.filter((_blob, index) => index !== bestFirst && index !== bestSecond), merged];
}

function mergedBlobs(blobs: readonly FoliageBlob[], target: number): FoliageBlob[] {
  let merged: MergedBlob[] = blobs.map((foliage) => ({
    center: new Vector3(...foliage.center),
    radius: foliage.radius,
    squash: foliage.squash,
    tint: foliage.tint,
    weight: foliage.radius ** 3,
  }));

  while (merged.length > target) {
    merged = mergeClosest(merged);
  }

  return merged.map((foliage) => ({
    center: foliage.center.toArray(),
    kind: "blob",
    radius: foliage.radius,
    squash: foliage.squash,
    tint: foliage.tint,
  }));
}

function crownEnvelope(structure: TreeStructure): FoliageBlob {
  const minimum = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const maximum = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

  for (const foliage of structure.foliage) {
    const reach = foliageReach(foliage);

    minimum.min(reach.minimum);
    maximum.max(reach.maximum);
  }

  const center = minimum.clone().add(maximum).multiplyScalar(0.5);
  const size = maximum.clone().sub(minimum).multiplyScalar(0.46);

  return {
    center: center.toArray(),
    kind: "blob",
    radius: Math.max(size.x, size.z),
    squash: size.y / Math.max(size.x, size.z, 0.001),
    tint: 0,
  };
}

interface Reach {
  readonly maximum: Vector3;
  readonly minimum: Vector3;
}

function foliageReach(foliage: Foliage): Reach {
  if (foliage.kind === "strand" || foliage.kind === "frond") {
    const points = foliage.points.map(toVector);

    return {
      maximum: points.reduce((maximum, point) => maximum.max(point), points[0].clone()),
      minimum: points.reduce((minimum, point) => minimum.min(point), points[0].clone()),
    };
  }

  if (foliage.kind === "skirt") {
    const [x, , z] = foliage.center;

    return {
      maximum: new Vector3(x + foliage.radius, foliage.top, z + foliage.radius),
      minimum: new Vector3(x - foliage.radius, foliage.bottom - foliage.droop, z - foliage.radius),
    };
  }

  const center = new Vector3(...foliage.center);
  const extent = new Vector3(foliage.radius, foliage.radius * foliage.squash, foliage.radius);

  return { maximum: center.clone().add(extent), minimum: center.clone().sub(extent) };
}

function addLowCrown(builder: MeshBuilder, structure: TreeStructure, look: TreeLook): void {
  const skirts = structure.foliage.filter((foliage) => foliage.kind === "skirt");

  if (skirts.length > 0) {
    const widest = skirts.reduce((best, skirt) => (skirt.radius > best.radius ? skirt : best));
    const top = skirts.reduce((highest, skirt) => Math.max(highest, skirt.top), 0);

    const bottom = widest.bottom - widest.droop * 0.5;

    builder.add(cone(widest.radius * 1.02, top - bottom, 7), {
      style: foliageStyle(structure, look, 0, new Vector3(0, (top + bottom) / 2, 0)),
      transform: transformOf({ position: [widest.center[0], bottom, widest.center[2]] }),
    });

    return;
  }

  if (structure.foliage.length === 0) {
    return;
  }

  const envelope = crownEnvelope(structure);

  if (stemRoot(structure) === null) {
    addBlob(builder, structure, look, groundedEnvelope(envelope), 0);

    return;
  }

  addCrownStem(builder, structure, look, envelope);
  addBlob(builder, structure, look, envelope, 0);
}

function groundedEnvelope(envelope: FoliageBlob): FoliageBlob {
  const [x, , z] = envelope.center;

  return { ...envelope, center: [x, envelope.radius * envelope.squash * GROUNDED_CROWN_LIFT, z] };
}

function stemRoot(structure: TreeStructure): TubePoint | null {
  const trunk = structure.branches.find((branch) => branch.depth === 0);

  const top = trunk?.points.at(-1);

  if (top !== undefined) {
    return top;
  }

  const bases = structure.branches.flatMap((branch) => branch.points.slice(0, 1));

  if (bases.length === 0) {
    return null;
  }

  const share = 1 / bases.length;

  return {
    radius: Math.hypot(...bases.map((base) => base.radius)),
    x: bases.reduce((sum, base) => sum + base.x * share, 0),
    y: Math.min(...bases.map((base) => base.y)),
    z: bases.reduce((sum, base) => sum + base.z * share, 0),
  };
}

function addCrownStem(builder: MeshBuilder, structure: TreeStructure, look: TreeLook, envelope: FoliageBlob): void {
  const root = stemRoot(structure);

  if (root === null) {
    return;
  }

  const [x, y, z] = envelope.center;

  builder.add(
    tube(
      [
        { ...root, radius: root.radius * 0.9 },
        { radius: root.radius * 0.5, x, y, z },
      ],
      { radialSegments: 3 }
    ),
    { style: woodStyle(structure.height, look, 1) }
  );
}

function addFoliage(builder: MeshBuilder, structure: TreeStructure, look: TreeLook, level: PlantDetailLevel): void {
  if (level === "low") {
    addLowCrown(builder, structure, look);

    return;
  }

  const blobs = structure.foliage.filter((foliage) => foliage.kind === "blob");

  const visibleBlobs = mergedBlobs(blobs, BLOB_LIMITS[level]);

  for (const foliage of visibleBlobs) {
    addBlob(builder, structure, look, foliage, level === "high" ? 1 : 0);
  }

  for (const foliage of structure.foliage) {
    if (foliage.kind === "skirt") {
      addSkirt(builder, structure, look, foliage, level);
    }

    if (foliage.kind === "strand") {
      addStrand(builder, structure, look, anchoredStrand(foliage, visibleBlobs), level === "high" ? 4 : 3);
    }

    if (foliage.kind === "frond") {
      addFrond(builder, structure, look, foliage, level);
    }
  }
}

export function meshTree(structure: TreeStructure, look: TreeLook, level: PlantDetailLevel): MeshData {
  const builder = new MeshBuilder();

  addBranches(builder, structure, look, level);
  addFoliage(builder, structure, look, level);

  return builder.build();
}

import type { MaterialSlotIndex } from "../materials.ts";
import type { MeshBuilder, VertexStyle } from "../mesh/mesh-builder.ts";
import { cylinder } from "../mesh/shapes.ts";
import { segmentLength, segmentTransform, type Triple } from "../mesh/transforms.ts";
import { rigidStyle } from "../rig/skin-weights.ts";
import { type HumanDetail, trimSegments } from "./human-detail.ts";
import { HumanBone } from "./human-skeleton.ts";

export const RIGHT_FIST: Triple = [-0.217, 0.832, 0.018];
export const LEFT_FIST: Triple = [0.217, 0.832, 0.018];
export const CRADLE: Triple = [0, 1.29, 0.28];

interface Rod {
  readonly end: Triple;
  readonly radius: number;
  readonly start: Triple;
}

function holdStyle(bone: number, slot: MaterialSlotIndex): VertexStyle {
  return { ...rigidStyle(bone), slot };
}

export function inRightHand(slot: MaterialSlotIndex): VertexStyle {
  return holdStyle(HumanBone.HandRight, slot);
}

export function inLeftHand(slot: MaterialSlotIndex): VertexStyle {
  return holdStyle(HumanBone.HandLeft, slot);
}

export function onChest(slot: MaterialSlotIndex): VertexStyle {
  return holdStyle(HumanBone.Chest, slot);
}

export function addRod(builder: MeshBuilder, detail: HumanDetail, rod: Rod, style: VertexStyle): void {
  const { end, radius, start } = rod;

  builder.add(
    cylinder({
      height: segmentLength(start, end),
      radialSegments: trimSegments(detail, 6),
      radiusBottom: radius,
      radiusTop: radius * 0.9,
    }),
    { style, transform: segmentTransform(start, end) }
  );
}

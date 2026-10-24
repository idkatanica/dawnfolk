import type { AnimalKind } from "../../content/animals.ts";
import { lerp, smoothstep } from "../../shared/math.ts";

export const MarkerShape = {
  Circle: 0,
  Diamond: 1,
  Triangle: 2,
} as const;

export type MarkerShapeCode = (typeof MarkerShape)[keyof typeof MarkerShape];

export const MarkerImportance = {
  Animal: 0,
  Person: 2,
  Predator: 1,
  Selected: 3,
} as const;

type MarkerImportanceLevel = (typeof MarkerImportance)[keyof typeof MarkerImportance];

export interface MarkerStyle {
  readonly color: number;
  readonly extent: number;
  readonly importance: MarkerImportanceLevel;
  readonly shape: MarkerShapeCode;
}

export const MARKER_HALO_PIXELS = 3;
export const MARKER_RING_PIXELS = 1.5;
export const MARKER_SELECTION_PIXELS = 2;
export const SELECTED_MARKER_SCALE = 1.4;

const PERSON_EXTENT = 12;
const APPEARING_SHARE = 0.35;
const PRESENT_SHARE = 0.75;
const SMALLEST_SCALE = 0.55;
const SCALE_PER_HERD_MEMBER = 0.06;
const LARGEST_HERD_SCALE = 1.35;
const SCATTERED_HERD_EXTENTS = 2.5;

export const ANIMAL_MARKERS: Readonly<Record<AnimalKind, MarkerStyle>> = {
  deer: { color: 0xd9_a5_5c, extent: 13, importance: MarkerImportance.Animal, shape: MarkerShape.Diamond },
  hare: { color: 0xcf_c6_b2, extent: 10, importance: MarkerImportance.Animal, shape: MarkerShape.Diamond },
  ibex: { color: 0x7a_90_c4, extent: 13, importance: MarkerImportance.Animal, shape: MarkerShape.Diamond },
  mammoth: { color: 0x8f_5f_42, extent: 15, importance: MarkerImportance.Animal, shape: MarkerShape.Diamond },
  wolf: { color: 0xe2_44_3a, extent: 17, importance: MarkerImportance.Predator, shape: MarkerShape.Triangle },
};

export function personMarker(tribeColor: number): MarkerStyle {
  return { color: tribeColor, extent: PERSON_EXTENT, importance: MarkerImportance.Person, shape: MarkerShape.Circle };
}

export function markerPresence(distance: number, handover: number): number {
  return smoothstep(handover * APPEARING_SHARE, handover * PRESENT_SHARE, distance);
}

export function markerExtent(style: MarkerStyle, presence: number, isSelected: boolean): number {
  const emphasis = isSelected ? SELECTED_MARKER_SCALE : 1;

  return style.extent * emphasis * lerp(SMALLEST_SCALE, 1, presence);
}

export function herdGathering(acrossPixels: number, extent: number): number {
  return 1 - smoothstep(extent, extent * SCATTERED_HERD_EXTENTS, acrossPixels);
}

export function herdScale(memberCount: number): number {
  return Math.min(LARGEST_HERD_SCALE, 1 + SCALE_PER_HERD_MEMBER * Math.max(0, memberCount - 1));
}

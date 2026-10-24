import type { MaterialSlotIndex } from "../../models/materials.ts";
import { PALETTE_FLOATS_PER_BONE } from "../../models/rig/skeleton-poser.ts";

export const TEXELS_PER_BONE = PALETTE_FLOATS_PER_BONE / 4;

export interface PaletteLayout {
  readonly boneCount: number;
  readonly colorSlots: readonly MaterialSlotIndex[];
}

export function rootTexel(layout: PaletteLayout): number {
  return layout.boneCount * TEXELS_PER_BONE;
}

export function colorTexel(layout: PaletteLayout, colorIndex: number): number {
  return rootTexel(layout) + 1 + colorIndex;
}

export function colorIndexBySlot(layout: PaletteLayout, slotCount: number): number[] {
  const indices = new Array<number>(slotCount).fill(-1);

  for (const [index, colorSlot] of layout.colorSlots.entries()) {
    indices[colorSlot] = index;
  }

  return indices;
}

export function paletteWidth(layout: PaletteLayout): number {
  return colorTexel(layout, layout.colorSlots.length);
}

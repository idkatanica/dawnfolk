import { Vector3 } from "three";
import { createRandom } from "../../shared/random.ts";
import { MaterialSlot, type MaterialSlotIndex } from "../materials.ts";
import { MeshBuilder } from "../mesh/mesh-builder.ts";
import type { MeshData } from "../mesh/mesh-data.ts";
import { card, cylinder } from "../mesh/shapes.ts";
import { outermostHit } from "../mesh/surface-probe.ts";
import { type Triple, transformOf } from "../mesh/transforms.ts";
import {
  addBlock,
  addLog,
  addMound,
  addRock,
  detail,
  isDetailed,
  moundShape,
  rising,
  type StructureContext,
  type StructureLevel,
  scaledMesh,
} from "./structure-parts.ts";

export type MineOre = "copper" | "iron" | "tin";

export const MINE_SCALE = 1.5;

const ORE_SLOTS: Readonly<Record<MineOre, MaterialSlotIndex>> = {
  copper: MaterialSlot.CopperOre,
  iron: MaterialSlot.IronOre,
  tin: MaterialSlot.TinOre,
};

const MOUND_CENTER = -1.3;
const MOUND_RADIUS = 2;
const PORTAL_HALF_WIDTH = 0.72;
const PORTAL_HEIGHT = 2.15;
const PORTAL_FRONT = 0.62;
const LINTEL_HEIGHT = 2.08;
const RAIL_START = 0.55;
const RAIL_END = 2.65;
const CART_Z = 2.05;
const WHEEL_RADIUS = 0.17;

const VEIN_DIRECTIONS: readonly Triple[] = [
  [-0.75, 0.15, 0.65],
  [0.8, 0.35, 0.5],
  [-0.3, 0.75, 0.55],
  [0.95, -0.15, 0.3],
];

function hill(context: StructureContext, ore: MaterialSlotIndex): void {
  const mound = moundShape(context, [0, 0, MOUND_CENTER], MOUND_RADIUS, [1.15, 1.05, 0.9]);

  context.builder.add(mound, {
    style: {
      buildOrder: rising(0.05, 0.35, 0, 2.2),
      shade: (point) => 0.72 + 0.12 * Math.min(1, point.position.y / 2),
      slot: MaterialSlot.Stone,
    },
  });

  const center = new Vector3(0, 0.9, MOUND_CENTER);
  const veins = detail(context, VEIN_DIRECTIONS.length, 2);

  for (const direction of VEIN_DIRECTIONS.slice(0, veins)) {
    const hit = outermostHit(mound, center, new Vector3(...direction));

    if (hit === null) {
      continue;
    }

    const position = hit.point.clone().addScaledVector(hit.normal, -0.1);

    addRock(context, [position.x, position.y, position.z], 0.3, [1.3, 0.75, 1.1], {
      buildOrder: 0.4,
      shade: 0.9,
      slot: ore,
    });
  }
}

function portal(context: StructureContext): void {
  addBlock(context, [1.3, 1.95, 0.9], [0, 0.975, 0.1], { buildOrder: 0.3, slot: MaterialSlot.Ash });

  for (const side of [-1, 1]) {
    const x = side * PORTAL_HALF_WIDTH;

    addLog(context, [x, 0, PORTAL_FRONT], [x, PORTAL_HEIGHT, PORTAL_FRONT], 0.11, {
      buildOrder: 0.45,
      slot: MaterialSlot.Wood,
    });
    addLog(context, [side * 1.25, 0, PORTAL_FRONT + 0.35], [side * 0.78, 1.6, PORTAL_FRONT], 0.08, {
      buildOrder: 0.5,
      slot: MaterialSlot.Wood,
    });
  }

  addLog(
    context,
    [-PORTAL_HALF_WIDTH - 0.26, LINTEL_HEIGHT, PORTAL_FRONT],
    [PORTAL_HALF_WIDTH + 0.26, LINTEL_HEIGHT, PORTAL_FRONT],
    0.12,
    { buildOrder: 0.6, slot: MaterialSlot.Wood }
  );

  context.builder.add(card(0.7, 0.5), {
    style: { buildOrder: 0.97, slot: MaterialSlot.Accent },
    transform: transformOf({ position: [0, LINTEL_HEIGHT + 0.06 - 0.5, PORTAL_FRONT + 0.08] }),
  });
}

function track(context: StructureContext): void {
  const length = RAIL_END - RAIL_START;

  for (const side of [-1, 1]) {
    addBlock(context, [0.08, 0.06, length], [side * 0.3, 0.03, RAIL_START + length / 2], {
      buildOrder: 0.65,
      slot: MaterialSlot.Wood,
    });
  }

  const sleepers = detail(context, 4, 2);

  for (let sleeper = 0; sleeper < sleepers; sleeper += 1) {
    const z = RAIL_START + ((sleeper + 0.5) / sleepers) * length;

    addBlock(context, [0.9, 0.05, 0.14], [0, 0.025, z], { buildOrder: 0.63, shade: 0.8, slot: MaterialSlot.Wood });
  }
}

function cart(context: StructureContext, ore: MaterialSlotIndex): void {
  addBlock(context, [0.85, 0.42, 0.62], [0, 0.48, CART_Z], { buildOrder: 0.8, slot: MaterialSlot.Wood });
  addRock(context, [0, 0.7, CART_Z], 0.3, [1.2, 0.45, 0.9], { buildOrder: 0.9, slot: ore });

  for (const side of [-1, 1]) {
    for (const offset of [-0.2, 0.2]) {
      context.builder.add(
        cylinder({
          height: 0.08,
          radialSegments: detail(context, 10, 6),
          radiusBottom: WHEEL_RADIUS,
          radiusTop: WHEEL_RADIUS,
        }),
        {
          style: { buildOrder: 0.78, shade: 0.8, slot: MaterialSlot.Wood },
          transform: transformOf({
            position: [side * 0.39, WHEEL_RADIUS, CART_Z + offset],
            rotation: [0, 0, -side * (Math.PI / 2)],
          }),
        }
      );
    }
  }
}

function heaps(context: StructureContext, ore: MaterialSlotIndex): void {
  addMound(context, [1.95, 0, 1], 0.85, [1.2, 0.6, 1], {
    buildOrder: 0.7,
    shade: 0.85,
    slot: MaterialSlot.PaleStone,
  });
  addMound(context, [-1.85, 0, 1.3], 0.62, [1.1, 0.7, 1], { buildOrder: 0.85, slot: ore });

  if (!isDetailed(context)) {
    return;
  }

  addRock(context, [-1.2, 0.08, 1.85], 0.14, [1, 0.7, 1], { buildOrder: 0.87, slot: ore });
  addRock(context, [-2.25, 0.08, 0.55], 0.16, [1, 0.7, 1], { buildOrder: 0.87, slot: ore });
}

export function mineWith(context: StructureContext, ore: MineOre): void {
  const slot = ORE_SLOTS[ore];

  hill(context, slot);
  portal(context);
  track(context);
  cart(context, slot);
  heaps(context, slot);
}

export function mine(context: StructureContext): void {
  mineWith(context, "copper");
}

export function buildMineModel(ore: MineOre, level: StructureLevel): MeshData {
  const builder = new MeshBuilder();

  mineWith({ builder, level, random: createRandom(ore.length * 37 + 11) }, ore);

  return scaledMesh(builder.build(), MINE_SCALE);
}

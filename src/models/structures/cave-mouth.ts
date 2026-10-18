import { clamp, FULL_TURN, lerp, smoothstep } from "../../shared/math.ts";
import { createRandom, type RandomSource } from "../../shared/random.ts";
import { MaterialSlot, type MaterialSlotIndex } from "../materials.ts";
import { MeshBuilder, type SurfacePoint } from "../mesh/mesh-builder.ts";
import type { MeshData } from "../mesh/mesh-data.ts";
import type { Shape } from "../mesh/shape.ts";
import { icosphere } from "../mesh/shapes.ts";
import { type Triple, transformOf } from "../mesh/transforms.ts";
import { type ChiselOptions, chiseledStone, groundShade, weatheredSlot } from "../stones.ts";

export interface CaveLook {
  readonly base: MaterialSlotIndex;
  readonly frost: number;
  readonly moss: number;
}

export interface CaveMouthOptions {
  readonly look: CaveLook;
  readonly rise: number;
  readonly seed: number;
  readonly width: number;
}

interface CaveContext {
  readonly builder: MeshBuilder;
  readonly crown: number;
  readonly height: number;
  readonly look: CaveLook;
  readonly random: RandomSource;
  readonly width: number;
}

interface RockPlacement {
  readonly position: Triple;
  readonly rotation?: Triple;
  readonly scale: Triple;
}

const STONE_DETAIL = 2;
const DARKEST_INSIDE = 0.05;
const DIMMEST_ROCK = 0.16;
const INSIDE_DEPTH = 3.4;
const HEIGHT_SHARE = [0.68, 0.84] as const;
const BURIED_DEPTH = 1.6;
const LOWEST_CROWN = 2.4;
const HIGHEST_CROWN = 9;
const POCKET_FRONT = 0.2;
const DOWN: Triple = [0, -1, 0];
const UP: Triple = [0, 1, 0];
const FRONT: Triple = [0, 0, 1];

const JAMB_CUT: ChiselOptions = { cuts: 8, depth: 0.45, radius: 1, roughness: 0.12 };
const LINTEL_CUT: ChiselOptions = {
  cuts: 7,
  depth: 0.4,
  flats: [{ distance: 0.4, normal: DOWN }],
  radius: 1,
  roughness: 0.1,
};
const MASS_CUT: ChiselOptions = {
  cuts: 9,
  depth: 0.5,
  flats: [{ distance: 0.72, normal: FRONT }],
  radius: 1,
  roughness: 0.16,
};
const CROWN_CUT: ChiselOptions = {
  cuts: 8,
  depth: 0.45,
  flats: [
    { distance: 0.62, normal: UP },
    { distance: 0.74, normal: FRONT },
  ],
  radius: 1,
  roughness: 0.14,
};
const PEBBLE_CUT: ChiselOptions = { cuts: 6, depth: 0.45, radius: 1, roughness: 0.14 };

function hollowBack(shape: Shape): Shape {
  const indices: number[] = [];

  for (let corner = 0; corner < shape.indices.length; corner += 3) {
    const [first, second, third] = [0, 1, 2].map((offset) => shape.indices[corner + offset]);

    const isBehind = [first, second, third].every((vertex) => shape.positions[vertex * 3 + 2] <= POCKET_FRONT);

    if (isBehind) {
      indices.push(first, third, second);
    }
  }

  return { ...shape, indices: Uint32Array.from(indices), normals: shape.normals.map((value) => -value) };
}

function insideShade(context: CaveContext): (point: SurfacePoint) => number {
  const ground = groundShade(context.height);
  const halfWidth = context.width / 2;

  return (point) => {
    const { position } = point;

    const across = smoothstep(halfWidth + 1.2, halfWidth - 0.4, Math.abs(position.x));
    const below = smoothstep(context.height + 0.8, context.height - 0.6, position.y);
    const depth = smoothstep(0.6, -INSIDE_DEPTH, position.z);

    return ground(point) * lerp(1, DIMMEST_ROCK, across * below * depth);
  };
}

function addRock(context: CaveContext, shape: Shape, placement: RockPlacement, moss = context.look.moss): void {
  const { look, random } = context;

  context.builder.add(shape, {
    style: {
      shade: insideShade(context),
      slot: weatheredSlot({ base: look.base, frost: look.frost, lichen: 0.14, moss, seed: random.next() * 40 }),
    },
    transform: transformOf(placement),
  });
}

function chisel(context: CaveContext, options: ChiselOptions): Shape {
  return chiseledStone(context.random, options, STONE_DETAIL);
}

function addPocket(context: CaveContext): void {
  const { builder, height, width } = context;

  builder.add(hollowBack(icosphere(1, STONE_DETAIL)), {
    style: {
      shade: (point) => lerp(DIMMEST_ROCK * 1.5, DARKEST_INSIDE, smoothstep(-1, -INSIDE_DEPTH - 2, point.position.z)),
      slot: MaterialSlot.Basalt,
    },
    transform: transformOf({ position: [0, height * 0.32, -INSIDE_DEPTH], scale: [width * 0.56, height * 0.72, 3.2] }),
  });
}

function addJamb(context: CaveContext, side: -1 | 1): void {
  const { height, random, width } = context;

  const sideWidth = width * random.between(0.3, 0.42) + 1;
  const sideHeight = height * random.between(0.62, 0.72);

  addRock(context, chisel(context, { ...JAMB_CUT, flats: [{ distance: 0.78, normal: [-side, 0, 0] }] }), {
    position: [side * (width / 2 + sideWidth * 0.82), sideHeight - BURIED_DEPTH, random.between(-1.6, -0.8)],
    rotation: [random.signed() * 0.06, random.signed() * 0.25, side * random.between(0.02, 0.1)],
    scale: [sideWidth, sideHeight, random.between(3.4, 4.2)],
  });
}

function addLintel(context: CaveContext): void {
  const { height, random, width } = context;

  const thickness = random.between(1.8, 2.4);

  addRock(context, chisel(context, LINTEL_CUT), {
    position: [random.signed() * 0.4, height + thickness * 0.4, random.between(-0.8, -0.3)],
    rotation: [random.between(-0.08, 0.02), random.signed() * 0.12, random.signed() * 0.05],
    scale: [width / 2 + random.between(2.2, 3), thickness, random.between(3.2, 3.8)],
  });
}

function addMass(context: CaveContext): void {
  const { crown, height, random, width } = context;

  addRock(context, chisel(context, MASS_CUT), {
    position: [random.signed() * 0.6, (height + crown) * 0.45, -7],
    rotation: [0, random.signed() * 0.2, 0],
    scale: [width / 2 + 4, (height + crown) * 0.75, 3.8],
  });

  for (const side of [-1, 1] as const) {
    addRock(context, chisel(context, CROWN_CUT), {
      position: [side * width * random.between(0.25, 0.4), height + crown * 0.55, random.between(-4.2, -3.2)],
      rotation: [random.signed() * 0.15, random.next() * FULL_TURN, random.signed() * 0.15],
      scale: [width * random.between(0.45, 0.6), crown * 0.6 + 0.8, random.between(3.2, 4)],
    });

    addRock(context, chisel(context, MASS_CUT), {
      position: [side * (width / 2 + random.between(4, 5.2)), height * 0.35, random.between(-3.8, -2.8)],
      rotation: [random.signed() * 0.1, random.next() * FULL_TURN, random.signed() * 0.1],
      scale: [random.between(2.8, 3.6), height * random.between(0.5, 0.65), random.between(3.4, 4.2)],
    });
  }
}

function addThreshold(context: CaveContext): void {
  const { random, width } = context;

  for (const side of [-1, 1] as const) {
    const radius = random.between(0.6, 1);

    addRock(
      context,
      chisel(context, { ...PEBBLE_CUT, radius }),
      {
        position: [side * (width / 2 - radius * 0.2), radius * 0.2, random.between(0.8, 2.2)],
        rotation: [random.signed() * 0.4, random.next() * FULL_TURN, random.signed() * 0.4],
        scale: [1, 0.7, 0.9],
      },
      context.look.moss + 0.2
    );
  }
}

export function meshCaveMouth(options: CaveMouthOptions): MeshData {
  const random = createRandom(Math.floor(options.seed * 1_000_000) + 1);
  const builder = new MeshBuilder();

  const height = options.width * random.between(...HEIGHT_SHARE);

  const context: CaveContext = {
    builder,
    crown: clamp(options.rise - height, LOWEST_CROWN, HIGHEST_CROWN),
    height,
    look: options.look,
    random,
    width: options.width,
  };

  addPocket(context);
  addJamb(context, -1);
  addJamb(context, 1);
  addLintel(context);
  addMass(context);
  addThreshold(context);

  return builder.build();
}

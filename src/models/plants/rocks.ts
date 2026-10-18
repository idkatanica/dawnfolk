import { Matrix4, Vector3 } from "three";
import { PlantSpecies, type PlantSpeciesIndex } from "../../content/plants.ts";
import { FULL_TURN } from "../../shared/math.ts";
import { createVolumeNoise } from "../../shared/noise.ts";
import { createRandom, type RandomSource } from "../../shared/random.ts";
import { MaterialSlot, type MaterialSlotIndex } from "../materials.ts";
import { MeshBuilder, type SurfacePoint } from "../mesh/mesh-builder.ts";
import type { MeshData } from "../mesh/mesh-data.ts";
import { facetShape, type Shape } from "../mesh/shape.ts";
import { blob, type LoftSection, loft } from "../mesh/shapes.ts";
import { type Triple, transformOf } from "../mesh/transforms.ts";
import { type ChiselOptions, chiseledStone, type FlatCut, groundShade, STONE_NOISE, weatheredSlot } from "../stones.ts";
import type { PlantDetailLevel } from "./tree-mesher.ts";

type RockSpecies =
  | typeof PlantSpecies.Boulder
  | typeof PlantSpecies.Crag
  | typeof PlantSpecies.FrostedRock
  | typeof PlantSpecies.MossyRock
  | typeof PlantSpecies.Sandstone
  | typeof PlantSpecies.Scree
  | typeof PlantSpecies.Slab;

export const ROCK_HEIGHTS = {
  [PlantSpecies.Boulder]: 1.7,
  [PlantSpecies.Crag]: 4.2,
  [PlantSpecies.FrostedRock]: 1.6,
  [PlantSpecies.MossyRock]: 1.5,
  [PlantSpecies.Sandstone]: 2.6,
  [PlantSpecies.Scree]: 0.8,
  [PlantSpecies.Slab]: 0.8,
} as const satisfies Readonly<Record<RockSpecies, number>>;

export const ROCK_VARIANT_COUNTS = {
  [PlantSpecies.Boulder]: 4,
  [PlantSpecies.Crag]: 3,
  [PlantSpecies.FrostedRock]: 3,
  [PlantSpecies.MossyRock]: 3,
  [PlantSpecies.Sandstone]: 3,
  [PlantSpecies.Scree]: 3,
  [PlantSpecies.Slab]: 3,
} as const satisfies Readonly<Record<RockSpecies, number>>;

const BOULDER_NOISE = createVolumeNoise(createRandom(8080));
const STONE_DETAIL: Readonly<Record<PlantDetailLevel, number>> = { far: 0, high: 2, low: 0, medium: 1 };
const PEBBLE_DETAIL: Readonly<Record<PlantDetailLevel, number>> = { far: 0, high: 1, low: 0, medium: 0 };
const SPLIT_DETAIL: Readonly<Record<PlantDetailLevel, number>> = { far: 0, high: 2, low: 1, medium: 1 };
const STRATA_SEGMENTS: Readonly<Record<PlantDetailLevel, number>> = { far: 4, high: 14, low: 6, medium: 9 };
const SHOWN_SCREE_STONES: Readonly<Record<PlantDetailLevel, number>> = { far: 2, high: 9, low: 4, medium: 9 };
const UP: Triple = [0, 1, 0];
const DOWN: Triple = [0, -1, 0];

interface RockContext {
  readonly builder: MeshBuilder;
  readonly height: number;
  readonly level: PlantDetailLevel;
  readonly random: RandomSource;
  readonly variant: number;
}

interface StonePlacement {
  readonly bottom?: number;
  readonly position: Triple;
  readonly rotation?: Triple;
  readonly scale?: Triple;
}

interface StoneLook {
  readonly frost?: number;
  readonly lichen: number;
  readonly moss: number;
  readonly slot?: MaterialSlotIndex;
}

function lowestPoint(shape: Shape, transform: Matrix4): number {
  const point = new Vector3();
  let lowest = Number.POSITIVE_INFINITY;

  for (let offset = 0; offset < shape.positions.length; offset += 3) {
    lowest = Math.min(lowest, point.fromArray(shape.positions, offset).applyMatrix4(transform).y);
  }

  return lowest;
}

function grounded(shape: Shape, placement: StonePlacement): Matrix4 {
  const transform = transformOf(placement);

  if (placement.bottom === undefined) {
    return transform;
  }

  return new Matrix4().makeTranslation(0, placement.bottom - lowestPoint(shape, transform), 0).multiply(transform);
}

function addStone(context: RockContext, shape: Shape, placement: StonePlacement, look: StoneLook): void {
  const { frost = 0, slot = MaterialSlot.Stone } = look;

  context.builder.add(shape, {
    style: {
      shade: groundShade(context.height),
      slot: weatheredSlot({
        base: slot,
        frost,
        lichen: look.lichen,
        moss: look.moss,
        seed: context.random.next() * 40,
      }),
    },
    transform: grounded(shape, placement),
  });
}

function chisel(context: RockContext, options: ChiselOptions): Shape {
  return chiseledStone(context.random, options, STONE_DETAIL[context.level]);
}

function sharedChisel(context: RockContext, options: ChiselOptions, splits: readonly FlatCut[]): Shape[] {
  const { flats = [] } = options;

  const seed = context.random.integer(1, 1_000_000);

  return splits.map((split) =>
    chiseledStone(createRandom(seed), { ...options, flats: [...flats, split] }, SPLIT_DETAIL[context.level])
  );
}

function roundStone(context: RockContext, radius: number, roughness: number): Shape {
  return facetShape(
    blob({
      detail: STONE_DETAIL[context.level],
      frequency: 1.1,
      noise: BOULDER_NOISE,
      normalSoftness: 0,
      offset: [context.random.next() * 97, context.random.next() * 13, context.random.next() * 31],
      radius,
      roughness,
    })
  );
}

const BOULDER_COMPANIONS: readonly (readonly number[])[] = [[], [0.62], [], [0.58, 0.46]];

function boulder(context: RockContext): void {
  const { random, variant } = context;

  const radius = variant === 2 ? 1.35 : 1.25;
  const flatness = variant === 2 ? random.between(0.5, 0.6) : random.between(0.66, 0.84);

  addStone(
    context,
    roundStone(context, radius, 0.32),
    {
      position: [0, radius * flatness * 0.75, 0],
      rotation: [random.signed() * 0.3, random.next() * FULL_TURN, random.signed() * 0.3],
      scale: [1, flatness, random.between(0.85, 1.1)],
    },
    { lichen: 0.14, moss: 0.3 }
  );

  for (const [index, companion] of BOULDER_COMPANIONS[variant % BOULDER_COMPANIONS.length].entries()) {
    const angle = random.next() * FULL_TURN + index * 2.4;
    const reach = radius * 0.7 + companion * 0.4;
    const squash = random.between(0.62, 0.85);

    addStone(
      context,
      roundStone(context, companion, 0.3),
      {
        position: [Math.cos(angle) * reach, companion * squash * 0.7, Math.sin(angle) * reach],
        rotation: [random.signed() * 0.4, random.next() * FULL_TURN, random.signed() * 0.4],
        scale: [1, squash, random.between(0.85, 1.15)],
      },
      { lichen: 0.12, moss: 0.25 }
    );
  }
}

const SLAB_CUT: ChiselOptions = {
  cuts: 5,
  depth: 0.4,
  flats: [
    { distance: 0.3, normal: UP },
    { distance: 0.3, normal: DOWN },
  ],
  radius: 1.45,
  roughness: 0.05,
};

const SLAB_LOOK: StoneLook = { lichen: 0.3, moss: 0.12 };

function slab(context: RockContext): void {
  const { random, variant } = context;

  if (variant === 1) {
    const [left, right] = sharedChisel(context, SLAB_CUT, [
      { distance: 0.04, normal: [1, 0, 0.15] },
      { distance: 0.04, normal: [-1, 0, -0.15] },
    ]);

    addStone(
      context,
      left,
      { position: [-0.12, 0.22, 0], rotation: [0.03, 0, 0.05], scale: [1.25, 1, 0.9] },
      SLAB_LOOK
    );
    addStone(
      context,
      right,
      { position: [0.14, 0.2, 0.05], rotation: [-0.04, 0.12, -0.07], scale: [1.25, 1, 0.9] },
      SLAB_LOOK
    );

    return;
  }

  if (variant === 2) {
    addStone(
      context,
      chisel(context, { ...SLAB_CUT, radius: 1.3 }),
      { position: [-0.15, 0.3, 0], rotation: [0, 0, 0.24], scale: [1.2, 0.8, 0.85] },
      SLAB_LOOK
    );
    addStone(
      context,
      chisel(context, { cuts: 5, depth: 0.4, radius: 0.5, roughness: 0.1 }),
      { position: [0.95, 0.2, 0.05], scale: [1, 0.85, 1] },
      { lichen: 0.1, moss: 0.1 }
    );

    return;
  }

  addStone(
    context,
    chisel(context, SLAB_CUT),
    {
      position: [0, 0.24, 0],
      rotation: [random.signed() * 0.06, random.next() * FULL_TURN, random.signed() * 0.06],
      scale: [1.25, 1, 0.9],
    },
    SLAB_LOOK
  );
}

const CRAG_CUT: ChiselOptions = {
  cuts: 10,
  depth: 0.55,
  flats: [
    { distance: 0.82, normal: [0.35, 1, 0.2] },
    { distance: 0.84, normal: [1, 0, 0.3] },
    { distance: 0.8, normal: [-0.5, 0, 1] },
  ],
  radius: 1,
  roughness: 0.14,
};

const CRAG_LOOK: StoneLook = { lichen: 0.12, moss: 0.15 };

function crag(context: RockContext): void {
  const { random, variant } = context;

  if (variant === 1) {
    const [west, east] = sharedChisel(context, CRAG_CUT, [
      { distance: 0.05, normal: [1, 0, 0.2] },
      { distance: 0.05, normal: [-1, 0, -0.2] },
    ]);

    addStone(
      context,
      west,
      { bottom: -0.25, position: [-0.18, 1.22, 0], rotation: [0, 0, 0.06], scale: [1.1, 2.05, 0.9] },
      CRAG_LOOK
    );
    addStone(
      context,
      east,
      { bottom: -0.2, position: [0.2, 0.85, 0.04], rotation: [0.02, 0.08, -0.07], scale: [1.1, 1.95, 0.9] },
      CRAG_LOOK
    );

    return;
  }

  addStone(
    context,
    chisel(context, CRAG_CUT),
    {
      bottom: -0.35,
      position: [0, 1.66, 0],
      rotation: [random.signed() * 0.05, random.next() * FULL_TURN, random.signed() * 0.05],
      scale: [1.05, 2.05, 0.85],
    },
    CRAG_LOOK
  );

  if (variant === 2) {
    addStone(
      context,
      chisel(context, { ...CRAG_CUT, radius: 0.72 }),
      {
        bottom: -0.25,
        position: [0.95, 1.05, 0.35],
        rotation: [random.signed() * 0.08, random.next() * FULL_TURN, -0.1],
        scale: [1, 1.8, 0.9],
      },
      CRAG_LOOK
    );
  }
}

interface ScreeStone {
  readonly radius: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function screeLayout(random: RandomSource, variant: number): ScreeStone[] {
  const count = variant === 0 ? 9 : 7;
  const radii = Array.from({ length: count }, () => random.between(0.22, 0.55)).sort((first, second) => second - first);

  return radii.map((radius, index) => {
    if (variant === 2) {
      const along = (index / (count - 1) - 0.5) * 2.6;

      return { radius, x: along, y: radius * 0.38, z: random.signed() * 0.35 };
    }

    if (variant === 1 && index >= count - 2) {
      return { radius, x: random.signed() * 0.25, y: 0.3 + radius * 0.3, z: random.signed() * 0.25 };
    }

    const angle = random.next() * FULL_TURN;
    const spread = variant === 1 ? 0.75 : 1.5;
    const reach = Math.sqrt(random.next()) * spread;

    return { radius, x: Math.cos(angle) * reach, y: radius * 0.38, z: Math.sin(angle) * reach * 0.6 };
  });
}

function scree(context: RockContext): void {
  const { level, random, variant } = context;

  const stones = screeLayout(random, variant);
  const shown = stones.slice(0, SHOWN_SCREE_STONES[level]);

  for (const stone of shown) {
    addStone(
      context,
      chiseledStone(random, { cuts: 7, depth: 0.5, radius: stone.radius, roughness: 0.12 }, PEBBLE_DETAIL[level]),
      {
        position: [stone.x, stone.y, stone.z],
        rotation: [random.signed() * 0.5, random.next() * FULL_TURN, random.signed() * 0.5],
        scale: [1, 0.72, 0.9],
      },
      { lichen: 0.08, moss: 0.06 }
    );
  }
}

const MOSSY_LOOK: StoneLook = { lichen: 0.16, moss: 0.62 };

function mossyRock(context: RockContext): void {
  const { random, variant } = context;

  if (variant === 1) {
    addStone(
      context,
      roundStone(context, 0.95, 0.22),
      { position: [-0.45, 0.62, 0], rotation: [0.1, random.next() * FULL_TURN, 0.25], scale: [1, 0.85, 0.9] },
      MOSSY_LOOK
    );
    addStone(
      context,
      roundStone(context, 0.78, 0.22),
      { position: [0.55, 0.5, 0.1], rotation: [-0.1, random.next() * FULL_TURN, -0.3], scale: [1, 0.85, 0.95] },
      MOSSY_LOOK
    );

    return;
  }

  const radius = variant === 2 ? 1.55 : 1.15;
  const flatness = variant === 2 ? 0.42 : 0.78;

  addStone(
    context,
    roundStone(context, radius, 0.2),
    {
      position: [0, radius * flatness * 0.72, 0],
      rotation: [random.signed() * 0.15, random.next() * FULL_TURN, random.signed() * 0.15],
      scale: [1.1, flatness, 0.95],
    },
    MOSSY_LOOK
  );
}

interface Stratum {
  readonly bottom: number;
  readonly radius: number;
  readonly top: number;
}

function strataSections(strata: readonly Stratum[], random: RandomSource): LoftSection[] {
  const [first] = strata;

  const offset = random.next() * 30;
  const last = strata.at(-1);

  if (last === undefined) {
    return [];
  }

  function ring(radius: number, y: number, centerX = 0): LoftSection {
    return {
      centerX,
      radiusX: radius,
      radiusZ: radius * 0.8,
      ripple: (around) => {
        const angle = around * FULL_TURN;

        return 1 + 0.16 * STONE_NOISE.sample(Math.cos(angle) * 1.3 + offset, Math.sin(angle) * 1.3, y * 0.6);
      },
      y,
    };
  }

  const sections: LoftSection[] = [{ radiusX: 0, radiusZ: 0, y: first.bottom - 0.05 }];

  for (const [index, stratum] of strata.entries()) {
    const thickness = stratum.top - stratum.bottom;
    const drift = (index % 2 === 0 ? 1 : -1) * 0.06;

    sections.push(
      ring(stratum.radius * 0.92, stratum.bottom, drift),
      ring(stratum.radius, stratum.bottom + thickness * 0.3, drift),
      ring(stratum.radius * 0.96, stratum.top - thickness * 0.15, drift)
    );
  }

  sections.push(ring(last.radius * 0.7, last.top, 0), { radiusX: 0, radiusZ: 0, y: last.top + 0.04 });

  return sections;
}

function stack(bottom: number, layers: readonly (readonly [number, number])[]): Stratum[] {
  const strata: Stratum[] = [];
  let floor = bottom;

  for (const [radius, thickness] of layers) {
    strata.push({ bottom: floor, radius, top: floor + thickness });
    floor += thickness;
  }

  return strata;
}

function bandSlot(height: number, seed: number): (point: SurfacePoint) => MaterialSlotIndex {
  return (point) => {
    const { position } = point;

    const wobble = STONE_NOISE.sample(position.x * 0.8 + seed, position.z * 0.8, 3) * 0.12;
    const band = Math.floor((position.y + wobble) / height);

    return band % 2 === 0 ? MaterialSlot.Sandstone : MaterialSlot.SandstoneBand;
  };
}

const SANDSTONE_STRATA: readonly (readonly (readonly [number, number])[])[] = [
  [
    [0.62, 0.6],
    [0.5, 0.55],
    [0.42, 0.5],
    [0.36, 0.45],
  ],
  [
    [1.85, 0.7],
    [1.55, 0.68],
    [1.22, 0.66],
    [0.85, 0.62],
  ],
  [
    [1.3, 0.45],
    [1.12, 0.4],
    [1.36, 0.45],
    [1.18, 0.4],
    [1.0, 0.4],
  ],
];

function sandstone(context: RockContext): void {
  const { builder, level, random, variant } = context;

  const strata = stack(-0.3, SANDSTONE_STRATA[variant % SANDSTONE_STRATA.length]);
  const seed = random.next() * 20;

  builder.add(facetShape(loft(strataSections(strata, random), STRATA_SEGMENTS[level])), {
    style: { shade: groundShade(context.height), slot: bandSlot(0.32, seed) },
    transform: transformOf({ rotation: [0, random.next() * FULL_TURN, 0] }),
  });

  if (variant !== 0) {
    return;
  }

  const top = strata.at(-1);

  if (top === undefined) {
    return;
  }

  addStone(
    context,
    chisel(context, {
      cuts: 5,
      depth: 0.35,
      flats: [
        { distance: 0.34, normal: UP },
        { distance: 0.34, normal: DOWN },
      ],
      radius: 1.05,
      roughness: 0.06,
    }),
    { position: [0.08, top.top + 0.22, 0], rotation: [0.04, random.next() * FULL_TURN, -0.05], scale: [1, 0.9, 0.85] },
    { lichen: 0, moss: 0, slot: MaterialSlot.SandstoneBand }
  );
}

const FROST_CUT: ChiselOptions = { cuts: 8, depth: 0.5, radius: 1.1, roughness: 0.08 };
const FROST_LOOK: StoneLook = { frost: 0.36, lichen: 0, moss: 0, slot: MaterialSlot.Basalt };

function frostedRock(context: RockContext): void {
  const { random, variant } = context;

  if (variant === 2) {
    addStone(
      context,
      chisel(context, {
        ...FROST_CUT,
        flats: [
          { distance: 0.48, normal: UP },
          { distance: 0.4, normal: DOWN },
        ],
        radius: 1.4,
      }),
      { position: [0, 0.45, 0], rotation: [0.05, random.next() * FULL_TURN, -0.04], scale: [1.2, 0.85, 1] },
      FROST_LOOK
    );

    return;
  }

  addStone(
    context,
    chisel(context, FROST_CUT),
    {
      position: [0, 0.62, 0],
      rotation: [random.signed() * 0.2, random.next() * FULL_TURN, random.signed() * 0.2],
      scale: [1.1, 0.95, 0.9],
    },
    FROST_LOOK
  );

  if (variant === 1) {
    addStone(
      context,
      chisel(context, { ...FROST_CUT, radius: 0.68 }),
      { position: [1.15, 0.4, 0.3], rotation: [0.3, random.next() * FULL_TURN, 0.2], scale: [1, 0.85, 1] },
      FROST_LOOK
    );
  }
}

const ROCK_MESHERS: Readonly<Record<RockSpecies, (context: RockContext) => void>> = {
  [PlantSpecies.Boulder]: boulder,
  [PlantSpecies.Crag]: crag,
  [PlantSpecies.FrostedRock]: frostedRock,
  [PlantSpecies.MossyRock]: mossyRock,
  [PlantSpecies.Sandstone]: sandstone,
  [PlantSpecies.Scree]: scree,
  [PlantSpecies.Slab]: slab,
};

const ROCK_SPECIES: ReadonlySet<number> = new Set(Object.keys(ROCK_MESHERS).map(Number));

export function isRockModel(species: PlantSpeciesIndex): species is RockSpecies {
  return ROCK_SPECIES.has(species);
}

export function meshRock(species: RockSpecies, seed: number, variant: number, level: PlantDetailLevel): MeshData {
  const builder = new MeshBuilder();

  ROCK_MESHERS[species]({ builder, height: ROCK_HEIGHTS[species], level, random: createRandom(seed), variant });

  return builder.build();
}

import { type MonumentPiece, PIECE_FORMS, type PieceForm } from "../../content/monuments.ts";
import { PlantSpecies, type PlantSpeciesIndex } from "../../content/plants.ts";
import { FULL_TURN, lerp } from "../../shared/math.ts";
import { createRandom, type RandomSource } from "../../shared/random.ts";
import { MaterialSlot, type MaterialSlotIndex } from "../materials.ts";
import { MeshBuilder } from "../mesh/mesh-builder.ts";
import type { MeshData } from "../mesh/mesh-data.ts";
import { deformShape, facetShape, type Shape } from "../mesh/shape.ts";
import { box, type LoftSection, loft } from "../mesh/shapes.ts";
import { type Triple, transformOf } from "../mesh/transforms.ts";
import type { PlantDetailLevel } from "../plants/tree-mesher.ts";
import { type ChiselOptions, chiseledStone, groundShade, STONE_NOISE, weatheredSlot } from "../stones.ts";

export const MONUMENT_HEIGHTS = {
  [PlantSpecies.Arch]: 5.4,
  [PlantSpecies.Cairn]: 2,
  [PlantSpecies.Dolmen]: 2.8,
  [PlantSpecies.Idol]: 5.2,
  [PlantSpecies.Menhir]: 4,
  [PlantSpecies.Pillar]: 4.4,
} as const satisfies Readonly<Record<MonumentPiece, number>>;

const STONE_SEGMENTS: Readonly<Record<PlantDetailLevel, number>> = { high: 12, low: 5, medium: 8 };
const HEAD_SEGMENTS: Readonly<Record<PlantDetailLevel, number>> = { high: 14, low: 6, medium: 9 };
const DRUM_SEGMENTS: Readonly<Record<PlantDetailLevel, number>> = { high: 24, low: 6, medium: 12 };
const DRESSED_DETAIL = 2;
const FLUTES = 12;
const HALF_TURN = Math.PI;
const QUARTER_TURN = Math.PI / 2;

interface MonumentContext {
  readonly builder: MeshBuilder;
  readonly height: number;
  readonly level: PlantDetailLevel;
  readonly random: RandomSource;
}

interface PieceLook {
  readonly lichen: number;
  readonly moss: number;
  readonly slot: MaterialSlotIndex;
}

const WEATHERED_STONE: PieceLook = { lichen: 0.24, moss: 0.3, slot: MaterialSlot.Stone };
const CAIRN_STONE: PieceLook = { lichen: 0.26, moss: 0.14, slot: MaterialSlot.Stone };
const WORKED_STONE: PieceLook = { lichen: 0.22, moss: 0.2, slot: MaterialSlot.PaleStone };

interface Placement {
  readonly position?: Triple;
  readonly rotation?: Triple;
  readonly scale?: Triple;
}

function addPiece(context: MonumentContext, shape: Shape, placement: Placement, look: PieceLook): void {
  context.builder.add(shape, {
    style: {
      shade: groundShade(context.height),
      slot: weatheredSlot({ ...look, base: look.slot, frost: 0, seed: context.random.next() * 40 }),
    },
    transform: transformOf(placement),
  });
}

function addPlain(context: MonumentContext, shape: Shape, placement: Placement, slot: MaterialSlotIndex): void {
  context.builder.add(shape, {
    style: { shade: groundShade(context.height), slot },
    transform: transformOf(placement),
  });
}

interface StandingStone {
  readonly height: number;
  readonly thickness: number;
  readonly width: number;
}

function roughRing(radiusX: number, radiusZ: number, y: number, offset: number, centerX = 0): LoftSection {
  return {
    centerX,
    radiusX,
    radiusZ,
    ripple: (around) => {
      const angle = around * FULL_TURN;

      const broad = STONE_NOISE.sample(Math.cos(angle) * 1.4 + offset, Math.sin(angle) * 1.4, y * 0.5);
      const fine = STONE_NOISE.sample(Math.cos(angle) * 3.6, Math.sin(angle) * 3.6 + offset, y * 1.4);

      return 1 + 0.14 * broad + 0.05 * fine;
    },
    y,
  };
}

function standingStone(context: MonumentContext, stone: StandingStone): Shape {
  const { height, thickness, width } = stone;
  const offset = context.random.next() * 30;
  const bend = context.random.signed() * 0.06;

  const profile: readonly (readonly [number, number])[] = [
    [-0.06, 0.92],
    [0.12, 1],
    [0.3, 0.99],
    [0.48, 0.95],
    [0.64, 0.9],
    [0.78, 0.82],
    [0.88, 0.7],
    [0.95, 0.5],
    [0.99, 0.24],
  ];

  const sections: LoftSection[] = [
    { radiusX: 0, radiusZ: 0, y: -0.06 * height - 0.06 },
    ...profile.map(([along, girth]) =>
      roughRing(
        (width / 2) * girth,
        (thickness / 2) * girth,
        along * height,
        offset,
        bend * Math.sin(along * HALF_TURN)
      )
    ),
    { radiusX: 0, radiusZ: 0, y: height },
  ];

  return facetShape(loft(sections, STONE_SEGMENTS[context.level]));
}

function brokenStone(context: MonumentContext, stone: StandingStone, breakAt: number): Shape {
  const whole = standingStone(context, { ...stone, height: breakAt / 0.92 });
  const offset = context.random.next() * 30;

  return facetShape(
    deformShape(whole, (vertex) => {
      if (vertex.y < breakAt * 0.82) {
        return [0, 0, 0];
      }

      const jag = STONE_NOISE.sample(vertex.x * 2.4 + offset, vertex.z * 2.4, 1.7);

      return [0, Math.min(0, breakAt + jag * 0.28 - vertex.y), 0];
    })
  );
}

const MENHIR: StandingStone = { height: 4, thickness: 0.62, width: 1.08 };

function menhir(context: MonumentContext, form: PieceForm<typeof PlantSpecies.Menhir>): void {
  const { random } = context;

  if (form === "fallen") {
    addPiece(
      context,
      standingStone(context, MENHIR),
      { position: [0, 0.12, -1.8], rotation: [QUARTER_TURN, random.signed() * 0.1, random.signed() * 0.08] },
      WEATHERED_STONE
    );

    return;
  }

  if (form === "broken") {
    addPiece(
      context,
      brokenStone(context, MENHIR, 2.2),
      { rotation: [0.05, 0, random.signed() * 0.05] },
      WEATHERED_STONE
    );
    addPiece(
      context,
      standingStone(context, { ...MENHIR, height: 1.7 }),
      { position: [0.45, 0.12, 0.25], rotation: [QUARTER_TURN, 0.9, 0.12] },
      WEATHERED_STONE
    );

    return;
  }

  const lean = form === "leaning" ? 0.27 : 0.04;

  addPiece(context, standingStone(context, MENHIR), { rotation: [lean, 0, random.signed() * 0.05] }, WEATHERED_STONE);
}

const CAPSTONE: ChiselOptions = {
  cuts: 6,
  depth: 0.35,
  flats: [
    { distance: 0.18, normal: [0, 1, 0] },
    { distance: 0.18, normal: [0, -1, 0] },
  ],
  radius: 1.9,
  roughness: 0.04,
};

function dolmen(context: MonumentContext, form: PieceForm<typeof PlantSpecies.Dolmen>): void {
  const { level, random } = context;

  const capstone = chiseledStone(random, CAPSTONE, level === "high" ? 2 : 1);
  const side: StandingStone = { height: 2.2, thickness: 0.42, width: 1.5 };
  const back: StandingStone = { height: 2.05, thickness: 0.4, width: 1.7 };

  addPiece(
    context,
    standingStone(context, side),
    { position: [-1.1, 0, 0.1], rotation: [0, QUARTER_TURN, 0.03] },
    WEATHERED_STONE
  );
  addPiece(
    context,
    standingStone(context, back),
    { position: [0, 0, -0.95], rotation: [-0.02, 0, 0] },
    WEATHERED_STONE
  );

  if (form === "collapsed") {
    addPiece(
      context,
      standingStone(context, side),
      { position: [1.55, 0.16, -1], rotation: [QUARTER_TURN, 0.25, 0] },
      WEATHERED_STONE
    );
    addPiece(
      context,
      capstone,
      { position: [0.15, 1.18, 0.15], rotation: [0.05, 0.12, -0.62], scale: [1.05, 1, 0.75] },
      WEATHERED_STONE
    );

    return;
  }

  addPiece(
    context,
    standingStone(context, { ...side, height: 2.12 }),
    { position: [1.1, 0, 0.05], rotation: [0, QUARTER_TURN, -0.03] },
    WEATHERED_STONE
  );
  addPiece(
    context,
    capstone,
    { position: [0.02, 2.3, 0], rotation: [0.03, 0.1, 0.04], scale: [1.05, 1, 0.75] },
    WEATHERED_STONE
  );
}

interface HeadRing {
  readonly radiusX: number;
  readonly radiusZ: number;
  readonly y: number;
}

const HEAD_RINGS: readonly HeadRing[] = [
  { radiusX: 1.05, radiusZ: 0.95, y: -0.2 },
  { radiusX: 1.15, radiusZ: 1.05, y: 0.3 },
  { radiusX: 1.22, radiusZ: 1.12, y: 1.2 },
  { radiusX: 1.28, radiusZ: 1.18, y: 2.1 },
  { radiusX: 1.3, radiusZ: 1.24, y: 2.9 },
  { radiusX: 1.28, radiusZ: 1.26, y: 3.5 },
  { radiusX: 1.2, radiusZ: 1.18, y: 4.2 },
  { radiusX: 1, radiusZ: 1, y: 4.8 },
  { radiusX: 0.6, radiusZ: 0.62, y: 5.1 },
];

function faceDepth(y: number): number {
  const above = HEAD_RINGS.findIndex((ring) => ring.y >= y);
  const upper = HEAD_RINGS[Math.max(0, above)];
  const lower = HEAD_RINGS[Math.max(0, above - 1)];

  if (upper === undefined || lower === undefined || upper.y === lower.y) {
    return 1.1;
  }

  return lerp(lower.radiusZ, upper.radiusZ, (y - lower.y) / (upper.y - lower.y));
}

function headShape(context: MonumentContext): Shape {
  const offset = context.random.next() * 30;

  const sections: LoftSection[] = [
    { radiusX: 0, radiusZ: 0, y: -0.25 },
    ...HEAD_RINGS.map((ring) => roughRing(ring.radiusX, ring.radiusZ, ring.y, offset)),
    { radiusX: 0, radiusZ: 0, y: 5.16 },
  ];

  return facetShape(loft(sections, HEAD_SEGMENTS[context.level]));
}

function noseShape(context: MonumentContext): Shape {
  const sections: LoftSection[] = [
    { radiusX: 0, radiusZ: 0, y: 1.95 },
    { radiusX: 0.32, radiusZ: 0.34, y: 2.02 },
    { radiusX: 0.3, radiusZ: 0.3, y: 2.45 },
    { radiusX: 0.15, radiusZ: 0.16, y: 3.3 },
    { radiusX: 0, radiusZ: 0, y: 3.38 },
  ];

  return facetShape(loft(sections, context.level === "low" ? 3 : 4));
}

function addHead(context: MonumentContext, placement: Placement): void {
  const { builder, level } = context;
  const head = new MeshBuilder();
  const carving: MonumentContext = { ...context, builder: head };

  addPiece(carving, headShape(context), {}, WEATHERED_STONE);
  addPiece(
    carving,
    noseShape(context),
    { position: [0, 0, faceDepth(2.6) - 0.06], rotation: [0.05, 0, 0] },
    WEATHERED_STONE
  );
  for (const side of [-1, 1]) {
    addPiece(
      carving,
      standingStone(context, { height: 1.55, thickness: 0.26, width: 0.5 }),
      { position: [side * 1.24, 1.85, 0.12], rotation: [0, QUARTER_TURN, side * 0.06] },
      WEATHERED_STONE
    );
  }

  if (level !== "low") {
    addPiece(
      carving,
      hewnBox(context.random, { depth: 0.42, height: 0.32, width: 1.9 }),
      { position: [0, 3.42, faceDepth(3.4) - 0.1], rotation: [-0.12, 0, 0] },
      WEATHERED_STONE
    );
    addPiece(
      carving,
      hewnBox(context.random, { depth: 0.34, height: 0.22, width: 0.86 }),
      { position: [0, 1.5, faceDepth(1.5) - 0.08] },
      WEATHERED_STONE
    );
    addPiece(
      carving,
      hewnBox(context.random, { depth: 0.36, height: 0.5, width: 0.9 }),
      { position: [0, 0.95, faceDepth(0.95) - 0.12] },
      WEATHERED_STONE
    );

    for (const side of [-1, 1]) {
      addPlain(
        carving,
        box(0.5, 0.24, 0.2),
        { position: [side * 0.48, 3.08, faceDepth(3.08) - 0.05], rotation: [0, side * 0.2, 0] },
        MaterialSlot.Basalt
      );
    }

    addPlain(carving, box(0.7, 0.07, 0.12), { position: [0, 1.36, faceDepth(1.36) + 0.02] }, MaterialSlot.Basalt);
  }

  builder.addMesh(head.build(), { transform: transformOf(placement) });
}

function idol(context: MonumentContext, form: PieceForm<typeof PlantSpecies.Idol>): void {
  const { random } = context;

  if (form === "toppled") {
    addHead(context, { position: [2.4, 0.8, 0], rotation: [0.18, random.signed() * 0.1, QUARTER_TURN - 0.12] });

    return;
  }

  addHead(context, { rotation: [-0.14, 0, random.signed() * 0.06] });
}

function drumShape(context: MonumentContext, height: number, broken: boolean): Shape {
  const segments = DRUM_SEGMENTS[context.level];
  const fluting = context.level === "high" ? 0.045 : 0;
  const offset = context.random.next() * 30;

  function ring(radius: number, y: number): LoftSection {
    return {
      radiusX: radius,
      radiusZ: radius,
      ripple: (around) => 1 + fluting * Math.cos(around * FULL_TURN * FLUTES),
      y,
    };
  }

  const drum = loft(
    [{ radiusX: 0, radiusZ: 0, y: 0 }, ring(0.47, 0), ring(0.46, height), { radiusX: 0, radiusZ: 0, y: height }],
    segments
  );

  if (!broken) {
    return facetShape(drum);
  }

  return facetShape(
    deformShape(drum, (vertex) => {
      if (vertex.y < height * 0.5) {
        return [0, 0, 0];
      }

      const jag = STONE_NOISE.sample(vertex.x * 2.6 + offset, vertex.z * 2.6, 4.1);

      return [0, -0.18 - Math.abs(jag) * 0.32 + jag * 0.1, 0];
    })
  );
}

const PLINTH: Placement = { position: [0, 0.1, 0] };
const DRUM_HEIGHT = 1.15;

function addColumn(context: MonumentContext, drums: number, broken: boolean): void {
  const { random } = context;

  addPiece(context, blockShape(context, { depth: 1.36, height: 0.52, width: 1.36 }), PLINTH, WORKED_STONE);

  for (let drum = 0; drum < drums; drum += 1) {
    const isTop = drum === drums - 1;

    addPiece(
      context,
      drumShape(context, DRUM_HEIGHT, broken && isTop),
      {
        position: [random.signed() * 0.03, 0.34 + drum * (DRUM_HEIGHT - 0.02), random.signed() * 0.03],
        rotation: [random.signed() * 0.015, random.next() * FULL_TURN, random.signed() * 0.015],
      },
      WORKED_STONE
    );
  }
}

function pillar(context: MonumentContext, form: PieceForm<typeof PlantSpecies.Pillar>): void {
  const { random } = context;

  if (form === "standing") {
    addColumn(context, 3, true);

    return;
  }

  addColumn(context, 1, true);

  if (form === "stump") {
    return;
  }

  for (let drum = 0; drum < 3; drum += 1) {
    addPiece(
      context,
      drumShape(context, DRUM_HEIGHT, false),
      {
        position: [2 + drum * 1.22, 0.3, random.signed() * 0.18 + drum * 0.12],
        rotation: [random.signed() * 0.1, random.signed() * 0.2, QUARTER_TURN],
      },
      WORKED_STONE
    );
  }
}

interface Block {
  readonly depth: number;
  readonly height: number;
  readonly width: number;
}

function hewnBox(random: RandomSource, block: Block): Shape {
  const { depth, height, width } = block;

  const offset = random.next() * 30;
  const wobble = Math.min(width, height, depth) * 0.08;

  return deformShape(box(width, height, depth), (vertex) => [
    STONE_NOISE.sample(vertex.x * 1.9 + offset, vertex.y * 1.9, vertex.z * 1.9) * wobble,
    STONE_NOISE.sample(vertex.x * 1.9, vertex.y * 1.9 + offset, vertex.z * 1.9) * wobble,
    STONE_NOISE.sample(vertex.x * 1.9, vertex.y * 1.9, vertex.z * 1.9 + offset) * wobble,
  ]);
}

function blockShape(context: MonumentContext, block: Block): Shape {
  const { depth, height, width } = block;

  const random = createRandom(context.random.integer(1, 1_000_000));

  if (context.level !== "high") {
    return hewnBox(random, block);
  }

  const radius = Math.hypot(width, height, depth) / 2;

  return chiseledStone(
    random,
    {
      cuts: 2,
      depth: 0.06,
      flats: [
        { distance: width / 2 / radius, normal: [1, 0, 0] },
        { distance: width / 2 / radius, normal: [-1, 0, 0] },
        { distance: height / 2 / radius, normal: [0, 1, 0] },
        { distance: height / 2 / radius, normal: [0, -1, 0] },
        { distance: depth / 2 / radius, normal: [0, 0, 1] },
        { distance: depth / 2 / radius, normal: [0, 0, -1] },
      ],
      radius: radius * 1.03,
      roughness: 0.02,
    },
    DRESSED_DETAIL
  );
}

const PIER_BLOCK: Block = { depth: 1, height: 1.06, width: 0.92 };
const VOUSSOIR: Block = { depth: 0.94, height: 0.62, width: 0.68 };
const SPAN = 1.75;
const SPRING = 2.95;
const VOUSSOIRS = 9;

function addPier(context: MonumentContext, shape: Shape, x: number, blocks: number): void {
  const { random } = context;

  for (let block = 0; block < blocks; block += 1) {
    addPiece(
      context,
      shape,
      {
        position: [x + random.signed() * 0.04, 0.42 + block * 1.02, random.signed() * 0.04],
        rotation: [0, random.signed() * 0.05, random.signed() * 0.02],
      },
      WORKED_STONE
    );
  }
}

function addVoussoir(context: MonumentContext, shape: Shape, index: number): void {
  const angle = (HALF_TURN * (index + 0.5)) / VOUSSOIRS;

  addPiece(
    context,
    shape,
    {
      position: [Math.cos(angle) * SPAN, SPRING + Math.sin(angle) * SPAN, 0],
      rotation: [0, 0, angle + QUARTER_TURN],
    },
    WORKED_STONE
  );
}

function farArch(context: MonumentContext, form: PieceForm<typeof PlantSpecies.Arch>): void {
  const pierHeight = PIER_BLOCK.height * 3;

  addPiece(
    context,
    box(PIER_BLOCK.width, pierHeight, PIER_BLOCK.depth),
    { position: [-SPAN, pierHeight / 2 - 0.12, 0] },
    WORKED_STONE
  );

  if (form === "collapsed") {
    addPiece(
      context,
      box(PIER_BLOCK.width, pierHeight * 0.66, PIER_BLOCK.depth),
      { position: [SPAN, pierHeight * 0.33 - 0.12, 0] },
      WORKED_STONE
    );
    addPiece(
      context,
      box(1.6, 0.62, 0.94),
      { position: [-1.25, SPRING + 0.75, 0], rotation: [0, 0, 0.9] },
      WORKED_STONE
    );

    return;
  }

  addPiece(
    context,
    box(PIER_BLOCK.width, pierHeight, PIER_BLOCK.depth),
    { position: [SPAN, pierHeight / 2 - 0.12, 0] },
    WORKED_STONE
  );

  for (const angle of [HALF_TURN / 6, HALF_TURN / 2, (HALF_TURN * 5) / 6]) {
    addPiece(
      context,
      box(1.9, 0.62, 0.94),
      {
        position: [Math.cos(angle) * SPAN, SPRING + Math.sin(angle) * SPAN, 0],
        rotation: [0, 0, angle + QUARTER_TURN],
      },
      WORKED_STONE
    );
  }
}

function arch(context: MonumentContext, form: PieceForm<typeof PlantSpecies.Arch>): void {
  const { random } = context;

  if (context.level === "low") {
    farArch(context, form);

    return;
  }

  const pierBlock = blockShape(context, PIER_BLOCK);
  const voussoir = blockShape(context, VOUSSOIR);

  addPier(context, pierBlock, -SPAN, 3);

  if (form === "standing") {
    addPier(context, pierBlock, SPAN, 3);

    for (let index = 0; index < VOUSSOIRS; index += 1) {
      if (index !== 5) {
        addVoussoir(context, voussoir, index);
      }
    }

    return;
  }

  addPier(context, pierBlock, SPAN, 2);

  for (let index = 6; index < VOUSSOIRS; index += 1) {
    addVoussoir(context, voussoir, index);
  }

  for (let fallen = 0; fallen < 3; fallen += 1) {
    addPiece(
      context,
      voussoir,
      {
        position: [random.between(-0.6, 1.6), 0.2, random.between(0.9, 1.8)],
        rotation: [random.signed() * 0.3, random.next() * FULL_TURN, random.signed() * 0.3],
      },
      WORKED_STONE
    );
  }
}

interface CairnRing {
  readonly radius: number;
  readonly stones: number;
  readonly y: number;
}

const TALL_CAIRN: readonly CairnRing[] = [
  { radius: 0.9, stones: 8, y: 0.16 },
  { radius: 0.62, stones: 6, y: 0.6 },
  { radius: 0.36, stones: 4, y: 1 },
  { radius: 0, stones: 1, y: 1.36 },
  { radius: 0, stones: 1, y: 1.62 },
];

const LOW_CAIRN: readonly CairnRing[] = [
  { radius: 1.2, stones: 10, y: 0.12 },
  { radius: 0.72, stones: 6, y: 0.5 },
  { radius: 0, stones: 1, y: 0.95 },
];

function cairnStone(context: MonumentContext, radius: number, isCore: boolean): Shape {
  const detail = isCore || context.level !== "high" ? 0 : 1;

  return chiseledStone(
    context.random,
    {
      cuts: 4,
      depth: 0.35,
      flats: [
        { distance: 0.62, normal: [0, 1, 0] },
        { distance: 0.62, normal: [0, -1, 0] },
      ],
      radius,
      roughness: 0.1,
    },
    detail
  );
}

const CAIRN_PEBBLE = 0.35;
const CAIRN_PEBBLE_SHAPES = 5;

function cairn(context: MonumentContext, form: PieceForm<typeof PlantSpecies.Cairn>): void {
  const { level, random } = context;

  const rings = form === "tall" ? TALL_CAIRN : LOW_CAIRN;
  const pebbles = Array.from({ length: CAIRN_PEBBLE_SHAPES }, () => cairnStone(context, CAIRN_PEBBLE, false));

  for (const ring of rings) {
    const isPeak = ring.radius === 0;

    if (!isPeak) {
      addPiece(
        context,
        cairnStone(context, ring.radius * 0.85 + 0.15, true),
        { position: [0, ring.y + 0.04, 0], rotation: [0, random.next() * FULL_TURN, 0], scale: [1, 0.8, 1] },
        CAIRN_STONE
      );
    }

    const stones = level === "low" ? Math.ceil(ring.stones / 2) : ring.stones;

    for (let stone = 0; stone < stones; stone += 1) {
      const angle = (stone / stones) * FULL_TURN + random.signed() * 0.2;
      const size = (isPeak ? 0.34 : random.between(0.3, 0.4)) / CAIRN_PEBBLE;

      addPiece(
        context,
        pebbles[stone % CAIRN_PEBBLE_SHAPES],
        {
          position: [Math.cos(angle) * ring.radius, ring.y, Math.sin(angle) * ring.radius],
          rotation: [random.signed() * 0.25, random.next() * FULL_TURN, random.signed() * 0.25],
          scale: [size, 0.72 * size, 0.95 * size],
        },
        CAIRN_STONE
      );
    }
  }
}

function buildPiece(species: MonumentPiece, context: MonumentContext, variant: number): void {
  switch (species) {
    case PlantSpecies.Arch:
      arch(context, PIECE_FORMS[species][variant % PIECE_FORMS[species].length]);
      break;
    case PlantSpecies.Cairn:
      cairn(context, PIECE_FORMS[species][variant % PIECE_FORMS[species].length]);
      break;
    case PlantSpecies.Dolmen:
      dolmen(context, PIECE_FORMS[species][variant % PIECE_FORMS[species].length]);
      break;
    case PlantSpecies.Idol:
      idol(context, PIECE_FORMS[species][variant % PIECE_FORMS[species].length]);
      break;
    case PlantSpecies.Menhir:
      menhir(context, PIECE_FORMS[species][variant % PIECE_FORMS[species].length]);
      break;
    case PlantSpecies.Pillar:
      pillar(context, PIECE_FORMS[species][variant % PIECE_FORMS[species].length]);
      break;
    default:
      throw new RangeError(`No monument piece ${String(species)}`);
  }
}

const MONUMENT_SPECIES: ReadonlySet<number> = new Set(Object.keys(MONUMENT_HEIGHTS).map(Number));

export function isMonumentModel(species: PlantSpeciesIndex): species is MonumentPiece {
  return MONUMENT_SPECIES.has(species);
}

export function meshMonument(species: MonumentPiece, seed: number, variant: number, level: PlantDetailLevel): MeshData {
  const builder = new MeshBuilder();

  buildPiece(species, { builder, height: MONUMENT_HEIGHTS[species], level, random: createRandom(seed) }, variant);

  return builder.build();
}

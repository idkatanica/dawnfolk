import {
  attribute,
  color,
  equal,
  Fn,
  float,
  fract,
  int,
  mix,
  mx_noise_float,
  normalLocal,
  positionLocal,
  positionWorld,
  select,
  smoothstep,
  time,
  varying,
  vec3,
} from "three/tsl";
import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  Group,
  type InstancedBufferGeometry,
  MeshStandardNodeMaterial,
  type Node,
  Sphere,
  Vector3,
} from "three/webgpu";
import { type BuildingKind, isEnclosure, isLitCampfire } from "../../content/buildings.ts";
import { DEPOSIT_KINDS, MINED_DEPOSIT_KINDS } from "../../content/deposits.ts";
import { eraDefinition } from "../../content/eras.ts";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { MaterialSlot, SLOT_COLOR_TABLE } from "../../models/materials.ts";
import type { MeshData } from "../../models/mesh/mesh-data.ts";
import { buildBuildingModel, SINGLE_MODEL_KINDS } from "../../models/structures/building-models.ts";
import {
  buildEnclosurePiece,
  ENCLOSURE_FOOTING_DEPTH,
  ENCLOSURE_SEGMENT_LENGTH,
  type EnclosureKind,
  type EnclosurePiece,
} from "../../models/structures/enclosures.ts";
import { buildMineModel, MINE_SCALE, type MineOre } from "../../models/structures/mine-model.ts";
import { GLOW_PART } from "../../models/structures/structure-parts.ts";
import { clamp, FULL_TURN, saturate } from "../../shared/math.ts";
import type { BuildingView as BuildingSnapshot, SimulationFrame } from "../../simulation/frame.ts";
import type { WorldGrid } from "../../world/world-grid.ts";
import { geometryFromMeshData, InstanceBatch, toInstancedGeometry } from "../instancing.ts";
import { rotateAroundUp, slotColorTable } from "../node-helpers.ts";
import { coarseGroundOffsetNode } from "../terrain/height-sampling.ts";
import type { TerrainTextures } from "../terrain/terrain-textures.ts";
import type { TribeLooks } from "../tribe-looks.ts";
import type { ViewInput } from "../view-input.ts";

const LEVEL_DISTANCES = { high: 320, low: 3200 } as const;
const PIECE_RADIUS = 9;
const CHARCOAL = vec3(0.04, 0.035, 0.03);
const WORKPLACE_GLOW = 0.55;
const SMALLEST_RING = 10;
const PLASTERED_STYLE = eraDefinition("copperAge").index;
const TILED_STYLE = eraDefinition("ironAge").index;
const STONE_FOOTING_STYLE = eraDefinition("neolithic").index;
const EARTH = vec3(0.3, 0.23, 0.16);
const ROUND_KINDS: ReadonlySet<BuildingKind> = new Set(["hut", "kiln", "smelter", "tent"]);
const GLOWING_KINDS: ReadonlySet<BuildingKind> = new Set(["forge", "kiln", "smelter"]);
const ENCLOSURE_KINDS: readonly EnclosureKind[] = ["palisade", "stoneWall"];
const ENCLOSURE_PIECES: readonly EnclosurePiece[] = ["segment", "gate"];
const BUILDING_CHANNELS = ["buildOrder", "part", "shade", "slot"] as const;

const BUILDING_FIELDS = [
  { name: "buildingPlacement", size: 4 },
  { name: "buildingLook", size: 4 },
  { name: "buildingState", size: 4 },
] as const;

const PLINTH_FIELDS = [
  { name: "plinthPlacement", size: 4 },
  { name: "plinthBox", size: 4 },
  { name: "plinthLook", size: 4 },
] as const;

const GROUND_BAND = 0.3;
const PLINTH_INSET = 0.1;
const PLINTH_TOP = -0.03;
const PLINTH_FOOTING = 0.6;
const TALLEST_PLINTH = 3;
const SINKING_ALLOWANCE = 0.6;
const ROUND_PLINTH_SIDES = 14;
const STONE_COURSE = 0.42;
const CENTER_PROBE: readonly GroundProbe[] = [[0, 0]];
const MINE_GROUND_PROBES: readonly GroundProbe[] = [
  [0, 0],
  [0, 1],
  [0, 2],
  [-1.75, 1.35],
  [1.95, 1],
  [-1.1, 0.4],
  [1.1, 0.4],
].map(([x, z]): GroundProbe => [x * MINE_SCALE, z * MINE_SCALE]);

type GroundProbe = readonly [number, number];

interface GroundBox {
  readonly centerX: number;
  readonly centerZ: number;
  readonly isRound: boolean;
  readonly length: number;
  readonly width: number;
}

interface Footing {
  readonly lift: number;
  readonly plinth: GroundBox | null;
  readonly probes: readonly GroundProbe[];
  readonly sinking: number;
}

const MINE_FOOTING: Footing = { lift: 0, plinth: null, probes: MINE_GROUND_PROBES, sinking: 0 };
const CAMPFIRE_FOOTING: Footing = { lift: 0, plinth: null, probes: CENTER_PROBE, sinking: 0 };
const ENCLOSURE_FOOTING: Footing = {
  lift: ENCLOSURE_FOOTING_DEPTH,
  plinth: null,
  probes: [
    [-ENCLOSURE_SEGMENT_LENGTH / 2, 0],
    [0, 0],
    [ENCLOSURE_SEGMENT_LENGTH / 2, 0],
  ],
  sinking: 0,
};

type ModelKey = string;

interface PiecePlacement {
  readonly key: ModelKey;
  readonly progress: number;
  readonly rotation: number;
  readonly x: number;
  readonly z: number;
}

interface PlacedPiece {
  readonly batches: readonly InstanceBatch[];
  readonly building: BuildingSnapshot;
  readonly plinth: GroundBox | null;
  readonly progress: number;
  readonly rotation: number;
  readonly seat: Seat;
  readonly x: number;
  readonly z: number;
}

interface ModelSource {
  readonly footing: (high: MeshData) => Footing;
  readonly key: ModelKey;
  readonly mesh: (level: "high" | "low") => MeshData;
}

function groundBoxOf(mesh: MeshData, isRound: boolean): GroundBox {
  const { positions } = mesh;

  let minimumX = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  let minimumZ = Number.POSITIVE_INFINITY;
  let maximumZ = Number.NEGATIVE_INFINITY;

  for (let offset = 0; offset < positions.length; offset += 3) {
    if (positions[offset + 1] < GROUND_BAND) {
      minimumX = Math.min(minimumX, positions[offset]);
      maximumX = Math.max(maximumX, positions[offset]);
      minimumZ = Math.min(minimumZ, positions[offset + 2]);
      maximumZ = Math.max(maximumZ, positions[offset + 2]);
    }
  }

  return {
    centerX: (minimumX + maximumX) / 2,
    centerZ: (minimumZ + maximumZ) / 2,
    isRound,
    length: Math.max(0, maximumZ - minimumZ - PLINTH_INSET * 2),
    width: Math.max(0, maximumX - minimumX - PLINTH_INSET * 2),
  };
}

function plinthFooting(high: MeshData, isRound: boolean): Footing {
  const box = groundBoxOf(high, isRound);

  const probes: GroundProbe[] = [];

  for (const sideX of [-0.5, 0, 0.5]) {
    for (const sideZ of [-0.5, 0, 0.5]) {
      probes.push([box.centerX + sideX * box.width, box.centerZ + sideZ * box.length]);
    }
  }

  return { lift: TALLEST_PLINTH, plinth: box, probes, sinking: SINKING_ALLOWANCE };
}

interface Seat {
  readonly floor: number;
  readonly lowest: number;
}

function seatOf(mirror: WorldMirror, piece: PiecePlacement, footing: Footing): Seat {
  const cosine = Math.cos(piece.rotation);
  const sine = Math.sin(piece.rotation);

  const heights = footing.probes.map(([localX, localZ]) =>
    mirror.heightAt(piece.x + localX * cosine + localZ * sine, piece.z + localZ * cosine - localX * sine)
  );

  const lowest = Math.min(...heights);
  const highest = Math.max(...heights);

  return { floor: Math.max(lowest, Math.min(highest - footing.sinking, lowest + footing.lift)), lowest };
}

function placedOnGround(
  local: Node<"vec3">,
  placement: Node<"vec4">,
  textures: TerrainTextures,
  grid: WorldGrid
): Node<"vec3"> {
  const ground = vec3(0, coarseGroundOffsetNode(textures, grid, placement.xz), 0);

  return Fn(() => {
    normalLocal.assign(rotateAroundUp(normalLocal, placement.w));

    return rotateAroundUp(local, placement.w).add(placement.xyz).add(ground);
  })();
}

function createBuildingMaterial(textures: TerrainTextures, grid: WorldGrid): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();
  const placement = attribute("buildingPlacement", "vec4");
  const look = attribute("buildingLook", "vec4");
  const state = attribute("buildingState", "vec4");
  const buildOrder = attribute("buildOrder", "float");
  const slot = int(attribute("slot", "float").add(0.5));
  const shade = attribute("shade", "float");
  const part = int(attribute("part", "float").add(0.5));

  const progress = look.x;

  const isBuilt = buildOrder.lessThanEqual(progress.add(0.001));

  const local = positionLocal.mul(select(isBuilt, float(1), float(0)));

  material.positionNode = placedOnGround(local, placement, textures, grid);

  const slotColors = slotColorTable();
  const accent = look.yzw;
  const damage = state.x;
  const style = state.z;

  const base = select(equal(slot, int(MaterialSlot.Accent)), accent, slotColors.element(slot));

  const isPlastered = equal(slot, int(MaterialSlot.Daub)).and(style.greaterThanEqual(PLASTERED_STYLE - 0.5));
  const isTiled = equal(slot, int(MaterialSlot.Thatch)).and(style.greaterThanEqual(TILED_STYLE - 0.5));

  const plastered = select(isPlastered, mix(base, slotColors.element(int(MaterialSlot.Plaster)), 0.7), base);
  const styled = select(isTiled, slotColors.element(int(MaterialSlot.Tile)), plastered);

  material.colorNode = varying(mix(styled.mul(shade), CHARCOAL, damage.mul(0.85)), "buildingColor");

  const isGlow = equal(part, int(GLOW_PART));
  const flicker = mx_noise_float(vec3(placement.x, time.mul(4), placement.z))
    .mul(0.4)
    .add(0.8);

  const glow = select(isGlow, state.y.mul(flicker).mul(5), float(0));

  material.emissiveNode = vec3(1, 0.42, 0.12).mul(glow);
  material.roughnessNode = float(0.86);

  return material;
}

function createPlinthMaterial(textures: TerrainTextures, grid: WorldGrid): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();
  const placement = attribute("plinthPlacement", "vec4");
  const box = attribute("plinthBox", "vec4");
  const look = attribute("plinthLook", "vec4");

  const depth = look.x;
  const damage = look.y;
  const style = look.z;

  const local = vec3(
    positionLocal.x.mul(box.z).add(box.x),
    positionLocal.y.mul(depth),
    positionLocal.z.mul(box.w).add(box.y)
  );

  material.positionNode = placedOnGround(local, placement, textures, grid);

  const grain = mx_noise_float(positionWorld.mul(1.3)).mul(0.22).add(0.86);
  const mortar = smoothstep(0, 0.1, fract(positionWorld.y.div(STONE_COURSE)))
    .mul(0.45)
    .add(0.55);
  const stone = color(SLOT_COLOR_TABLE[MaterialSlot.Stone]).mul(mortar);
  const footing = select(style.greaterThanEqual(STONE_FOOTING_STYLE - 0.5), stone, EARTH);

  material.colorNode = mix(footing.mul(grain), CHARCOAL, damage.mul(0.6));
  material.roughnessNode = float(0.92);

  return material;
}

function createBatch(
  geometry: InstancedBufferGeometry,
  material: MeshStandardNodeMaterial,
  fields: typeof BUILDING_FIELDS | typeof PLINTH_FIELDS
): InstanceBatch {
  const batch = new InstanceBatch(geometry, material, fields, 16);

  batch.mesh.castShadow = true;
  batch.mesh.receiveShadow = true;

  return batch;
}

function createPlinthBatch(shape: BufferGeometry, material: MeshStandardNodeMaterial): InstanceBatch {
  return createBatch(toInstancedGeometry(shape.translate(0, -0.5, 0)), material, PLINTH_FIELDS);
}

function mineKey(ore: MineOre): ModelKey {
  return `mine:${ore}`;
}

function enclosureKey(kind: EnclosureKind, piece: EnclosurePiece): ModelKey {
  return `${kind}:${piece}`;
}

function modelSources(): ModelSource[] {
  const sources: ModelSource[] = [];

  for (const kind of SINGLE_MODEL_KINDS) {
    sources.push({
      footing: (high) => (kind === "campfire" ? CAMPFIRE_FOOTING : plinthFooting(high, ROUND_KINDS.has(kind))),
      key: kind,
      mesh: (level) => buildBuildingModel(kind, level),
    });
  }

  for (const ore of MINED_DEPOSIT_KINDS) {
    sources.push({ footing: () => MINE_FOOTING, key: mineKey(ore), mesh: (level) => buildMineModel(ore, level) });
  }

  for (const kind of ENCLOSURE_KINDS) {
    for (const piece of ENCLOSURE_PIECES) {
      sources.push({
        footing: () => ENCLOSURE_FOOTING,
        key: enclosureKey(kind, piece),
        mesh: (level) => buildEnclosurePiece(kind, piece, level),
      });
    }
  }

  return sources;
}

function oreOfVariant(variant: number): MineOre {
  const deposit = DEPOSIT_KINDS[variant - 1];

  if (deposit === "tin" || deposit === "iron") {
    return deposit;
  }

  return "copper";
}

function enclosureKindOf(kind: BuildingKind): EnclosureKind {
  return kind === "stoneWall" ? "stoneWall" : "palisade";
}

export class BuildingView {
  readonly group = new Group();
  readonly #all: readonly InstanceBatch[];
  readonly #batches = new Map<ModelKey, readonly InstanceBatch[]>();
  readonly #bounds = new Sphere(new Vector3(), PIECE_RADIUS);
  readonly #footings = new Map<ModelKey, Footing>();
  readonly #plinths: readonly InstanceBatch[];
  readonly #tribes: TribeLooks;
  #laidOutFrame: SimulationFrame | null = null;
  #pieces: PlacedPiece[] = [];

  constructor(tribes: TribeLooks, textures: TerrainTextures, grid: WorldGrid) {
    this.#tribes = tribes;

    const material = createBuildingMaterial(textures, grid);

    for (const source of modelSources()) {
      const high = source.mesh("high");

      this.#batches.set(
        source.key,
        [high, source.mesh("low")].map((meshData) =>
          createBatch(geometryFromMeshData(meshData, BUILDING_CHANNELS), material, BUILDING_FIELDS)
        )
      );
      this.#footings.set(source.key, source.footing(high));
    }

    const plinthMaterial = createPlinthMaterial(textures, grid);

    this.#plinths = [
      createPlinthBatch(new BoxGeometry(1, 1, 1), plinthMaterial),
      createPlinthBatch(new CylinderGeometry(0.5, 0.5, 1, ROUND_PLINTH_SIDES), plinthMaterial),
    ];

    this.#all = [...[...this.#batches.values()].flat(), ...this.#plinths];
    this.group.add(...this.#all.map((batch) => batch.mesh));
  }

  update(input: ViewInput): void {
    this.#layOut(input.mirror);

    for (const batch of this.#all) {
      batch.begin();
    }

    for (const piece of this.#pieces) {
      this.#place(input, piece);
    }

    for (const batch of this.#all) {
      batch.commit();
    }
  }

  dispose(): void {
    for (const batch of this.#all) {
      batch.dispose();
    }
  }

  #layOut(mirror: WorldMirror): void {
    const { frame } = mirror;

    if (frame === this.#laidOutFrame) {
      return;
    }

    this.#laidOutFrame = frame;
    this.#pieces = [];

    for (const building of frame.buildings) {
      for (const piece of this.#piecesOf(building, mirror)) {
        this.#addPiece(mirror, building, piece);
      }
    }
  }

  #addPiece(mirror: WorldMirror, building: BuildingSnapshot, piece: PiecePlacement): void {
    const batches = this.#batches.get(piece.key);
    const footing = this.#footings.get(piece.key);

    if (batches === undefined || footing === undefined) {
      return;
    }

    this.#pieces.push({
      batches,
      building,
      plinth: footing.plinth,
      progress: piece.progress,
      rotation: piece.rotation,
      seat: seatOf(mirror, piece, footing),
      x: piece.x,
      z: piece.z,
    });
  }

  #piecesOf(building: BuildingSnapshot, mirror: WorldMirror): PiecePlacement[] {
    if (isEnclosure(building.kind)) {
      return this.#ringOf(building, mirror);
    }

    const key = building.kind === "mine" ? mineKey(oreOfVariant(building.variant)) : building.kind;

    return [{ key, progress: building.progress, rotation: building.rotation, x: building.x, z: building.z }];
  }

  #ringOf(building: BuildingSnapshot, mirror: WorldMirror): PiecePlacement[] {
    const kind = enclosureKindOf(building.kind);
    const length = ENCLOSURE_SEGMENT_LENGTH;

    const count = Math.max(SMALLEST_RING, Math.round((FULL_TURN * building.extent) / length));
    const radius = length / (2 * Math.tan(Math.PI / count));
    const halfStep = Math.PI / count;

    const pieces: PiecePlacement[] = [];

    for (let index = 0; index < count; index += 1) {
      const angle = building.rotation + (index / count) * FULL_TURN;

      const ends = [angle - halfStep, angle, angle + halfStep].map((end) => ({
        x: building.x + Math.cos(end) * radius,
        z: building.z + Math.sin(end) * radius,
      }));

      if (ends.some((end) => mirror.isWaterAt(end.x, end.z))) {
        continue;
      }

      pieces.push({
        key: enclosureKey(kind, index === 0 ? "gate" : "segment"),
        progress: saturate(building.progress * count - index),
        rotation: -angle - Math.PI / 2,
        x: building.x + Math.cos(angle) * radius,
        z: building.z + Math.sin(angle) * radius,
      });
    }

    return pieces;
  }

  #place(input: ViewInput, piece: PlacedPiece): void {
    const { building, seat } = piece;

    const y = seat.floor;

    this.#bounds.center.set(piece.x, y + 2, piece.z);

    const distance = input.camera.position.distanceTo(this.#bounds.center);

    if (distance > LEVEL_DISTANCES.low * input.detail || !input.frustum.intersectsSphere(this.#bounds)) {
      return;
    }

    const level = distance < LEVEL_DISTANCES.high * input.detail ? 0 : 1;
    const accent = this.#tribes.accent(building.tribeId);

    piece.batches[level].add(
      [piece.x, y, piece.z, piece.rotation],
      [piece.progress, accent.r, accent.g, accent.b],
      [saturate(1 - building.health), this.#glowOf(building), building.style, 0]
    );

    if (piece.plinth !== null) {
      this.#placePlinth(piece, piece.plinth);
    }
  }

  #placePlinth(piece: PlacedPiece, box: GroundBox): void {
    const { building, seat } = piece;
    const [boxes, rounds] = this.#plinths;

    const plinths = box.isRound ? rounds : boxes;
    const depth = seat.floor - seat.lowest + PLINTH_FOOTING;

    plinths.add(
      [piece.x, seat.floor + PLINTH_TOP, piece.z, piece.rotation],
      [box.centerX, box.centerZ, box.width, box.length],
      [depth, saturate(1 - building.health), building.style, 0]
    );
  }

  #glowOf(building: BuildingSnapshot): number {
    if (GLOWING_KINDS.has(building.kind)) {
      return building.progress >= 1 ? WORKPLACE_GLOW : 0;
    }

    if (!isLitCampfire(building)) {
      return 0;
    }

    return clamp(building.fuel * 1.5, 0.35, 1);
  }
}

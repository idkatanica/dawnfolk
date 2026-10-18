import {
  attribute,
  equal,
  Fn,
  float,
  int,
  mix,
  mx_noise_float,
  normalLocal,
  positionLocal,
  select,
  time,
  varying,
  vec3,
} from "three/tsl";
import {
  Color,
  Group,
  type InstancedBufferGeometry,
  Mesh,
  MeshStandardNodeMaterial,
  Sphere,
  Vector3,
} from "three/webgpu";
import { BUILDING_KINDS, type BuildingKind, isEnclosure } from "../../content/buildings.ts";
import { DEPOSIT_KINDS } from "../../content/deposits.ts";
import { eraDefinition } from "../../content/eras.ts";
import { MaterialSlot, SLOT_COLOR_TABLE } from "../../models/materials.ts";
import type { MeshData } from "../../models/mesh/mesh-data.ts";
import { buildBuildingModel, GLOW_PART } from "../../models/structures/building-models.ts";
import { buildEnclosurePieces, type EnclosureKind } from "../../models/structures/enclosures.ts";
import { buildMineModel, type MineOre } from "../../models/structures/mine-model.ts";
import { parseHexColor } from "../../shared/color.ts";
import { clamp, FULL_TURN, saturate } from "../../shared/math.ts";
import type { BuildingView as BuildingSnapshot, TribeSummary } from "../../simulation/frame.ts";
import type { AgentViewInput } from "../agents/agent-view-input.ts";
import { geometryFromMeshData, InterleavedInstances } from "../instancing.ts";
import { rotateAroundUp, slotColorTable } from "../node-helpers.ts";
import { isLitCampfire } from "./lit-campfire.ts";

const LEVEL_DISTANCES = { high: 320, low: 3200 } as const;
const PIECE_RADIUS = 9;
const CHARCOAL = vec3(0.04, 0.035, 0.03);
const NEUTRAL_ACCENT = new Color(0xc4_55_3a);
const WORKPLACE_GLOW = 0.55;
const SMALLEST_RING = 10;
const PLASTERED_STYLE = eraDefinition("copperAge").index;
const TILED_STYLE = eraDefinition("ironAge").index;
const GLOWING_KINDS: ReadonlySet<BuildingKind> = new Set(["forge", "kiln", "smelter"]);
const MINE_ORES: readonly MineOre[] = ["copper", "tin", "iron"];
const ENCLOSURE_KINDS: readonly EnclosureKind[] = ["palisade", "stoneWall"];
const BUILDINGS_WITH_ONE_MODEL: readonly BuildingKind[] = BUILDING_KINDS.filter(
  (kind) => kind !== "mine" && !isEnclosure(kind)
);

const BUILDING_FIELDS = [
  { name: "buildingPlacement", size: 4 },
  { name: "buildingLook", size: 4 },
  { name: "buildingState", size: 4 },
] as const;

const FLOATS_PER_BUILDING = 12;

type ModelKey = string;

interface BuildingBatch {
  count: number;
  readonly geometry: InstancedBufferGeometry;
  readonly instances: InterleavedInstances;
  readonly mesh: Mesh;
}

interface PiecePlacement {
  readonly key: ModelKey;
  readonly progress: number;
  readonly rotation: number;
  readonly x: number;
  readonly z: number;
}

interface ModelSource {
  readonly key: ModelKey;
  readonly mesh: (level: "high" | "low") => MeshData;
}

function slotColor(slot: number): Vector3 {
  const color = new Color(SLOT_COLOR_TABLE[slot]);

  return new Vector3(color.r, color.g, color.b);
}

function vectorNode(vector: Vector3) {
  return vec3(vector.x, vector.y, vector.z);
}

function createBuildingMaterial(): MeshStandardNodeMaterial {
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

  material.positionNode = Fn(() => {
    normalLocal.assign(rotateAroundUp(normalLocal, placement.w));

    return rotateAroundUp(local, placement.w).add(placement.xyz);
  })();

  const slotColors = slotColorTable();
  const accent = look.yzw;
  const damage = state.x;
  const style = state.z;

  const base = select(equal(slot, int(MaterialSlot.Accent)), accent, slotColors.element(slot));

  const isPlastered = equal(slot, int(MaterialSlot.Daub)).and(style.greaterThanEqual(PLASTERED_STYLE - 0.5));
  const isTiled = equal(slot, int(MaterialSlot.Thatch)).and(style.greaterThanEqual(TILED_STYLE - 0.5));

  const plastered = select(isPlastered, mix(base, vectorNode(slotColor(MaterialSlot.Plaster)), 0.7), base);
  const styled = select(isTiled, vectorNode(slotColor(MaterialSlot.Tile)), plastered);

  material.colorNode = varying(mix(styled.mul(shade), CHARCOAL, damage.mul(0.85)), "buildingColor");

  const isGlow = equal(part, int(GLOW_PART));
  const flicker = mx_noise_float(vec3(placement.x, time.mul(4), placement.z))
    .mul(0.4)
    .add(0.8);

  const glow = select(isGlow, state.y.mul(flicker).mul(5), float(0));

  material.emissiveNode = vec3(1, 0.42, 0.12).mul(glow);
  material.roughnessNode = float(0.86);
  material.metalnessNode = float(0);

  return material;
}

function mineKey(ore: MineOre): ModelKey {
  return `mine:${ore}`;
}

function enclosureKey(kind: EnclosureKind, piece: "gate" | "segment"): ModelKey {
  return `${kind}:${piece}`;
}

function modelSources(): ModelSource[] {
  const sources: ModelSource[] = [];

  for (const kind of BUILDINGS_WITH_ONE_MODEL) {
    sources.push({ key: kind, mesh: (level) => buildBuildingModel(kind, level) });
  }

  for (const ore of MINE_ORES) {
    sources.push({ key: mineKey(ore), mesh: (level) => buildMineModel(ore, level) });
  }

  for (const kind of ENCLOSURE_KINDS) {
    sources.push({ key: enclosureKey(kind, "segment"), mesh: (level) => buildEnclosurePieces(kind, level).segment });
    sources.push({ key: enclosureKey(kind, "gate"), mesh: (level) => buildEnclosurePieces(kind, level).gate });
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
  readonly #batches = new Map<ModelKey, readonly BuildingBatch[]>();
  readonly #bounds = new Sphere(new Vector3(), PIECE_RADIUS);
  readonly #segmentLength: number;
  readonly #tribeAccents = new Map<number, Color>();

  constructor() {
    const material = createBuildingMaterial();

    for (const source of modelSources()) {
      this.#batches.set(source.key, this.#createBatches(source, material));
    }

    this.#segmentLength = buildEnclosurePieces("palisade", "low").segmentLength;
  }

  update(input: AgentViewInput): void {
    const { frame } = input.mirror;

    this.#rememberTribes(frame.tribes);

    for (const batches of this.#batches.values()) {
      for (const batch of batches) {
        batch.count = 0;
      }
    }

    for (const building of frame.buildings) {
      for (const piece of this.#piecesOf(building)) {
        this.#place(input, building, piece);
      }
    }

    for (const batches of this.#batches.values()) {
      for (const batch of batches) {
        batch.geometry.instanceCount = batch.count;
        batch.mesh.visible = batch.count > 0;

        if (batch.count > 0) {
          batch.instances.markUpdated(batch.count);
        }
      }
    }
  }

  dispose(): void {
    for (const batches of this.#batches.values()) {
      for (const batch of batches) {
        batch.geometry.dispose();
      }
    }
  }

  #createBatches(source: ModelSource, material: MeshStandardNodeMaterial): BuildingBatch[] {
    return (["high", "low"] as const).map((level) => {
      const geometry = geometryFromMeshData(source.mesh(level), ["buildOrder", "part", "shade", "slot"]);

      const instances = new InterleavedInstances(geometry, BUILDING_FIELDS, 16);
      const mesh = new Mesh(geometry, material);

      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.visible = false;
      this.group.add(mesh);

      return { count: 0, geometry, instances, mesh };
    });
  }

  #piecesOf(building: BuildingSnapshot): PiecePlacement[] {
    if (isEnclosure(building.kind)) {
      return this.#ringOf(building);
    }

    const key = building.kind === "mine" ? mineKey(oreOfVariant(building.variant)) : building.kind;

    return [{ key, progress: building.progress, rotation: building.rotation, x: building.x, z: building.z }];
  }

  #ringOf(building: BuildingSnapshot): PiecePlacement[] {
    const kind = enclosureKindOf(building.kind);
    const length = this.#segmentLength;

    const count = Math.max(SMALLEST_RING, Math.round((FULL_TURN * building.extent) / length));
    const radius = length / (2 * Math.tan(Math.PI / count));

    return Array.from({ length: count }, (_, index) => {
      const angle = building.rotation + (index / count) * FULL_TURN;

      return {
        key: enclosureKey(kind, index === 0 ? "gate" : "segment"),
        progress: saturate(building.progress * count - index),
        rotation: -angle - Math.PI / 2,
        x: building.x + Math.cos(angle) * radius,
        z: building.z + Math.sin(angle) * radius,
      };
    });
  }

  #place(input: AgentViewInput, building: BuildingSnapshot, piece: PiecePlacement): void {
    const y = input.mirror.heightAt(piece.x, piece.z);

    this.#bounds.center.set(piece.x, y + 2, piece.z);

    const distance = input.camera.position.distanceTo(this.#bounds.center);

    if (distance > LEVEL_DISTANCES.low * input.detail || !input.frustum.intersectsSphere(this.#bounds)) {
      return;
    }

    const batches = this.#batches.get(piece.key);

    if (batches === undefined) {
      return;
    }

    const level = distance < LEVEL_DISTANCES.high * input.detail ? 0 : 1;
    const accent = this.#accentOf(building.tribeId);

    const batch = batches[level];

    batch.instances.ensureCapacity(batch.count + 1);

    const data = batch.instances.array;
    const offset = batch.count * FLOATS_PER_BUILDING;

    data.set([piece.x, y, piece.z, piece.rotation], offset);
    data.set([piece.progress, accent.r, accent.g, accent.b], offset + 4);
    data.set([saturate(1 - building.health), this.#glowOf(building), building.style, 0], offset + 8);
    batch.count += 1;
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

  #accentOf(tribeId: number): Color {
    const accent = this.#tribeAccents.get(tribeId);

    if (accent === undefined) {
      return NEUTRAL_ACCENT;
    }

    return accent;
  }

  #rememberTribes(tribes: readonly TribeSummary[]): void {
    for (const tribe of tribes) {
      if (!this.#tribeAccents.has(tribe.id)) {
        this.#tribeAccents.set(tribe.id, new Color(parseHexColor(tribe.color)));
      }
    }
  }
}

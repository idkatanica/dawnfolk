import {
  attribute,
  cos,
  equal,
  Fn,
  float,
  int,
  mix,
  mx_noise_float,
  normalLocal,
  positionLocal,
  select,
  sin,
  time,
  uniformArray,
  varying,
  vec3,
} from "three/tsl";
import { Color, Group, Mesh, MeshStandardNodeMaterial, type Node, Sphere, Vector3 } from "three/webgpu";
import { BUILDING_KINDS, BUILDINGS, type BuildingKind } from "../../content/buildings.ts";
import { MaterialSlot, SLOT_COLOR_TABLE } from "../../models/materials.ts";
import { buildBuildingModel, GLOW_PART } from "../../models/structures/building-models.ts";
import { parseHexColor } from "../../shared/color.ts";
import { clamp } from "../../shared/math.ts";
import type { BuildingView as BuildingSnapshot, TribeSummary } from "../../simulation/frame.ts";
import type { AgentViewInput } from "../agents/agent-view-input.ts";
import { geometryFromMeshData, InterleavedInstances } from "../instancing.ts";

const LEVEL_DISTANCES = { high: 320, low: 3200 } as const;
const BOUNDING_RADIUS = 6;
const CHARCOAL = vec3(0.04, 0.035, 0.03);
const NEUTRAL_ACCENT = new Color(0xc4_55_3a);
const LIT_FUEL = 0.02;

const BUILDING_FIELDS = [
  { name: "buildingPlacement", size: 4 },
  { name: "buildingLook", size: 4 },
  { name: "buildingState", size: 4 },
] as const;

const FLOATS_PER_BUILDING = 12;

interface BuildingBatch {
  count: number;
  readonly geometry: ReturnType<typeof geometryFromMeshData>;
  readonly instances: InterleavedInstances;
  readonly mesh: Mesh;
}

function linearColorVector(hex: number): Vector3 {
  const color = new Color(hex);

  return new Vector3(color.r, color.g, color.b);
}

function rotateAroundUp(vector: Node<"vec3">, angle: Node<"float">): Node<"vec3"> {
  const cosine = cos(angle);
  const sine = sin(angle);

  return vec3(vector.x.mul(cosine).add(vector.z.mul(sine)), vector.y, vector.z.mul(cosine).sub(vector.x.mul(sine)));
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

  const slotColors = uniformArray<"vec3">(SLOT_COLOR_TABLE.map(linearColorVector), "vec3");
  const accent = look.yzw;
  const damage = state.x;

  const base = select(equal(slot, int(MaterialSlot.Accent)), accent, slotColors.element(slot));

  material.colorNode = varying(mix(base.mul(shade), CHARCOAL, damage.mul(0.85)), "buildingColor");

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

export class BuildingView {
  readonly group = new Group();
  readonly #batches: Readonly<Record<BuildingKind, readonly BuildingBatch[]>>;
  readonly #bounds = new Sphere(new Vector3(), BOUNDING_RADIUS);
  readonly #tribeAccents = new Map<number, Color>();

  constructor() {
    const material = createBuildingMaterial();

    this.#batches = {
      campfire: this.#createBatches("campfire", material),
      hut: this.#createBatches("hut", material),
      storehouse: this.#createBatches("storehouse", material),
      tent: this.#createBatches("tent", material),
      totem: this.#createBatches("totem", material),
    };
  }

  update(input: AgentViewInput): void {
    const { frame } = input.mirror;

    this.#rememberTribes(frame.tribes);

    for (const kind of BUILDING_KINDS) {
      for (const batch of this.#batches[kind]) {
        batch.count = 0;
      }
    }

    for (const building of frame.buildings) {
      this.#place(input, building);
    }

    for (const kind of BUILDING_KINDS) {
      for (const batch of this.#batches[kind]) {
        batch.geometry.instanceCount = batch.count;
        batch.mesh.visible = batch.count > 0;
        batch.instances.markUpdated(batch.count);
      }
    }
  }

  dispose(): void {
    for (const kind of BUILDING_KINDS) {
      for (const batch of this.#batches[kind]) {
        batch.geometry.dispose();
      }
    }
  }

  #createBatches(kind: BuildingKind, material: MeshStandardNodeMaterial): BuildingBatch[] {
    return (["high", "low"] as const).map((level) => {
      const geometry = geometryFromMeshData(buildBuildingModel(kind, level), ["buildOrder", "part", "shade", "slot"]);

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

  #place(input: AgentViewInput, building: BuildingSnapshot): void {
    const y = input.mirror.heightAt(building.x, building.z);

    this.#bounds.center.set(building.x, y + 2, building.z);

    const distance = input.camera.position.distanceTo(this.#bounds.center);

    if (distance > LEVEL_DISTANCES.low * input.detail || !input.frustum.intersectsSphere(this.#bounds)) {
      return;
    }

    const level = distance < LEVEL_DISTANCES.high * input.detail ? 0 : 1;
    const accent = this.#accentOf(building.tribeId);
    const definition = BUILDINGS[building.kind];

    const batch = this.#batches[building.kind][level];

    batch.instances.ensureCapacity(batch.count + 1);

    const data = batch.instances.array;
    const offset = batch.count * FLOATS_PER_BUILDING;

    data.set([building.x, y, building.z, building.rotation], offset);
    data.set([building.progress, accent.r, accent.g, accent.b], offset + 4);
    data.set([clamp(1 - building.health / definition.health, 0, 1), this.#glowOf(building), 0, 0], offset + 8);
    batch.count += 1;
  }

  #glowOf(building: BuildingSnapshot): number {
    if (building.kind !== "campfire" || building.progress < 1 || building.fuel <= LIT_FUEL) {
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

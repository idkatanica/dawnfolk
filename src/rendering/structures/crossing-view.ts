import {
  attribute,
  clamp,
  cos,
  Fn,
  float,
  int,
  ivec2,
  mix,
  normalize,
  normalLocal,
  normalWorld,
  positionLocal,
  positionWorld,
  sin,
  smoothstep,
  textureLoad,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import {
  type Frustum,
  Group,
  type InstancedBufferGeometry,
  Mesh,
  MeshStandardNodeMaterial,
  type Node,
  type PerspectiveCamera,
  Sphere,
  Vector3,
} from "three/webgpu";
import type { WorldMirror } from "../../game/world-mirror.ts";
import type { MeshData } from "../../models/mesh/mesh-data.ts";
import {
  buildFallenLogs,
  buildSteppingStones,
  CROSSING_DETAIL_LEVELS,
  FALLEN_LOG_LENGTHS,
  FALLEN_LOG_ROOT_RADIUS,
  fallenLogVariant,
  STEPPING_STONE_HEIGHT,
} from "../../models/structures/crossings.ts";
import {
  type Crossing,
  crossingLength,
  type Ford,
  fallenLog,
  type LogBridge,
  STEPPING_STONE_VARIANTS,
  steppingStones,
} from "../../world/crossings.ts";
import { NO_WATER } from "../../world/water.ts";
import { geometryFromMeshData, InterleavedInstances } from "../instancing.ts";
import { rotateAroundUp, slotColorTable } from "../node-helpers.ts";
import type { TerrainTextures } from "../terrain/terrain-textures.ts";

const LEVEL_DISTANCES: readonly number[] = [150, 650, 3600];
const SHADOW_LEVEL_COUNT = 2;
const HIDDEN = -1;
const FLOATS_PER_INSTANCE = 12;
const STONE_WIDTH = 1.05;
const STONE_SINK = 0.3;
const SHORTEST_STONE = 0.14;
const DRY_LEVEL = -10_000;
const WET_STONE = vec3(0.55, 0.58, 0.52);
const RIVERBED = vec3(0.07, 0.17, 0.19);
const MURKIEST = 0.85;
const MURK_DEPTH = 2.2;
const SNOW = vec3(0.86, 0.9, 0.95);

const CROSSING_FIELDS = [
  { name: "crossingPlacement", size: 4 },
  { name: "crossingShape", size: 4 },
  { name: "crossingLook", size: 4 },
] as const;

interface CrossingBatch {
  count: number;
  readonly geometry: InstancedBufferGeometry;
  readonly instances: InterleavedInstances;
  readonly mesh: Mesh;
}

interface PlacedPiece {
  readonly batch: number;
  readonly data: readonly number[];
}

interface PlacedCrossing {
  readonly bounds: Sphere;
  level: number;
  readonly pieces: readonly PlacedPiece[];
}

function pitched(vector: Node<"vec3">, angle: Node<"float">): Node<"vec3"> {
  const cosine = cos(angle);
  const sine = sin(angle);

  return vec3(vector.x.mul(cosine).sub(vector.y.mul(sine)), vector.x.mul(sine).add(vector.y.mul(cosine)), vector.z);
}

function createCrossingMaterial(textures: TerrainTextures, mirror: WorldMirror): MeshStandardNodeMaterial {
  const { grid } = mirror;
  const material = new MeshStandardNodeMaterial();
  const placement = attribute("crossingPlacement", "vec4");
  const shape = attribute("crossingShape", "vec4");
  const look = attribute("crossingLook", "vec4");
  const slot = int(attribute("slot", "float").add(0.5));
  const shade = attribute("shade", "float");

  material.positionNode = Fn(() => {
    normalLocal.assign(normalize(rotateAroundUp(pitched(normalLocal.div(shape.xyz), shape.w), placement.w)));

    return rotateAroundUp(pitched(positionLocal.mul(shape.xyz), shape.w), placement.w).add(placement.xyz);
  })();

  const last = grid.cellsPerSide - 1;
  const cell = clamp(placement.xz.add(grid.halfSize).div(grid.cellSize).floor(), vec2(0, 0), vec2(last, last));

  const snow = varying(smoothstep(0.1, 0.45, textureLoad(textures.surface, ivec2(cell)).r), "crossingSnow");
  const base = varying(slotColorTable().element(slot).mul(shade).mul(look.y), "crossingColor");

  const belowWater = look.x.sub(positionWorld.y);
  const wetness = smoothstep(-0.08, 0.2, belowWater);
  const murk = smoothstep(0, MURK_DEPTH, belowWater).mul(MURKIEST);
  const snowOnTop = snow.mul(smoothstep(0.3, 0.8, normalWorld.y)).mul(float(1).sub(wetness));

  const wet = mix(mix(base, base.mul(WET_STONE), wetness), RIVERBED, murk);

  material.colorNode = mix(wet, SNOW, snowOnTop);
  material.roughnessNode = mix(float(0.88), float(0.55), wetness);
  material.metalnessNode = float(0);

  return material;
}

function yawToward(directionX: number, directionZ: number): number {
  return Math.atan2(-directionZ, directionX);
}

export class CrossingView {
  readonly group = new Group();
  readonly #batches: readonly (readonly CrossingBatch[])[];
  readonly #mirror: WorldMirror;
  #isDirty = true;
  #placed: PlacedCrossing[] = [];

  constructor(mirror: WorldMirror, textures: TerrainTextures) {
    this.#mirror = mirror;

    const material = createCrossingMaterial(textures, mirror);

    this.#batches = CROSSING_DETAIL_LEVELS.map((level, levelIndex) =>
      [...buildSteppingStones(level), ...buildFallenLogs(level)].map((model) =>
        this.#createBatch(model, material, levelIndex)
      )
    );

    this.rebuild();
  }

  rebuild(): void {
    this.#placed = this.#mirror.crossings.map((crossing) => this.#place(crossing));
    this.#isDirty = true;
  }

  update(camera: PerspectiveCamera, frustum: Frustum, detail: number): void {
    const hasNewLevels = this.#assignLevels(camera, frustum, detail);

    if (!(hasNewLevels || this.#isDirty)) {
      return;
    }

    this.#isDirty = false;
    this.#refill();
  }

  dispose(): void {
    for (const level of this.#batches) {
      for (const batch of level) {
        batch.geometry.dispose();
      }
    }
  }

  #assignLevels(camera: PerspectiveCamera, frustum: Frustum, detail: number): boolean {
    let hasChanged = false;

    for (const crossing of this.#placed) {
      const level = this.#levelOf(crossing, camera, frustum, detail);

      if (level !== crossing.level) {
        crossing.level = level;
        hasChanged = true;
      }
    }

    return hasChanged;
  }

  #refill(): void {
    for (const level of this.#batches) {
      for (const batch of level) {
        batch.count = 0;
      }
    }

    for (const crossing of this.#placed) {
      if (crossing.level !== HIDDEN) {
        this.#fill(crossing, this.#batches[crossing.level]);
      }
    }

    for (const level of this.#batches) {
      for (const batch of level) {
        batch.geometry.instanceCount = batch.count;
        batch.mesh.visible = batch.count > 0;

        if (batch.count > 0) {
          batch.instances.markUpdated(batch.count);
        }
      }
    }
  }

  #createBatch(model: MeshData, material: MeshStandardNodeMaterial, levelIndex: number): CrossingBatch {
    const geometry = geometryFromMeshData(model, ["shade", "slot"]);
    const instances = new InterleavedInstances(geometry, CROSSING_FIELDS, 16);
    const mesh = new Mesh(geometry, material);

    mesh.frustumCulled = false;
    mesh.castShadow = levelIndex < SHADOW_LEVEL_COUNT;
    mesh.receiveShadow = true;
    mesh.visible = false;
    this.group.add(mesh);

    return { count: 0, geometry, instances, mesh };
  }

  #levelOf(crossing: PlacedCrossing, camera: PerspectiveCamera, frustum: Frustum, detail: number): number {
    if (crossing.pieces.length === 0 || !frustum.intersectsSphere(crossing.bounds)) {
      return HIDDEN;
    }

    const distance = Math.max(0, camera.position.distanceTo(crossing.bounds.center) - crossing.bounds.radius);

    return LEVEL_DISTANCES.findIndex((limit) => distance < limit * detail);
  }

  #fill(crossing: PlacedCrossing, batches: readonly CrossingBatch[]): void {
    for (const piece of crossing.pieces) {
      const batch = batches[piece.batch];

      batch.instances.ensureCapacity(batch.count + 1);
      batch.instances.array.set(piece.data, batch.count * FLOATS_PER_INSTANCE);
      batch.count += 1;
    }
  }

  #place(crossing: Crossing): PlacedCrossing {
    const pieces = crossing.kind === "ford" ? this.#stonesOf(crossing) : [this.#logOf(crossing)];

    const middleX = (crossing.startX + crossing.endX) / 2;
    const middleZ = (crossing.startZ + crossing.endZ) / 2;

    const bounds = new Sphere(
      new Vector3(middleX, this.#mirror.heightAt(middleX, middleZ), middleZ),
      crossingLength(crossing) / 2 + 4
    );

    return { bounds, level: HIDDEN, pieces };
  }

  #stonesOf(ford: Ford): PlacedPiece[] {
    const mirror = this.#mirror;
    const pieces: PlacedPiece[] = [];

    for (const stone of steppingStones(ford)) {
      const waterLevel = mirror.waterLevelAt(stone.x, stone.z);
      const ground = mirror.heightAt(stone.x, stone.z);

      const top = waterLevel + stone.lift;

      if (waterLevel === NO_WATER || top - ground < SHORTEST_STONE) {
        continue;
      }

      const bottom = ground - STONE_SINK;
      const width = (stone.radius * 2) / STONE_WIDTH;

      pieces.push({
        batch: stone.variant,
        data: [
          stone.x,
          bottom,
          stone.z,
          stone.rotation,
          width,
          (top - bottom) / STEPPING_STONE_HEIGHT,
          width,
          0,
          waterLevel,
          0.9 + 0.2 * ((stone.rotation * 7.3) % 1),
          0,
          0,
        ],
      });
    }

    return pieces;
  }

  #logOf(bridge: LogBridge): PlacedPiece {
    const log = fallenLog(bridge);

    const horizontal = Math.hypot(log.tipX - log.rootX, log.tipZ - log.rootZ);
    const rise = log.tipBottom - log.rootBottom;
    const variant = fallenLogVariant(horizontal, bridge.seed);
    const radius = log.rootRadius / FALLEN_LOG_ROOT_RADIUS;

    return {
      batch: STEPPING_STONE_VARIANTS + variant,
      data: [
        log.rootX,
        log.rootBottom,
        log.rootZ,
        yawToward((log.tipX - log.rootX) / horizontal, (log.tipZ - log.rootZ) / horizontal),
        Math.hypot(horizontal, rise) / FALLEN_LOG_LENGTHS[variant % FALLEN_LOG_LENGTHS.length],
        radius,
        radius,
        Math.atan2(rise, horizontal),
        DRY_LEVEL,
        0.92 + 0.16 * bridge.seed,
        0,
        0,
      ],
    };
  }
}

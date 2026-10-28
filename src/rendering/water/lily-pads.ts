import {
  attribute,
  cameraPosition,
  clamp,
  cos,
  distance,
  Fn,
  float,
  floor,
  ivec2,
  mix,
  positionGeometry,
  select,
  sin,
  smoothstep,
  textureLoad,
  transformNormalToView,
  uniform,
  vec2,
  vec3,
} from "three/tsl";
import {
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshStandardNodeMaterial,
  type Node,
} from "three/webgpu";
import { isPoolGround } from "../../content/grounds.ts";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { FULL_TURN, hashToUnit, lerp, smoothstep as smoothstepNumber } from "../../shared/math.ts";
import { isOnIsland } from "../../world/coast.ts";
import { hasWater } from "../../world/water.ts";
import type { WorldGrid } from "../../world/world-grid.ts";
import { POOL_BANK, poolReachNode } from "../terrain/bog-pools.ts";
import { coarseGroundOffsetNode, sampleHeightNode } from "../terrain/height-sampling.ts";
import type { TerrainTextures } from "../terrain/terrain-textures.ts";

const LilyPart = {
  Heart: 2,
  Pad: 0,
  Petal: 1,
} as const;

const PAD_SEGMENTS = 10;
const NOTCH_ANGLE = 0.5;
const PETALS = 6;
const FLOATS_PER_LILY = 4;
const SALT_POOL = 3.17;
const SALT_SHORE = 5.31;
const SALT_CLUSTER = 7.43;
const SALT_PAD = 11.9;
const CLUSTER_CELLS = 4;
const POOL_CHANCE = 0.75;
const SHORE_CHANCE = 0.55;
const CLUSTER_CHANCE = 0.35;
const SHALLOWEST_LILY_WATER = 0.15;
const DEEPEST_LILY_WATER = 2.4;
const COLDEST_LILY = 4;
const LEAST_LILY_MOISTURE = 0.42;
const POOL_PADS = 7;
const SHORE_PADS = 9;
const POOL_SPREAD = 0.16;
const SHORE_SPREAD = 0.48;
const SMALLEST_PAD = 0.35;
const LARGEST_PAD = 0.7;
const FLOWER_SHARE = 0.2;
const FLOWER_SCALE = 2;
const PINK_SHARE = 0.35;
const FLOAT_LIFT = 0.03;
const POOL_LIFT = 0.05;
const POOL_SHRINK = 0.2;
const NEAR_FADE = 450;
const FAR_FADE = 650;
const PAD_GREEN = vec3(0.13, 0.25, 0.07);
const PAD_YELLOW = vec3(0.3, 0.32, 0.1);
const WHITE_PETAL = vec3(0.92, 0.92, 0.86);
const PINK_PETAL = vec3(0.92, 0.55, 0.68);
const FLOWER_HEART = vec3(0.95, 0.75, 0.2);

interface LilyPlacements {
  readonly flowers: number[];
  readonly pads: number[];
}

interface LilyShape {
  readonly parts: number[];
  readonly positions: number[];
}

interface LilyUniforms {
  readonly bloom: Node<"float">;
  readonly presence: Node<"float">;
}

function padShape(): LilyShape {
  const positions: number[] = [];
  const parts: number[] = [];
  const sweep = FULL_TURN - NOTCH_ANGLE;

  for (let segment = 0; segment < PAD_SEGMENTS; segment += 1) {
    const from = NOTCH_ANGLE / 2 + (segment / PAD_SEGMENTS) * sweep;
    const to = NOTCH_ANGLE / 2 + ((segment + 1) / PAD_SEGMENTS) * sweep;

    positions.push(0, 0, 0, Math.cos(to), 0, Math.sin(to), Math.cos(from), 0, Math.sin(from));
    parts.push(LilyPart.Pad, LilyPart.Pad, LilyPart.Pad);
  }

  return { parts, positions };
}

function flowerShape(): LilyShape {
  const positions: number[] = [];
  const parts: number[] = [];
  const side = FULL_TURN / PETALS / 2.4;

  for (let petal = 0; petal < PETALS; petal += 1) {
    const angle = (petal / PETALS) * FULL_TURN;

    positions.push(
      0,
      0.02,
      0,
      Math.cos(angle - side) * 0.32,
      0.12,
      Math.sin(angle - side) * 0.32,
      Math.cos(angle) * 0.42,
      0.26,
      Math.sin(angle) * 0.42,
      0,
      0.02,
      0,
      Math.cos(angle) * 0.42,
      0.26,
      Math.sin(angle) * 0.42,
      Math.cos(angle + side) * 0.32,
      0.12,
      Math.sin(angle + side) * 0.32
    );
    parts.push(LilyPart.Petal, LilyPart.Petal, LilyPart.Petal, LilyPart.Petal, LilyPart.Petal, LilyPart.Petal);
  }

  for (let corner = 0; corner < 3; corner += 1) {
    const angle = (corner / 3) * FULL_TURN;

    positions.push(Math.cos(angle) * 0.1, 0.16, Math.sin(angle) * 0.1);
    parts.push(LilyPart.Heart);
  }

  return { parts, positions };
}

function createGeometry(shape: LilyShape, lilies: number[]): InstancedBufferGeometry {
  const geometry = new InstancedBufferGeometry();
  const normals = shape.positions.map((_value, index) => (index % 3 === 1 ? 1 : 0));

  geometry.setAttribute("position", new Float32BufferAttribute(shape.positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("lilyPart", new Float32BufferAttribute(shape.parts, 1));
  geometry.setAttribute("lily", new InstancedBufferAttribute(new Float32Array(lilies), FLOATS_PER_LILY));
  geometry.instanceCount = lilies.length / FLOATS_PER_LILY;

  return geometry;
}

function isLilyShore(mirror: WorldMirror, cell: number): boolean {
  const { grid, terrain } = mirror;

  const depth = terrain.waterSurface[cell] - terrain.height[cell];

  if (terrain.riverStrength[cell] !== 0 || depth < SHALLOWEST_LILY_WATER || depth > DEEPEST_LILY_WATER) {
    return false;
  }

  const column = grid.columnOf(cell);
  const row = grid.rowOf(cell);

  return hashToUnit(Math.floor(column / CLUSTER_CELLS), Math.floor(row / CLUSTER_CELLS), SALT_CLUSTER) < CLUSTER_CHANCE;
}

function canHoldLilies(mirror: WorldMirror, cell: number): boolean {
  const { terrain } = mirror;

  if (!isOnIsland(terrain.coastDistance, cell) || terrain.moisture[cell] < LEAST_LILY_MOISTURE) {
    return false;
  }

  return terrain.baseTemperature[cell] > COLDEST_LILY;
}

function scatter(placements: LilyPlacements, grid: WorldGrid, cell: number, count: number, spread: number): void {
  const column = grid.columnOf(cell);
  const row = grid.rowOf(cell);

  for (let pad = 0; pad < count; pad += 1) {
    const salt = SALT_PAD + pad * 4;
    const angle = hashToUnit(column, row, salt) * FULL_TURN;
    const reach = Math.sqrt(hashToUnit(column, row, salt + 1)) * spread * grid.cellSize;
    const size = lerp(SMALLEST_PAD, LARGEST_PAD, hashToUnit(column, row, salt + 2));
    const look = hashToUnit(column, row, salt + 3);

    const x = grid.cellCenterX(cell) + Math.cos(angle) * reach;
    const z = grid.cellCenterZ(cell) + Math.sin(angle) * reach;
    const turn = look * FULL_TURN * 7;

    placements.pads.push(x, z, turn, size);

    if (look < FLOWER_SHARE) {
      placements.flowers.push(x, z, turn, look < FLOWER_SHARE * PINK_SHARE ? -size : size);
    }
  }
}

function placeLilies(mirror: WorldMirror): LilyPlacements {
  const { grid, terrain } = mirror;

  const placements: LilyPlacements = { flowers: [], pads: [] };

  for (let cell = 0; cell < grid.cellCount; cell += 1) {
    if (!canHoldLilies(mirror, cell)) {
      continue;
    }

    const column = grid.columnOf(cell);
    const row = grid.rowOf(cell);

    if (isPoolGround(terrain.ground[cell])) {
      if (hashToUnit(column, row, SALT_POOL) < POOL_CHANCE) {
        scatter(placements, grid, cell, POOL_PADS, POOL_SPREAD);
      }

      continue;
    }

    const isLilyWater = hasWater(terrain.waterSurface[cell], terrain.height[cell]) && isLilyShore(mirror, cell);

    if (isLilyWater && hashToUnit(column, row, SALT_SHORE) < SHORE_CHANCE) {
      scatter(placements, grid, cell, SHORE_PADS, SHORE_SPREAD);
    }
  }

  return placements;
}

function lilyPresenceFor(season: number): number {
  return Math.max(1 - smoothstepNumber(2.5, 2.95, season), smoothstepNumber(3.55, 3.95, season));
}

function lilyBloomFor(season: number): number {
  return smoothstepNumber(0.35, 0.7, season) * (1 - smoothstepNumber(2, 2.35, season));
}

function createLilyMaterial(
  textures: TerrainTextures,
  grid: WorldGrid,
  uniforms: LilyUniforms,
  isFlower: boolean
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ side: DoubleSide });
  const last = grid.cellsPerSide - 1;

  const lily = attribute("lily", "vec4");
  const part = attribute("lilyPart", "float");

  const point = lily.xy;
  const size = lily.w.abs();
  const turn = lily.z;
  const cell = ivec2(clamp(floor(point.add(grid.halfSize).div(grid.cellSize)), vec2(0, 0), vec2(last, last)));

  const ground = sampleHeightNode(textures.height, grid, point).add(coarseGroundOffsetNode(textures, grid, point));
  const water = textureLoad(textures.water, cell).x;
  const pool = poolReachNode(textures, grid, point);
  const frozen = smoothstep(0.1, 0.3, textureLoad(textures.surface, cell).r);
  const fade = smoothstep(FAR_FADE, NEAR_FADE, distance(vec3(point.x, ground, point.y), cameraPosition));

  const isFloating = water.greaterThan(ground.add(SHALLOWEST_LILY_WATER));
  const isInPool = pool.greaterThan(POOL_BANK + POOL_SHRINK);
  const level = select(isFloating, water.add(FLOAT_LIFT), ground.add(POOL_LIFT));
  const shown = select(isFloating.or(isInPool), float(1), float(0));
  const season = isFlower ? uniforms.bloom : uniforms.presence;
  const growth = isFlower ? FLOWER_SCALE : 1;

  const scale = size.mul(growth).mul(shown).mul(fade).mul(season).mul(float(1).sub(frozen));
  const local = positionGeometry.mul(scale);
  const cosine = cos(turn);
  const sine = sin(turn);

  material.positionNode = Fn(() =>
    vec3(
      point.x.add(local.x.mul(cosine)).add(local.z.mul(sine)),
      level.add(local.y),
      point.y.add(local.z.mul(cosine)).sub(local.x.mul(sine))
    )
  )();

  const tint = smoothstep(0.2, 1, positionGeometry.xz.length()).mul(0.4);
  const petal = select(lily.w.lessThan(0), PINK_PETAL, WHITE_PETAL);

  material.colorNode = isFlower
    ? select(part.equal(LilyPart.Heart), FLOWER_HEART, petal)
    : mix(PAD_GREEN, PAD_YELLOW, tint);
  material.roughnessNode = float(isFlower ? 0.7 : 0.35);
  material.normalNode = transformNormalToView(vec3(0, 1, 0));

  return material;
}

export class LilyPads {
  readonly #bloom = uniform(0);
  readonly #flowers: Mesh<InstancedBufferGeometry, MeshStandardNodeMaterial>;
  readonly #pads: Mesh<InstancedBufferGeometry, MeshStandardNodeMaterial>;
  readonly #presence = uniform(0);

  constructor(mirror: WorldMirror, textures: TerrainTextures) {
    const uniforms = { bloom: this.#bloom, presence: this.#presence };

    this.#pads = new Mesh(new InstancedBufferGeometry(), createLilyMaterial(textures, mirror.grid, uniforms, false));
    this.#flowers = new Mesh(new InstancedBufferGeometry(), createLilyMaterial(textures, mirror.grid, uniforms, true));

    for (const mesh of [this.#pads, this.#flowers]) {
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
    }

    this.rebuild(mirror);
  }

  get meshes(): readonly Mesh[] {
    return [this.#pads, this.#flowers];
  }

  rebuild(mirror: WorldMirror): void {
    const placements = placeLilies(mirror);

    this.#pads.geometry.dispose();
    this.#flowers.geometry.dispose();
    this.#pads.geometry = createGeometry(padShape(), placements.pads);
    this.#flowers.geometry = createGeometry(flowerShape(), placements.flowers);
  }

  update(season: number): void {
    this.#presence.value = lilyPresenceFor(season);
    this.#bloom.value = lilyBloomFor(season) * this.#presence.value;
    this.#pads.visible = this.#presence.value > 0;
    this.#flowers.visible = this.#bloom.value > 0;
  }

  dispose(): void {
    for (const mesh of [this.#pads, this.#flowers]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}

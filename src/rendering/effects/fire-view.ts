import { Group, type PerspectiveCamera, PointLight, Vector3 } from "three/webgpu";
import { isLitCampfire } from "../../content/buildings.ts";
import { Ground } from "../../content/grounds.ts";
import { isTreeSpecies, plantSpeciesDefinition } from "../../content/plants.ts";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { distanceSquared, fractionalPart, hashToUnit } from "../../shared/math.ts";
import type { BuildingView } from "../../simulation/frame.ts";
import { GROUND_CHANNELS, GroundChannel, SURFACE_CHANNELS, SurfaceChannel } from "../../world/agent-buffers.ts";
import { PlantState } from "../../world/vegetation-store.ts";
import type { InstanceBatch } from "../instancing.ts";
import { remainingCrown } from "../vegetation/plant-burning.ts";
import { CHUNK_CELLS, type VegetationChunks } from "../vegetation/vegetation-chunks.ts";
import { type CameraAxes, createBillboardBatch } from "./billboards.ts";
import { createFlameMaterial } from "./flame-material.ts";
import { createSmokeMaterial, SmokeLook } from "./smoke-material.ts";
import { createSparkMaterial } from "./spark-material.ts";

const BYTE = 255;
const FLAME_CELL_LIMIT = 1600;
const CROWN_TONGUE_LIMIT = 4200;
const CONIFER_CROWN_BASE = 0.2;
const BROADLEAF_CROWN_BASE = 0.45;
const CONIFER_CROWN_WIDTH = 0.16;
const BROADLEAF_CROWN_WIDTH = 0.3;
const CROWN_SPARK_LIMIT = 260;
const SMOKE_COLUMN_LIMIT = 90;
const SMOKE_CELL_SHARE = 0.2;
const HEAVY_SMOKE_PUFFS = 8;
const LIGHT_SMOKE_PUFFS = 16;
const CAMPFIRE_SMOKE_PUFFS = 32;
const SPARK_CELL_LIMIT = 220;
const SPARK_CELL_SHARE = 0.33;
const SPARKS_PER_CELL = 2;
const SPARKING = 0.35;
const SPARK_RISE = 26;
const CAMPFIRE_SPARK_RISE = 9;
const SMOLDERING = 0.3;
const CROWN_FIRE = 0.45;
const CROWN_FLAME_FIRE = 0.1;
const CROWN_SPARK_RISE = 34;
const FLAME_LIFT = 0.36;
const CAMPFIRE_LIGHTS = 3;
const CAMPFIRE_LIGHT_RANGE = 70;
const CAMPFIRE_LIGHT_POWER = 260;
const HEAVY_SMOKE_HEIGHT = 170;
const COLUMN_GROWN_SCORCH = 0.25;
const FULL_SMOKE_INTENSITY = 0.35;
const CAMPFIRE_SMOKE_HEIGHT = 34;
const REBUILD_DISTANCE = 120;
const LIGHT_SMOKE_HEIGHT = 80;

interface FireViewOptions {
  readonly axes: CameraAxes;
  readonly chunks: VegetationChunks;
}

interface CrownTongue {
  readonly height: number;
  readonly reach: number;
  readonly size: number;
  readonly slenderness: number;
  readonly spread: number;
  readonly strength: number;
}

const CROWN_TONGUES: readonly CrownTongue[] = [
  { height: 0.08, reach: 1, size: 0.15, slenderness: 0, spread: 0.95, strength: 0 },
  { height: 0.2, reach: 0.9, size: 0.17, slenderness: 0, spread: 0.85, strength: 0.12 },
  { height: 0.36, reach: 0.8, size: 0.19, slenderness: 0.2, spread: 0.7, strength: 0 },
  { height: 0.52, reach: 0.7, size: 0.17, slenderness: 0.4, spread: 0.55, strength: 0.25 },
  { height: 0.66, reach: 0.55, size: 0.21, slenderness: 0.6, spread: 0.4, strength: 0.4 },
  { height: 0.82, reach: 0.4, size: 0.27, slenderness: 0.8, spread: 0.2, strength: 0.65 },
];

interface BurningCell {
  readonly cell: number;
  readonly distance: number;
  readonly intensity: number;
}

interface SmokeColumn {
  readonly density: number;
  readonly heaviness: number;
  readonly puffs: number;
  readonly warmth: number;
}

function isSmokeCell(burning: BurningCell): boolean {
  return hashToUnit(burning.cell, 41) < SMOKE_CELL_SHARE;
}

function isSparkCell(burning: BurningCell): boolean {
  return burning.intensity >= SPARKING && hashToUnit(burning.cell, 43) < SPARK_CELL_SHARE;
}

function isWoodland(mirror: WorldMirror, cell: number): boolean {
  const ground = mirror.ground[cell * GROUND_CHANNELS + GroundChannel.Ground];

  return ground === Ground.Forest || ground === Ground.Scrub;
}

function crownFlameStrength(mirror: WorldMirror, plant: number, intensities: ReadonlyMap<number, number>): number {
  const { grid, surface, vegetation } = mirror;

  const state = vegetation.state[plant];

  if (!isTreeSpecies(vegetation.species[plant]) || (state !== PlantState.Alive && state !== PlantState.Burnt)) {
    return 0;
  }

  const cell = grid.cellAt(vegetation.x[plant], vegetation.z[plant]);
  const intensity = intensities.get(cell);

  if (intensity === undefined) {
    return 0;
  }

  if (state === PlantState.Alive) {
    return intensity;
  }

  const scorch = surface[cell * SURFACE_CHANNELS + SurfaceChannel.Scorch] / BYTE;

  return intensity * remainingCrown(intensity, scorch);
}

function campfireHeat(building: BuildingView): number {
  return Math.min(1, building.fuel * 1.4);
}

function nearestBurningCells(mirror: WorldMirror, camera: PerspectiveCamera): BurningCell[] {
  const { burningCells, burningIntensity } = mirror.frame;
  const { grid } = mirror;
  const { position } = camera;

  const cells: BurningCell[] = [];

  for (const [index, cell] of burningCells.entries()) {
    const distance = distanceSquared(position.x, position.z, grid.cellCenterX(cell), grid.cellCenterZ(cell));

    cells.push({ cell, distance, intensity: burningIntensity[index] / BYTE });
  }

  return cells.toSorted((first, second) => first.distance - second.distance).slice(0, FLAME_CELL_LIMIT);
}

export class FireView {
  readonly group = new Group();
  readonly smoke = new SmokeLook();
  readonly #chunks: VegetationChunks;
  readonly #flames: InstanceBatch;
  readonly #lights: readonly PointLight[];
  readonly #puffs: InstanceBatch;
  readonly #rebuiltFrom = new Vector3(Number.POSITIVE_INFINITY, 0, 0);
  readonly #sparks: InstanceBatch;
  #litCampfires: readonly BuildingView[] = [];
  #tick = -1;

  constructor({ axes, chunks }: FireViewOptions) {
    this.#chunks = chunks;
    this.#flames = createBillboardBatch(createFlameMaterial(axes), 6);
    this.#puffs = createBillboardBatch(createSmokeMaterial(axes, this.smoke), 5);
    this.#sparks = createBillboardBatch(createSparkMaterial(axes, this.smoke), 7);
    this.#lights = Array.from(
      { length: CAMPFIRE_LIGHTS },
      () => new PointLight(0xff_9a_52, 0, CAMPFIRE_LIGHT_RANGE, 1.6)
    );
    this.group.add(this.#puffs.mesh, this.#flames.mesh, this.#sparks.mesh, ...this.#lights);
  }

  get flameCount(): number {
    return this.#flames.count;
  }

  get puffCount(): number {
    return this.#puffs.count;
  }

  get sparkCount(): number {
    return this.#sparks.count;
  }

  update(mirror: WorldMirror, camera: PerspectiveCamera, darkness: number): void {
    const hasMoved = this.#rebuiltFrom.distanceTo(camera.position) > REBUILD_DISTANCE;

    if (mirror.frame.tick !== this.#tick || hasMoved) {
      this.#tick = mirror.frame.tick;
      this.#rebuiltFrom.copy(camera.position);
      this.#rebuild(mirror, camera);
    }

    this.#lightCampfires(darkness);
  }

  dispose(): void {
    for (const batch of [this.#flames, this.#puffs, this.#sparks]) {
      batch.dispose();
      batch.mesh.material.dispose();
    }
  }

  #rebuild(mirror: WorldMirror, camera: PerspectiveCamera): void {
    const cells = nearestBurningCells(mirror, camera);
    const intensities = new Map(cells.map((burning) => [burning.cell, burning.intensity]));

    this.#flames.begin();
    this.#puffs.begin();
    this.#sparks.begin();

    for (const burning of cells) {
      this.#addGroundFlames(mirror, burning);
    }

    for (const burning of cells.filter(isSmokeCell).slice(0, SMOKE_COLUMN_LIMIT).toReversed()) {
      this.#addFireSmoke(mirror, burning);
    }

    for (const burning of cells.filter(isSparkCell).slice(0, SPARK_CELL_LIMIT)) {
      this.#addSparks(mirror, burning);
    }

    this.#addCrownFlames(mirror, intensities);
    this.#addCampfires(mirror);
    this.#placeLights(mirror, camera);
    this.#flames.commit();
    this.#puffs.commit();
    this.#sparks.commit();
  }

  #addGroundFlames(mirror: WorldMirror, burning: BurningCell): void {
    if (burning.intensity < SMOLDERING) {
      return;
    }

    const { grid } = mirror;

    const left = grid.cellCenterX(burning.cell) - grid.cellSize / 2;
    const top = grid.cellCenterZ(burning.cell) - grid.cellSize / 2;
    const count = burning.intensity > 0.65 ? 2 : 1;

    for (let flame = 0; flame < count; flame += 1) {
      const scale = hashToUnit(burning.cell, flame, 3);
      const x = left + (0.1 + 0.8 * hashToUnit(burning.cell, flame, 1)) * grid.cellSize;
      const z = top + (0.1 + 0.8 * hashToUnit(burning.cell, flame, 2)) * grid.cellSize;
      const size = (1.6 + 4.4 * burning.intensity) * (0.65 + 0.7 * scale);

      this.#flames.add([x, mirror.heightAt(x, z) + size * FLAME_LIFT, z, size], [scale, burning.intensity, 0, 0]);
    }
  }

  #addCrownFlames(mirror: WorldMirror, intensities: ReadonlyMap<number, number>): void {
    let sparks = 0;
    let tongues = 0;

    for (const chunkIndex of this.#crownFireChunks(mirror, intensities)) {
      for (const plant of this.#chunks.chunks[chunkIndex].plants) {
        if (tongues >= CROWN_TONGUE_LIMIT) {
          return;
        }

        const strength = crownFlameStrength(mirror, plant, intensities);

        if (strength < CROWN_FLAME_FIRE) {
          continue;
        }

        tongues += this.#addCrownTongues(mirror, plant, strength);

        if (sparks < CROWN_SPARK_LIMIT && strength >= SPARKING && hashToUnit(plant, 11) < SPARK_CELL_SHARE) {
          this.#addCrownSpark(mirror, plant, strength);
          sparks += 1;
        }
      }
    }
  }

  #crownFireChunks(mirror: WorldMirror, intensities: ReadonlyMap<number, number>): Set<number> {
    const { grid } = mirror;

    const chunkIndices = new Set<number>();

    for (const [cell, intensity] of intensities) {
      if (intensity < CROWN_FLAME_FIRE) {
        continue;
      }

      const chunkColumn = Math.floor(grid.columnOf(cell) / CHUNK_CELLS);
      const chunkRow = Math.floor(grid.rowOf(cell) / CHUNK_CELLS);

      chunkIndices.add(chunkRow * this.#chunks.chunksPerSide + chunkColumn);
    }

    return chunkIndices;
  }

  #addCrownTongues(mirror: WorldMirror, plant: number, strength: number): number {
    const { vegetation } = mirror;

    const x = vegetation.x[plant];
    const z = vegetation.z[plant];
    const height = vegetation.height[plant];
    const seed = vegetation.seed[plant];
    const ground = mirror.heightAt(x, z);
    const isConifer = plantSpeciesDefinition(vegetation.species[plant]).form === "conifer";
    const crownRadius = height * (isConifer ? CONIFER_CROWN_WIDTH : BROADLEAF_CROWN_WIDTH);
    const crownBase = isConifer ? CONIFER_CROWN_BASE : BROADLEAF_CROWN_BASE;

    let added = 0;

    for (const [index, tongue] of CROWN_TONGUES.entries()) {
      if (strength < tongue.strength) {
        continue;
      }

      const angle = hashToUnit(plant, index, 21) * Math.PI * 2;
      const spread = crownRadius * tongue.spread * (0.6 + 0.4 * hashToUnit(plant, index, 22));
      const size = height * tongue.size * (0.35 + 0.8 * strength) * (0.7 + 0.6 * hashToUnit(plant, index, 23));
      const tongueX = x + Math.cos(angle) * spread;
      const tongueZ = z + Math.sin(angle) * spread;
      const tongueY = ground + height * (crownBase + (1 - crownBase) * tongue.height) - size * 0.2;

      this.#flames.add(
        [tongueX, tongueY, tongueZ, size],
        [fractionalPart(seed + index * 0.37), strength, crownRadius * tongue.reach, tongue.slenderness]
      );
      added += 1;
    }

    return added;
  }

  #addCrownSpark(mirror: WorldMirror, plant: number, strength: number): void {
    const { vegetation } = mirror;

    const x = vegetation.x[plant];
    const z = vegetation.z[plant];
    const top = mirror.heightAt(x, z) + vegetation.height[plant] * 0.7;

    this.#sparks.add([x, top, z, CROWN_SPARK_RISE * (0.6 + strength)], [vegetation.seed[plant], strength, 0, 0]);
  }

  #addFireSmoke(mirror: WorldMirror, burning: BurningCell): void {
    const { grid, surface } = mirror;

    const isHeavy = isWoodland(mirror, burning.cell) && burning.intensity >= CROWN_FIRE;
    const x = grid.cellCenterX(burning.cell);
    const z = grid.cellCenterZ(burning.cell);
    const scorch = surface[burning.cell * SURFACE_CHANNELS + SurfaceChannel.Scorch] / BYTE;
    const growth = 0.35 + 0.65 * Math.min(1, scorch / COLUMN_GROWN_SCORCH);
    const height = (isHeavy ? HEAVY_SMOKE_HEIGHT : LIGHT_SMOKE_HEIGHT) * (0.6 + 0.5 * burning.intensity) * growth;
    const density = Math.min(1, burning.intensity / FULL_SMOKE_INTENSITY) * (isHeavy ? 1 : 0.75);

    this.#addSmokeColumn(mirror, x, z, height, {
      density,
      heaviness: isHeavy ? 1 : 0,
      puffs: isHeavy ? HEAVY_SMOKE_PUFFS : LIGHT_SMOKE_PUFFS,
      warmth: burning.intensity,
    });
  }

  #addSparks(mirror: WorldMirror, burning: BurningCell): void {
    const { grid } = mirror;

    const x = grid.cellCenterX(burning.cell);
    const z = grid.cellCenterZ(burning.cell);
    const rise = SPARK_RISE * (0.6 + burning.intensity);

    for (let spark = 0; spark < SPARKS_PER_CELL; spark += 1) {
      const seed = hashToUnit(burning.cell, spark, 7);
      const sparkX = x + (seed - 0.5) * grid.cellSize;
      const sparkZ = z + (hashToUnit(burning.cell, spark, 8) - 0.5) * grid.cellSize;

      this.#sparks.add([sparkX, mirror.heightAt(sparkX, sparkZ) + 1, sparkZ, rise], [seed, burning.intensity, 0, 0]);
    }
  }

  #addSmokeColumn(mirror: WorldMirror, x: number, z: number, height: number, column: SmokeColumn): void {
    const ground = mirror.heightAt(x, z) + 1 + column.heaviness * 6;
    const offset = hashToUnit(x, z) * 0.1;

    for (let puff = 0; puff < column.puffs; puff += 1) {
      const seed = puff / column.puffs + offset;

      this.#puffs.add([x, ground, z, height], [seed, column.heaviness, column.density, column.warmth]);
    }
  }

  #addCampfires(mirror: WorldMirror): void {
    for (const building of mirror.frame.buildings) {
      if (!isLitCampfire(building)) {
        continue;
      }

      const ground = mirror.heightAt(building.x, building.z);
      const heat = campfireHeat(building);

      for (let flame = 0; flame < 2; flame += 1) {
        const seed = hashToUnit(building.id, flame);
        const size = (2.4 - flame * 0.7) * (0.75 + heat * 0.35);

        this.#flames.add(
          [building.x + flame * 0.35, ground + size * FLAME_LIFT, building.z - flame * 0.3, size],
          [seed, 0.8 + heat * 0.15, 0, 0]
        );
      }

      this.#addSmokeColumn(mirror, building.x, building.z, CAMPFIRE_SMOKE_HEIGHT, {
        density: 0.55 + heat * 0.45,
        heaviness: 0,
        puffs: CAMPFIRE_SMOKE_PUFFS,
        warmth: 0.5,
      });
      this.#sparks.add(
        [building.x, ground + 0.6, building.z, CAMPFIRE_SPARK_RISE],
        [hashToUnit(building.id, 5), heat, 0, 0]
      );
    }
  }

  #placeLights(mirror: WorldMirror, camera: PerspectiveCamera): void {
    function distanceTo(building: BuildingView): number {
      return Math.hypot(building.x - camera.position.x, building.z - camera.position.z);
    }

    this.#litCampfires = mirror.frame.buildings
      .filter(isLitCampfire)
      .toSorted((first, second) => distanceTo(first) - distanceTo(second))
      .slice(0, CAMPFIRE_LIGHTS);

    for (const [index, light] of this.#lights.entries()) {
      const building = this.#litCampfires[index];

      if (building !== undefined) {
        light.position.set(building.x, mirror.heightAt(building.x, building.z) + 2.2, building.z);
      }
    }
  }

  #lightCampfires(darkness: number): void {
    for (const [index, light] of this.#lights.entries()) {
      const building = this.#litCampfires[index];

      if (building === undefined || darkness < 0.05) {
        light.intensity = 0;
        continue;
      }

      const flicker = 0.85 + Math.random() * 0.15;

      light.intensity = CAMPFIRE_LIGHT_POWER * darkness * campfireHeat(building) * flicker;
    }
  }
}

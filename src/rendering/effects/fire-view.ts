import { Group, type PerspectiveCamera, PointLight, Vector3 } from "three/webgpu";
import { Ground } from "../../content/grounds.ts";
import { isTreeSpecies } from "../../content/plants.ts";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { hashToUnit } from "../../shared/math.ts";
import type { BuildingView } from "../../simulation/frame.ts";
import { GROUND_CHANNELS, GroundChannel } from "../../world/agent-buffers.ts";
import { PlantState } from "../../world/vegetation-store.ts";
import { CHUNK_CELLS, type VegetationChunks } from "../vegetation/vegetation-chunks.ts";
import { BillboardBatch, type CameraAxes } from "./billboards.ts";
import { createFlameMaterial } from "./flame-material.ts";
import { createSmokeMaterial, SmokeLook } from "./smoke-material.ts";
import { createSparkMaterial } from "./spark-material.ts";

const BYTE = 255;
const FLAME_CELL_LIMIT = 1600;
const CROWN_FLAME_LIMIT = 900;
const SMOKE_COLUMN_LIMIT = 90;
const SMOKE_CELL_SHARE = 0.2;
const PUFFS_PER_COLUMN = 6;
const SPARK_CELL_LIMIT = 220;
const SPARK_CELL_SHARE = 0.33;
const SPARKS_PER_CELL = 2;
const SPARKING = 0.35;
const SPARK_RISE = 26;
const CAMPFIRE_SPARK_RISE = 9;
const SMOULDERING = 0.3;
const CROWN_FIRE = 0.45;
const FLAME_LIFT = 0.36;
const LIT_CAMPFIRE_FUEL = 0.02;
const CAMPFIRE_LIGHTS = 3;
const CAMPFIRE_LIGHT_RANGE = 70;
const CAMPFIRE_LIGHT_POWER = 260;
const HEAVY_SMOKE_HEIGHT = 190;
const REBUILD_DISTANCE = 120;
const LIGHT_SMOKE_HEIGHT = 95;

export interface FireViewOptions {
  readonly axes: CameraAxes;
  readonly chunks: VegetationChunks;
}

interface BurningCell {
  readonly cell: number;
  readonly distance: number;
  readonly intensity: number;
}

function isLitCampfire(building: BuildingView): boolean {
  return building.kind === "campfire" && building.progress >= 1 && building.fuel > LIT_CAMPFIRE_FUEL;
}

function groundFlameCount(intensity: number): number {
  if (intensity > 0.65) {
    return 2;
  }

  return 1;
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

export class FireView {
  readonly group = new Group();
  readonly smoke = new SmokeLook();
  readonly #chunks: VegetationChunks;
  readonly #flames: BillboardBatch;
  readonly #lights: readonly PointLight[];
  readonly #puffs: BillboardBatch;
  readonly #rebuiltFrom = new Vector3(Number.POSITIVE_INFINITY, 0, 0);
  readonly #sparks: BillboardBatch;
  #litCampfires: readonly BuildingView[] = [];
  #tick = -1;

  constructor({ axes, chunks }: FireViewOptions) {
    this.#chunks = chunks;
    this.#flames = new BillboardBatch(createFlameMaterial(axes), 6);
    this.#puffs = new BillboardBatch(createSmokeMaterial(axes, this.smoke), 5);
    this.#sparks = new BillboardBatch(createSparkMaterial(axes, this.smoke), 7);
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
    this.#flames.dispose();
    this.#puffs.dispose();
    this.#sparks.dispose();
  }

  #rebuild(mirror: WorldMirror, camera: PerspectiveCamera): void {
    const cells = this.#nearestBurningCells(mirror, camera);

    const intensities = new Map(cells.map((burning) => [burning.cell, burning.intensity]));

    this.#flames.begin();
    this.#puffs.begin();
    this.#sparks.begin();

    for (const burning of cells) {
      this.#addGroundFlames(mirror, burning);
    }

    for (const burning of cells.filter(isSmokeCell).slice(0, SMOKE_COLUMN_LIMIT)) {
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

  #nearestBurningCells(mirror: WorldMirror, camera: PerspectiveCamera): BurningCell[] {
    const { burningCells, burningIntensity } = mirror.frame;
    const { grid } = mirror;
    const cells: BurningCell[] = [];

    for (const [index, cell] of burningCells.entries()) {
      const x = grid.cellCenterX(cell) - camera.position.x;
      const z = grid.cellCenterZ(cell) - camera.position.z;

      cells.push({ cell, distance: x * x + z * z, intensity: burningIntensity[index] / BYTE });
    }

    if (cells.length <= FLAME_CELL_LIMIT) {
      return cells.toSorted((first, second) => first.distance - second.distance);
    }

    return cells.toSorted((first, second) => first.distance - second.distance).slice(0, FLAME_CELL_LIMIT);
  }

  #addGroundFlames(mirror: WorldMirror, burning: BurningCell): void {
    if (burning.intensity < SMOULDERING) {
      return;
    }

    const { grid } = mirror;

    const left = grid.cellCenterX(burning.cell) - grid.cellSize / 2;
    const top = grid.cellCenterZ(burning.cell) - grid.cellSize / 2;
    const count = groundFlameCount(burning.intensity);

    for (let flame = 0; flame < count; flame += 1) {
      const scale = hashToUnit(burning.cell, flame, 3);
      const x = left + (0.1 + 0.8 * hashToUnit(burning.cell, flame, 1)) * grid.cellSize;
      const z = top + (0.1 + 0.8 * hashToUnit(burning.cell, flame, 2)) * grid.cellSize;

      const size = (1.6 + 4.4 * burning.intensity) * (0.65 + 0.7 * scale);

      this.#flames.add([x, mirror.heightAt(x, z) + size * FLAME_LIFT, z, size], [scale, burning.intensity, 0, 0]);
    }
  }

  #addCrownFlames(mirror: WorldMirror, intensities: ReadonlyMap<number, number>): void {
    const { grid, vegetation } = mirror;
    const chunkIndices = new Set<number>();
    let added = 0;

    for (const [cell, intensity] of intensities) {
      if (intensity >= CROWN_FIRE) {
        const chunkColumn = Math.floor(grid.columnOf(cell) / CHUNK_CELLS);
        const chunkRow = Math.floor(grid.rowOf(cell) / CHUNK_CELLS);

        chunkIndices.add(chunkRow * this.#chunks.chunksPerSide + chunkColumn);
      }
    }

    for (const chunkIndex of chunkIndices) {
      for (const plant of this.#chunks.chunks[chunkIndex].plants) {
        if (added >= CROWN_FLAME_LIMIT) {
          return;
        }

        if (vegetation.state[plant] !== PlantState.Alive || !isTreeSpecies(vegetation.species[plant])) {
          continue;
        }

        const x = vegetation.x[plant];
        const z = vegetation.z[plant];

        const intensity = intensities.get(grid.cellAt(x, z));

        if (intensity === undefined || intensity < CROWN_FIRE) {
          continue;
        }

        const height = vegetation.height[plant];
        const seed = vegetation.seed[plant];

        const size = height * (0.55 + 0.5 * intensity) * (0.8 + 0.4 * seed);

        this.#flames.add([x, mirror.heightAt(x, z) + height * 0.55 + size * 0.2, z, size], [seed, intensity, 0, 0]);
        added += 1;
      }
    }
  }

  #addFireSmoke(mirror: WorldMirror, burning: BurningCell): void {
    const { grid } = mirror;
    const isHeavy = isWoodland(mirror, burning.cell) && burning.intensity >= CROWN_FIRE;

    const x = grid.cellCenterX(burning.cell);
    const z = grid.cellCenterZ(burning.cell);
    const height = (isHeavy ? HEAVY_SMOKE_HEIGHT : LIGHT_SMOKE_HEIGHT) * (0.6 + 0.5 * burning.intensity);

    this.#addSmokeColumn(mirror, x, z, height, isHeavy ? 1 : 0, burning.intensity);
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

  #addSmokeColumn(mirror: WorldMirror, x: number, z: number, height: number, heaviness: number, warmth: number): void {
    const ground = mirror.heightAt(x, z) + 2 + heaviness * 14;
    const offset = hashToUnit(x, z) * 0.1;

    for (let puff = 0; puff < PUFFS_PER_COLUMN; puff += 1) {
      const seed = puff / PUFFS_PER_COLUMN + offset;

      this.#puffs.add([x, ground, z, height], [seed, heaviness, 0.7 + hashToUnit(x, z, puff) * 0.6, warmth]);
    }
  }

  #addCampfires(mirror: WorldMirror): void {
    for (const building of mirror.frame.buildings) {
      if (!isLitCampfire(building)) {
        continue;
      }

      const ground = mirror.heightAt(building.x, building.z);
      const heat = Math.min(1, building.fuel * 1.4);

      for (let flame = 0; flame < 2; flame += 1) {
        const seed = hashToUnit(building.id, flame);

        const size = (2.4 - flame * 0.7) * (0.75 + heat * 0.35);

        this.#flames.add(
          [building.x + flame * 0.35, ground + size * FLAME_LIFT, building.z - flame * 0.3, size],
          [seed, 0.8 + heat * 0.15, 0, 0]
        );
      }

      this.#addSmokeColumn(mirror, building.x, building.z, 26, 0, 0.5);
      this.#sparks.add(
        [building.x, ground + 0.6, building.z, CAMPFIRE_SPARK_RISE],
        [hashToUnit(building.id, 5), heat, 0, 0]
      );
    }
  }

  #placeLights(mirror: WorldMirror, camera: PerspectiveCamera): void {
    const distanceTo = (building: BuildingView) =>
      Math.hypot(building.x - camera.position.x, building.z - camera.position.z);

    this.#litCampfires = mirror.frame.buildings
      .filter((building) => isLitCampfire(building))
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

      light.intensity = CAMPFIRE_LIGHT_POWER * darkness * Math.min(1, building.fuel * 1.4) * flicker;
    }
  }
}

import { clamp } from "../shared/math.ts";
import type {
  InitialWorld,
  PackedRows,
  SimulationFrame,
  TerrainSnapshot,
  VegetationPatch,
} from "../simulation/frame.ts";
import { GROUND_CHANNELS, GroundChannel } from "../world/agent-buffers.ts";
import { RegionChangeTracker, RowChangeTracker } from "../world/change-tracking.ts";
import { isWaterAtPoint, sampleHeight, sampleSurface } from "../world/terrain-sampling.ts";
import type { VegetationBuffers } from "../world/vegetation-store.ts";
import type { WaterFeatures } from "../world/water.ts";
import { WorldGrid } from "../world/world-grid.ts";

const GROWTH_FACTOR = 1.5;
const MILLISECONDS_PER_SECOND = 1000;
const LONGEST_EXTRAPOLATION_SECONDS = 0.1;

export class MirroredVegetation {
  bornDay: Float32Array;
  count: number;
  fruit: Float32Array;
  height: Float32Array;
  rotation: Float32Array;
  seed: Float32Array;
  species: Uint8Array;
  state: Uint8Array;
  version = 0;
  x: Float32Array;
  z: Float32Array;
  readonly #changedIndices = new Set<number>();

  constructor(buffers: VegetationBuffers) {
    this.count = buffers.count;
    this.bornDay = buffers.bornDay;
    this.fruit = buffers.fruit;
    this.height = buffers.height;
    this.rotation = buffers.rotation;
    this.seed = buffers.seed;
    this.species = buffers.species;
    this.state = buffers.state;
    this.x = buffers.x;
    this.z = buffers.z;
  }

  apply(patch: VegetationPatch): void {
    const highestIndex = patch.indices.reduce((highest, index) => Math.max(highest, index), -1);

    this.#ensureCapacity(highestIndex + 1);

    for (let position = 0; position < patch.count; position += 1) {
      const index = patch.indices[position];

      this.bornDay[index] = patch.bornDay[position];
      this.fruit[index] = patch.fruit[position];
      this.height[index] = patch.height[position];
      this.rotation[index] = patch.rotation[position];
      this.seed[index] = patch.seed[position];
      this.species[index] = patch.species[position];
      this.state[index] = patch.state[position];
      this.x[index] = patch.x[position];
      this.z[index] = patch.z[position];
      this.#changedIndices.add(index);
    }

    this.count = Math.max(this.count, highestIndex + 1);
    this.version += 1;
  }

  takeChangedIndices(): number[] {
    const indices = [...this.#changedIndices];

    this.#changedIndices.clear();

    return indices;
  }

  #ensureCapacity(size: number): void {
    if (size <= this.x.length) {
      return;
    }

    const capacity = Math.ceil(size * GROWTH_FACTOR);

    this.bornDay = grown(this.bornDay, new Float32Array(capacity));
    this.fruit = grown(this.fruit, new Float32Array(capacity));
    this.height = grown(this.height, new Float32Array(capacity));
    this.rotation = grown(this.rotation, new Float32Array(capacity));
    this.seed = grown(this.seed, new Float32Array(capacity));
    this.species = grown(this.species, new Uint8Array(capacity));
    this.state = grown(this.state, new Uint8Array(capacity));
    this.x = grown(this.x, new Float32Array(capacity));
    this.z = grown(this.z, new Float32Array(capacity));
  }
}

function grown<Values extends Float32Array | Uint8Array>(previous: Values, next: Values): Values {
  next.set(previous);

  return next;
}

export class WorldMirror {
  readonly ground: Uint8Array;
  readonly groundChanges: RowChangeTracker;
  readonly grid: WorldGrid;
  readonly heightChanges = new RegionChangeTracker();
  readonly seed: number;
  readonly surface: Uint8Array;
  readonly surfaceChanges: RowChangeTracker;
  readonly terrain: TerrainSnapshot;
  readonly vegetation: MirroredVegetation;
  frame: SimulationFrame;
  frameReceivedAt: number;
  landVersion = 0;
  water: WaterFeatures;
  waterVersion = 0;

  constructor(initial: InitialWorld, receivedAt: number) {
    this.grid = new WorldGrid(initial.dimensions);
    this.seed = initial.seed;
    this.terrain = initial.terrain;
    this.surface = initial.surface;
    this.ground = initial.ground;
    this.vegetation = new MirroredVegetation(initial.vegetation);
    this.water = initial.water;
    this.frame = initial.frame;
    this.frameReceivedAt = receivedAt;
    this.surfaceChanges = new RowChangeTracker(this.grid.cellsPerSide);
    this.groundChanges = new RowChangeTracker(this.grid.cellsPerSide);
  }

  apply(frame: SimulationFrame, receivedAt: number): void {
    this.#applyRows(frame.surfaceRows, this.surface, this.surfaceChanges);
    this.#applyRows(frame.groundRows, this.ground, this.groundChanges);
    this.#copyGroundIndices(frame.groundRows);
    this.#applyHeights(frame);
    this.#applyWater(frame);

    if (frame.vegetation !== null) {
      this.vegetation.apply(frame.vegetation);
    }

    if (frame.groundRows.length > 0 || frame.heightPatch !== null || frame.water !== null) {
      this.landVersion += 1;
    }

    this.frame = frame;
    this.frameReceivedAt = receivedAt;
  }

  gameSecondsSinceTick(now: number): number {
    const { frame } = this;

    if (frame.isPaused) {
      return frame.secondsSinceTick;
    }

    const realSeconds = (now - this.frameReceivedAt) / MILLISECONDS_PER_SECOND;

    return frame.secondsSinceTick + clamp(realSeconds, 0, LONGEST_EXTRAPOLATION_SECONDS) * frame.speed;
  }

  heightAt(x: number, z: number): number {
    return sampleHeight(this.terrain.height, this.grid, x, z);
  }

  surfaceAt(x: number, z: number): number {
    return sampleSurface(this.terrain, this.grid, x, z);
  }

  isWaterAt(x: number, z: number): boolean {
    return isWaterAtPoint(this.terrain, this.grid, x, z);
  }

  #applyRows(rows: readonly PackedRows[], target: Uint8Array, changes: RowChangeTracker): void {
    for (const run of rows) {
      const bytesPerRow = run.data.length / run.rowCount;

      target.set(run.data, run.firstRow * bytesPerRow);
      changes.markRows(run.firstRow, run.firstRow + run.rowCount - 1);
    }
  }

  #copyGroundIndices(rows: readonly PackedRows[]): void {
    const { cellsPerSide } = this.grid;

    for (const run of rows) {
      const firstCell = run.firstRow * cellsPerSide;

      for (let offset = 0; offset < run.rowCount * cellsPerSide; offset += 1) {
        this.terrain.ground[firstCell + offset] = run.data[offset * GROUND_CHANNELS + GroundChannel.Ground];
      }
    }
  }

  #applyHeights(frame: SimulationFrame): void {
    const patch = frame.heightPatch;

    if (patch === null) {
      return;
    }

    const { region } = patch;

    const width = region.lastColumn - region.firstColumn + 1;

    for (let row = region.firstRow; row <= region.lastRow; row += 1) {
      const start = (row - region.firstRow) * width;

      this.terrain.height.set(patch.heights.subarray(start, start + width), this.grid.index(region.firstColumn, row));
    }

    this.heightChanges.markRegion(region);
  }

  #applyWater(frame: SimulationFrame): void {
    const update = frame.water;

    if (update === null) {
      return;
    }

    this.terrain.waterSurface.set(update.waterSurface);
    this.terrain.riverStrength.set(update.riverStrength);
    this.water = update.features;
    this.waterVersion += 1;
  }
}

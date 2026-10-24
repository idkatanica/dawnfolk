import { uniform } from "three/tsl";
import {
  ClampToEdgeWrapping,
  DataTexture,
  FloatType,
  LinearFilter,
  NearestFilter,
  type PixelFormat,
  RedFormat,
  RGBAFormat,
  type Texture,
  UnsignedByteType,
  type WebGPURenderer,
} from "three/webgpu";
import type { WorldMirror } from "../../game/world-mirror.ts";
import type { CellRegion } from "../../world/change-tracking.ts";
import { sampleCells } from "../../world/terrain-sampling.ts";
import { POND_SHORE_SLOPE, pondEdgeReach } from "../../world/water.ts";
import {
  buildShoreField,
  NOT_POND,
  SHORE_CHANNELS,
  ShoreChannel,
  type ShoreSource,
  updateShoreDepths,
} from "../water/shore-field.ts";
import type { WorldChanges } from "../world-changes.ts";
import { bloomFor } from "./fireweed.ts";
import { GroundAlbedo } from "./ground-albedo.ts";
import { IslandOutline } from "./island-outline.ts";

const SEASON_STEP = 0.01;
const POND_SHORE_CELLS = 2;

function floatTexture(data: Float32Array, size: number, format: PixelFormat = RedFormat): DataTexture {
  const texture = new DataTexture(data, size, size, format, FloatType);

  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return texture;
}

function surfaceTexture(data: Uint8Array, size: number): DataTexture {
  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);

  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return texture;
}

export class TerrainTextures {
  readonly bloom = uniform(0);
  readonly height: DataTexture;
  readonly outline: IslandOutline;
  readonly shore: DataTexture;
  readonly size: number;
  readonly surface: DataTexture;
  readonly water: DataTexture;
  readonly #albedo: GroundAlbedo;
  readonly #mirror: WorldMirror;
  readonly #shoreData: Float32Array;
  readonly #pondDepths: Float32Array;
  #albedoSeason = Number.NaN;

  constructor(mirror: WorldMirror) {
    const size = mirror.grid.cellsPerSide;

    this.#mirror = mirror;
    this.size = size;
    this.height = floatTexture(mirror.terrain.height, size);
    this.outline = new IslandOutline(mirror);
    this.water = floatTexture(mirror.terrain.waterSurface, size);
    this.#shoreData = new Float32Array(size * size * SHORE_CHANNELS);
    this.#pondDepths = new Float32Array(size * size);
    this.shore = floatTexture(this.#shoreData, size, RGBAFormat);
    this.#buildShore();
    this.surface = surfaceTexture(mirror.surface, size);
    this.#albedo = new GroundAlbedo(mirror);
  }

  get albedo(): Texture {
    return this.#albedo.texture;
  }

  shoreDepthAt(x: number, z: number): number {
    return sampleCells(this.#shoreData, this.#mirror.grid, x, z, SHORE_CHANNELS, ShoreChannel.Depth);
  }

  update(renderer: WebGPURenderer, season: number, changes: WorldChanges): void {
    this.bloom.value = bloomFor(season);

    if (changes.heightRegion !== null) {
      this.height.needsUpdate = true;
    }

    const haveLevelsChanged = changes.hasWaterChanged || changes.waterLevelRegion !== null;

    if (haveLevelsChanged) {
      this.#buildShore();
    } else if (changes.heightRegion !== null) {
      this.#updateShore(changes.heightRegion);
    }

    if (changes.surfaceRuns.length > 0) {
      this.surface.needsUpdate = true;
    }

    if (haveLevelsChanged) {
      this.water.needsUpdate = true;
    }

    if (changes.groundRuns.length > 0) {
      this.#albedo.groundChanged();
    }

    const hasSeasonChanged = Number.isNaN(this.#albedoSeason) || Math.abs(season - this.#albedoSeason) >= SEASON_STEP;

    if (hasSeasonChanged || changes.groundRuns.length > 0) {
      this.#albedo.paint(renderer, season);
      this.#albedoSeason = season;
    }
  }

  dispose(): void {
    this.#albedo.dispose();
    this.outline.dispose();
    this.height.dispose();
    this.surface.dispose();
    this.water.dispose();
    this.shore.dispose();
  }

  #shoreSource(): ShoreSource {
    const { grid, terrain } = this.#mirror;

    return {
      cellSize: grid.cellSize,
      heights: terrain.height,
      levels: terrain.waterSurface,
      pondDepths: this.#pondDepths,
      size: this.size,
    };
  }

  #measurePondShores(): void {
    const { grid, water } = this.#mirror;

    this.#pondDepths.fill(NOT_POND);

    for (const spring of water.springs) {
      if (spring.kind !== "pond") {
        continue;
      }

      for (const cell of grid.cellsInRadius(spring.x, spring.z, spring.radius + grid.cellSize * POND_SHORE_CELLS)) {
        const reach = pondEdgeReach(spring, grid.cellCenterX(cell), grid.cellCenterZ(cell));

        this.#pondDepths[cell] = Math.min(this.#pondDepths[cell], reach * POND_SHORE_SLOPE);
      }
    }
  }

  #buildShore(): void {
    this.#measurePondShores();
    buildShoreField(this.#shoreSource(), this.#shoreData);
    this.shore.needsUpdate = true;
  }

  #updateShore(region: CellRegion): void {
    updateShoreDepths(this.#shoreSource(), region, this.#shoreData);
    this.shore.needsUpdate = true;
  }
}

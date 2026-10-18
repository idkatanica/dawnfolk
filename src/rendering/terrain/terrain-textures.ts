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
import { buildShoreField, SHORE_CHANNELS, type ShoreSource, updateShoreDepths } from "../water/shore-field.ts";
import type { WorldChanges } from "../world-changes.ts";
import { GroundAlbedo } from "./ground-albedo.ts";

const SEASON_STEP = 0.01;

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
  readonly height: DataTexture;
  readonly shore: DataTexture;
  readonly size: number;
  readonly surface: DataTexture;
  readonly water: DataTexture;
  readonly #albedo: GroundAlbedo;
  readonly #mirror: WorldMirror;
  readonly #shoreData: Float32Array;
  #albedoSeason = Number.NaN;

  constructor(mirror: WorldMirror) {
    const size = mirror.grid.cellsPerSide;

    this.#mirror = mirror;
    this.size = size;
    this.height = floatTexture(mirror.terrain.height, size);
    this.water = floatTexture(mirror.terrain.waterSurface, size);
    this.#shoreData = new Float32Array(size * size * SHORE_CHANNELS);
    this.shore = floatTexture(this.#shoreData, size, RGBAFormat);
    this.#buildShore();
    this.surface = surfaceTexture(mirror.surface, size);
    this.#albedo = new GroundAlbedo(mirror);
  }

  get albedo(): Texture {
    return this.#albedo.texture;
  }

  update(renderer: WebGPURenderer, season: number, changes: WorldChanges): void {
    if (changes.heightRegion !== null) {
      this.height.needsUpdate = true;
    }

    if (changes.hasWaterChanged) {
      this.#buildShore();
    } else if (changes.heightRegion !== null) {
      this.#updateShore(changes.heightRegion);
    }

    if (changes.surfaceRuns.length > 0) {
      this.surface.needsUpdate = true;
    }

    if (changes.hasWaterChanged) {
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
    this.height.dispose();
    this.surface.dispose();
    this.water.dispose();
    this.shore.dispose();
  }

  #shoreSource(): ShoreSource {
    const { grid, terrain } = this.#mirror;

    return { cellSize: grid.cellSize, heights: terrain.height, levels: terrain.waterSurface, size: this.size };
  }

  #buildShore(): void {
    buildShoreField(this.#shoreSource(), this.#shoreData);
    this.shore.needsUpdate = true;
  }

  #updateShore(region: CellRegion): void {
    updateShoreDepths(this.#shoreSource(), region, this.#shoreData);
    this.shore.needsUpdate = true;
  }
}

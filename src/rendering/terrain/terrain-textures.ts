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
import { clamp, lerp } from "../../shared/math.ts";
import type { CellRegion } from "../../world/change-tracking.ts";
import {
  buildShoreField,
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
  #albedoSeason = Number.NaN;

  constructor(mirror: WorldMirror) {
    const size = mirror.grid.cellsPerSide;

    this.#mirror = mirror;
    this.size = size;
    this.height = floatTexture(mirror.terrain.height, size);
    this.outline = new IslandOutline(mirror);
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

  shoreDepthAt(x: number, z: number): number {
    const { grid } = this.#mirror;

    const last = this.size - 1;
    const column = clamp((x + grid.halfSize) / grid.cellSize - 0.5, 0, last - 0.001);
    const row = clamp((z + grid.halfSize) / grid.cellSize - 0.5, 0, last - 0.001);

    const firstColumn = Math.floor(column);
    const firstRow = Math.floor(row);

    const shore = this.#shoreData;
    const { size } = this;

    function depthAt(columnOffset: number, rowOffset: number): number {
      return shore[((firstRow + rowOffset) * size + firstColumn + columnOffset) * SHORE_CHANNELS + ShoreChannel.Depth];
    }

    const near = lerp(depthAt(0, 0), depthAt(1, 0), column - firstColumn);
    const far = lerp(depthAt(0, 1), depthAt(1, 1), column - firstColumn);

    return lerp(near, far, row - firstRow);
  }

  update(renderer: WebGPURenderer, season: number, changes: WorldChanges): void {
    this.bloom.value = bloomFor(season);

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
    this.outline.dispose();
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

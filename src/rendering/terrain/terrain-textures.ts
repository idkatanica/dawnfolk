import {
  ClampToEdgeWrapping,
  DataTexture,
  FloatType,
  LinearFilter,
  NearestFilter,
  type PixelFormat,
  RedFormat,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from "three/webgpu";
import { type Color, GROUNDS, Ground, seasonalGroundColor } from "../../content/grounds.ts";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { lerp, saturate } from "../../shared/math.ts";
import { GROUND_CHANNELS, GroundChannel } from "../../world/agent-buffers.ts";
import type { CellRegion } from "../../world/change-tracking.ts";
import { buildShoreField, SHORE_CHANNELS, type ShoreSource, updateShoreDepths } from "../water/shore-field.ts";
import type { WorldChanges } from "../world-changes.ts";

const BYTE = 255;
const SEASON_STEP = 0.01;
const CROP_COVER = 0.9;

const FIELD_SOIL: Color = [0.4, 0.31, 0.22];
const FIELD_SPROUT: Color = [0.42, 0.55, 0.25];
const FIELD_RIPE: Color = [0.8, 0.67, 0.32];

function floatTexture(data: Float32Array, size: number, format: PixelFormat = RedFormat): DataTexture {
  const texture = new DataTexture(data, size, size, format, FloatType);

  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return texture;
}

function colorTexture(data: Uint8Array, size: number, isSrgb: boolean): DataTexture {
  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);

  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.colorSpace = isSrgb ? SRGBColorSpace : "";
  texture.needsUpdate = true;

  return texture;
}

function toByte(value: number): number {
  return Math.round(saturate(value) * BYTE);
}

function mixColor(from: Color, to: Color, amount: number): Color {
  return [lerp(from[0], to[0], amount), lerp(from[1], to[1], amount), lerp(from[2], to[2], amount)];
}

function grassCover(groundIndex: number, crop: number): number {
  if (groundIndex === Ground.Farm) {
    return crop > 0 ? CROP_COVER : 0;
  }

  return GROUNDS[groundIndex].grass;
}

function cropColor(growth: number): Color {
  if (growth < 0.5) {
    return mixColor(FIELD_SOIL, FIELD_SPROUT, growth / 0.5);
  }

  return mixColor(FIELD_SPROUT, FIELD_RIPE, (growth - 0.5) / 0.5);
}

export class TerrainTextures {
  readonly albedo: DataTexture;
  readonly height: DataTexture;
  readonly shore: DataTexture;
  readonly size: number;
  readonly surface: DataTexture;
  readonly water: DataTexture;
  readonly #albedoData: Uint8Array;
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
    this.surface = colorTexture(mirror.surface, size, false);
    this.#albedoData = new Uint8Array(size * size * 4);
    this.albedo = colorTexture(this.#albedoData, size, true);
  }

  update(season: number, changes: WorldChanges): void {
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

    const hasSeasonChanged = Number.isNaN(this.#albedoSeason) || Math.abs(season - this.#albedoSeason) >= SEASON_STEP;

    if (hasSeasonChanged || changes.groundRuns.length > 0) {
      this.#paintAlbedo(season);
    }
  }

  dispose(): void {
    this.albedo.dispose();
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

  #paintAlbedo(season: number): void {
    const { ground, terrain } = this.#mirror;
    const palette = GROUNDS.map((_, index) => seasonalGroundColor(index, season, 0));
    const data = this.#albedoData;
    const cellCount = this.size * this.size;

    for (let cell = 0; cell < cellCount; cell += 1) {
      const groundIndex = ground[cell * GROUND_CHANNELS + GroundChannel.Ground];
      const crop = ground[cell * GROUND_CHANNELS + GroundChannel.Crop];
      const moisture = saturate(terrain.moisture[cell]);
      const brightness = 1 + terrain.variation[cell] * 0.09;
      const offset = cell * 4;

      const base = this.#baseColor(groundIndex, crop, palette);
      const lushness = lerp(1.04, 0.9, moisture) * brightness;

      data[offset] = toByte(base[0] * lushness);
      data[offset + 1] = toByte(base[1] * (lushness + moisture * 0.04));
      data[offset + 2] = toByte(base[2] * lushness);
      data[offset + 3] = toByte(grassCover(groundIndex, crop));
    }

    this.#albedoSeason = season;
    this.albedo.needsUpdate = true;
  }

  #baseColor(groundIndex: number, crop: number, palette: readonly Color[]): Color {
    if (groundIndex === Ground.Farm) {
      return cropColor(crop / BYTE);
    }

    return palette[groundIndex];
  }
}

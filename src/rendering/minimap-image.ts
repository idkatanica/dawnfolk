import { type Color, GROUNDS, seasonalGroundColor } from "../content/grounds.ts";
import type { WorldMirror } from "../game/world-mirror.ts";
import { clamp } from "../shared/math.ts";
import { GROUND_CHANNELS, GroundChannel } from "../world/agent-buffers.ts";
import { hasWater } from "../world/water.ts";

const BYTE = 255;
const SLOPE_SHADE = 0.26;
const DEEPEST_TINT = 8;
const WATER_SHALLOW: Color = [0.42, 0.66, 0.78];
const WATER_DEEP: Color = [0.16, 0.36, 0.58];

function waterColor(depth: number): Color {
  const amount = clamp(depth / DEEPEST_TINT, 0, 1);

  return [
    WATER_SHALLOW[0] + (WATER_DEEP[0] - WATER_SHALLOW[0]) * amount,
    WATER_SHALLOW[1] + (WATER_DEEP[1] - WATER_SHALLOW[1]) * amount,
    WATER_SHALLOW[2] + (WATER_DEEP[2] - WATER_SHALLOW[2]) * amount,
  ];
}

function slopeShade(mirror: WorldMirror, column: number, row: number): number {
  const { grid, terrain } = mirror;

  const last = grid.cellsPerSide - 1;
  const height = terrain.height[grid.index(column, row)];

  const east = terrain.height[grid.index(Math.min(last, column + 1), row)];
  const south = terrain.height[grid.index(column, Math.min(last, row + 1))];

  const slope = (height - east + height - south) / grid.cellSize;

  return clamp(1 + slope * SLOPE_SHADE, 0.6, 1.25);
}

function cellColor(mirror: WorldMirror, palette: readonly Color[], cell: number): Color {
  const { ground, terrain } = mirror;

  const level = terrain.waterSurface[cell];
  const height = terrain.height[cell];

  if (hasWater(level, height)) {
    return waterColor(level - height);
  }

  return palette[ground[cell * GROUND_CHANNELS + GroundChannel.Ground]];
}

export function paintMinimapTerrain(mirror: WorldMirror, size: number): ImageData {
  const { frame, grid } = mirror;

  const image = new ImageData(size, size);
  const palette = GROUNDS.map((_, index) => seasonalGroundColor(index, frame.calendar.season, 0));
  const last = grid.cellsPerSide - 1;

  for (let pixelRow = 0; pixelRow < size; pixelRow += 1) {
    for (let pixelColumn = 0; pixelColumn < size; pixelColumn += 1) {
      const column = Math.min(last, Math.floor((pixelColumn / size) * grid.cellsPerSide));
      const row = Math.min(last, Math.floor((pixelRow / size) * grid.cellsPerSide));
      const offset = (pixelRow * size + pixelColumn) * 4;

      const color = cellColor(mirror, palette, grid.index(column, row));
      const shade = slopeShade(mirror, column, row);

      image.data[offset] = clamp(color[0] * shade, 0, 1) * BYTE;
      image.data[offset + 1] = clamp(color[1] * shade, 0, 1) * BYTE;
      image.data[offset + 2] = clamp(color[2] * shade, 0, 1) * BYTE;
      image.data[offset + 3] = BYTE;
    }
  }

  return image;
}

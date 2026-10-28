import {
  abs,
  clamp,
  Fn,
  float,
  floor,
  If,
  ivec2,
  max,
  mx_noise_float,
  pow,
  select,
  texture,
  textureLoad,
  vec2,
  vec3,
} from "three/tsl";
import type { Node } from "three/webgpu";
import type { WorldGrid } from "../../world/world-grid.ts";
import type { TerrainTextures } from "./terrain-textures.ts";

export const POOL_BANK = 0.1;

const ROUNDNESS = 3;
const WARP = 0.09;
const WARP_SCALE = 0.25;
const POOL_FLAG = 0.5;
const NO_POOL = -1;

export function poolReachNode(textures: TerrainTextures, grid: WorldGrid, point: Node<"vec2">): Node<"float"> {
  const last = grid.cellsPerSide - 1;
  const nearPool = texture(textures.wetland, point.add(grid.halfSize).div(grid.worldSize)).level(float(0)).g;

  return Fn(() => {
    const reach = float(NO_POOL).toVar();

    If(nearPool.greaterThan(0), () => {
      const warp = vec2(
        mx_noise_float(vec3(point.mul(WARP_SCALE), 1.7)),
        mx_noise_float(vec3(point.mul(WARP_SCALE), 6.3))
      );
      const cellCoordinate = point.add(grid.halfSize).div(grid.cellSize).add(warp.mul(WARP));

      const cell = clamp(floor(cellCoordinate), vec2(0, 0), vec2(last, last));
      const local = cellCoordinate.sub(cell).sub(0.5);

      function isPoolAt(column: number, row: number): Node<"bool"> {
        const neighbor = clamp(cell.add(vec2(column, row)), vec2(0, 0), vec2(last, last));

        return textureLoad(textures.wetland, ivec2(neighbor)).g.greaterThan(POOL_FLAG);
      }

      If(isPoolAt(0, 0), () => {
        const towardX = select(local.x.greaterThan(0), isPoolAt(1, 0), isPoolAt(-1, 0));
        const towardZ = select(local.y.greaterThan(0), isPoolAt(0, 1), isPoolAt(0, -1));

        const alongX = select(towardX, float(0), abs(local.x));
        const alongZ = select(towardZ, float(0), abs(local.y));

        const distance = pow(pow(alongX, ROUNDNESS).add(pow(alongZ, ROUNDNESS)), 1 / ROUNDNESS);

        reach.assign(max(float(0.5).sub(distance), 0));
      });
    });

    return reach;
  })();
}

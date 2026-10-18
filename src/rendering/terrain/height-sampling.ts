import { clamp, floor, ivec2, mix, textureLoad, vec2 } from "three/tsl";
import type { DataTexture, Node } from "three/webgpu";
import type { WorldGrid } from "../../world/world-grid.ts";

export function sampleHeightNode(heights: DataTexture, grid: WorldGrid, point: Node<"vec2">): Node<"float"> {
  const last = grid.cellsPerSide - 1;
  const cellCoordinate = point.add(grid.halfSize).div(grid.cellSize).sub(0.5);

  const base = floor(cellCoordinate);

  const fraction = cellCoordinate.sub(base);

  function heightAt(column: number, row: number) {
    return textureLoad(heights, ivec2(clamp(base.add(vec2(column, row)), vec2(0, 0), vec2(last, last)))).x;
  }

  const near = mix(heightAt(0, 0), heightAt(1, 0), fraction.x);
  const far = mix(heightAt(0, 1), heightAt(1, 1), fraction.x);

  return mix(near, far, fraction.y);
}

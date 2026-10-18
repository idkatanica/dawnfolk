import type { Group, MeshStandardNodeMaterial, PerspectiveCamera } from "three/webgpu";
import type { WorldMirror } from "../../game/world-mirror.ts";
import { NO_WATER } from "../../world/water.ts";
import { type HeightRange, type PatchCorner, PatchGrid } from "../terrain/patch-grid.ts";
import { PATCH_LEVEL_DISTANCES } from "../terrain/terrain-patches.ts";
import type { TerrainTextures } from "../terrain/terrain-textures.ts";
import { createWaterMaterial, WaterLook } from "./water-material.ts";

const LEVEL_DISTANCES: readonly number[] = PATCH_LEVEL_DISTANCES;
const NEIGHBOR_MARGIN = 1;
const WAVE_ALLOWANCE = 4;

export class WaterView {
  readonly look = new WaterLook();
  readonly material: MeshStandardNodeMaterial;
  readonly #mirror: WorldMirror;
  readonly #patches: PatchGrid;

  constructor(mirror: WorldMirror, textures: TerrainTextures) {
    this.#mirror = mirror;
    this.material = createWaterMaterial(textures, mirror.grid, this.look);
    this.#patches = new PatchGrid(mirror.grid, (corner) => this.#measure(corner), {
      castsShadow: false,
      edges: "open",
      levelDistances: LEVEL_DISTANCES,
      material: this.material,
      renderOrder: 2,
    });
  }

  get group(): Group {
    return this.#patches.group;
  }

  waterChanged(): void {
    this.#patches.remeasure(null);
  }

  update(camera: PerspectiveCamera, detail: number, terrainLevels: Readonly<Int8Array>): void {
    this.#patches.update(camera, detail, terrainLevels);
  }

  dispose(): void {
    this.#patches.dispose();
    this.material.dispose();
  }

  #measure(corner: PatchCorner): HeightRange | null {
    const { grid, terrain } = this.#mirror;
    const firstColumn = Math.max(0, corner.firstColumn - NEIGHBOR_MARGIN);
    const firstRow = Math.max(0, corner.firstRow - NEIGHBOR_MARGIN);

    const lastColumn = Math.min(grid.cellsPerSide - 1, corner.lastColumn + NEIGHBOR_MARGIN);
    const lastRow = Math.min(grid.cellsPerSide - 1, corner.lastRow + NEIGHBOR_MARGIN);

    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;

    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        const level = terrain.waterSurface[grid.index(column, row)];

        if (level !== NO_WATER) {
          lowest = Math.min(lowest, level);
          highest = Math.max(highest, level);
        }
      }
    }

    if (lowest > highest) {
      return null;
    }

    return { highest: highest + WAVE_ALLOWANCE, lowest: lowest - WAVE_ALLOWANCE };
  }
}

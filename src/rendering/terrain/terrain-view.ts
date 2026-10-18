import type { Group, MeshStandardNodeMaterial, PerspectiveCamera, WebGPURenderer } from "three/webgpu";
import type { WorldMirror } from "../../game/world-mirror.ts";
import type { CellRegion } from "../../world/change-tracking.ts";
import type { FireGlow } from "../effects/fire-glow.ts";
import { GroundWarp } from "./ground-warp.ts";
import { islandPlinthHeight } from "./island-base-geometry.ts";
import { type HeightRange, type PatchCorner, PatchGrid } from "./patch-grid.ts";
import { createTerrainMaterial } from "./terrain-material.ts";
import { PATCH_LEVEL_DISTANCES } from "./terrain-patches.ts";
import type { TerrainTextures } from "./terrain-textures.ts";

const SKIRT_ALLOWANCE = 220;

export class TerrainView {
  readonly #material: MeshStandardNodeMaterial;
  readonly #mirror: WorldMirror;
  readonly #patches: PatchGrid;
  readonly #warp: GroundWarp;

  constructor(mirror: WorldMirror, textures: TerrainTextures, glow: FireGlow, renderer: WebGPURenderer) {
    this.#mirror = mirror;
    this.#warp = new GroundWarp(mirror.grid);
    this.#warp.bake(renderer);
    this.#material = createTerrainMaterial({
      glow,
      grid: mirror.grid,
      plinth: islandPlinthHeight(mirror, textures.outline),
      textures,
      warp: this.#warp,
    });
    this.#patches = new PatchGrid(mirror.grid, (corner) => this.#measure(corner), {
      castsShadow: true,
      edges: "skirted",
      levelDistances: PATCH_LEVEL_DISTANCES,
      material: this.#material,
      renderOrder: 0,
    });
  }

  get group(): Group {
    return this.#patches.group;
  }

  get patchLevels(): Readonly<Int8Array> {
    return this.#patches.chosenLevels;
  }

  heightsChanged(region: CellRegion): void {
    this.#patches.remeasure(region);
  }

  update(camera: PerspectiveCamera, detail: number): void {
    this.#patches.update(camera, detail);
  }

  dispose(): void {
    this.#patches.dispose();
    this.#material.dispose();
    this.#warp.dispose();
  }

  #measure(corner: PatchCorner): HeightRange {
    const { grid, terrain } = this.#mirror;

    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;

    for (let row = corner.firstRow; row <= corner.lastRow; row += 1) {
      for (let column = corner.firstColumn; column <= corner.lastColumn; column += 1) {
        const height = terrain.height[grid.index(column, row)];

        lowest = Math.min(lowest, height);
        highest = Math.max(highest, height);
      }
    }

    return { highest, lowest: lowest - SKIRT_ALLOWANCE };
  }
}

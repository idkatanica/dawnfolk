import type { Group, MeshStandardNodeMaterial, PerspectiveCamera } from "three/webgpu";
import type { WorldMirror } from "../../game/world-mirror.ts";
import type { CellRegion } from "../../world/change-tracking.ts";
import type { FireGlow } from "../effects/fire-glow.ts";
import { type HeightRange, type PatchCorner, PatchGrid } from "./patch-grid.ts";
import { createTerrainMaterial } from "./terrain-material.ts";
import { PATCH_LEVEL_DISTANCES } from "./terrain-patches.ts";
import type { TerrainTextures } from "./terrain-textures.ts";

const SKIRT_ALLOWANCE = 220;

export class TerrainView {
  readonly material: MeshStandardNodeMaterial;
  readonly #mirror: WorldMirror;
  readonly #patches: PatchGrid;

  constructor(mirror: WorldMirror, textures: TerrainTextures, glow: FireGlow) {
    this.#mirror = mirror;
    this.material = createTerrainMaterial(textures, mirror.grid, glow);
    this.#patches = new PatchGrid(mirror.grid, (corner) => this.#measure(corner), {
      castsShadow: true,
      edges: "skirted",
      levelDistances: PATCH_LEVEL_DISTANCES,
      material: this.material,
      renderOrder: 0,
    });
  }

  get group(): Group {
    return this.#patches.group;
  }

  heightsChanged(region: CellRegion): void {
    this.#patches.remeasure(region);
  }

  get patchLevels(): Readonly<Int8Array> {
    return this.#patches.chosenLevels;
  }

  update(camera: PerspectiveCamera, detail: number): void {
    this.#patches.update(camera, detail);
  }

  dispose(): void {
    this.#patches.dispose();
    this.material.dispose();
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

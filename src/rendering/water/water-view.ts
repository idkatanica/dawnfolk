import type { Frustum, Group, MeshStandardNodeMaterial, PerspectiveCamera } from "three/webgpu";
import type { WorldMirror } from "../../game/world-mirror.ts";
import type { CellRegion } from "../../world/change-tracking.ts";
import { NO_WATER } from "../../world/water.ts";
import { type HeightRange, type PatchContent, PatchGrid, type PatchPiece } from "../terrain/patch-grid.ts";
import type { TerrainTextures } from "../terrain/terrain-textures.ts";
import { createWaterMaterial, WaterLook } from "./water-material.ts";

const NEIGHBOR_MARGIN = 1;
const WAVE_ALLOWANCE = 4;
const PIECE_CELLS = 16;

export class WaterView {
  readonly look = new WaterLook();
  readonly #material: MeshStandardNodeMaterial;
  readonly #mirror: WorldMirror;
  readonly #patches: PatchGrid;

  constructor(mirror: WorldMirror, textures: TerrainTextures) {
    this.#mirror = mirror;
    this.#material = createWaterMaterial(textures, mirror.grid, this.look);
    this.#patches = new PatchGrid(mirror.grid, (region) => this.#measure(region), {
      castsShadow: false,
      edges: "open",
      materials: [this.#material],
      pieceCells: PIECE_CELLS,
      renderOrder: 2,
    });
  }

  get group(): Group {
    return this.#patches.group;
  }

  waterChanged(region: CellRegion | null): void {
    this.#patches.remeasure(region);
  }

  update(camera: PerspectiveCamera, frustum: Frustum, detail: number, terrainLevels: Readonly<Int8Array>): void {
    this.#patches.update(camera, frustum, detail, terrainLevels);
  }

  dispose(): void {
    this.#patches.dispose();
    this.#material.dispose();
  }

  #measure(region: CellRegion): PatchContent | null {
    const { firstColumn, firstRow, lastColumn, lastRow } = region;

    const pieces: PatchPiece[] = [];

    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;

    for (let row = firstRow; row < lastRow; row += PIECE_CELLS) {
      for (let column = firstColumn; column < lastColumn; column += PIECE_CELLS) {
        const range = this.#levelsAround({
          firstColumn: column,
          firstRow: row,
          lastColumn: column + PIECE_CELLS,
          lastRow: row + PIECE_CELLS,
        });

        if (range !== null) {
          pieces.push({ firstColumn: column, firstRow: row, material: 0 });
          lowest = Math.min(lowest, range.lowest);
          highest = Math.max(highest, range.highest);
        }
      }
    }

    if (pieces.length === 0) {
      return null;
    }

    return { highest: highest + WAVE_ALLOWANCE, lowest: lowest - WAVE_ALLOWANCE, pieces };
  }

  #levelsAround(region: CellRegion): HeightRange | null {
    const { grid, terrain } = this.#mirror;

    const firstColumn = Math.max(0, region.firstColumn - NEIGHBOR_MARGIN);
    const firstRow = Math.max(0, region.firstRow - NEIGHBOR_MARGIN);
    const lastColumn = Math.min(grid.cellsPerSide - 1, region.lastColumn + NEIGHBOR_MARGIN);
    const lastRow = Math.min(grid.cellsPerSide - 1, region.lastRow + NEIGHBOR_MARGIN);

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

    return { highest, lowest };
  }
}

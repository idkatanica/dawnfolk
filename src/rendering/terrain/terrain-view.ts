import {
  Group,
  type Material,
  type MeshStandardNodeMaterial,
  type PerspectiveCamera,
  type WebGPURenderer,
} from "three/webgpu";
import type { WorldMirror } from "../../game/world-mirror.ts";
import type { CellRegion } from "../../world/change-tracking.ts";
import type { FireGlow } from "../effects/fire-glow.ts";
import { GroundWarp } from "./ground-warp.ts";
import { islandPlinthHeight } from "./island-base-geometry.ts";
import type { GroundArea, IslandOutline } from "./island-outline.ts";
import { type HeightRange, type PatchContent, type PatchCorner, PatchGrid, type PatchPiece } from "./patch-grid.ts";
import { createTerrainMaterial } from "./terrain-material.ts";
import { PATCH_CELLS, PATCH_LEVEL_DISTANCES } from "./terrain-patches.ts";
import type { TerrainTextures } from "./terrain-textures.ts";

const SKIRT_ALLOWANCE = 220;
const COAST_PIECE_CELLS = 16;

const TerrainMaterial = {
  Coastal: 1,
  Inland: 0,
} as const;

export class TerrainView {
  readonly group = new Group();
  readonly #coast: PatchGrid | null;
  readonly #inland: PatchGrid;
  readonly #levels: Int8Array;
  readonly #materials: readonly MeshStandardNodeMaterial[];
  readonly #mirror: WorldMirror;
  readonly #outline: IslandOutline;
  readonly #warp: GroundWarp;

  constructor(mirror: WorldMirror, textures: TerrainTextures, glow: FireGlow, renderer: WebGPURenderer) {
    const { grid } = mirror;

    this.#mirror = mirror;
    this.#outline = textures.outline;
    this.#warp = new GroundWarp(grid);
    this.#warp.bake(renderer);

    const options = {
      glow,
      grid,
      plinth: islandPlinthHeight(mirror, textures.outline),
      textures,
      warp: this.#warp,
    };

    const patchesPerSide = Math.ceil(grid.cellsPerSide / PATCH_CELLS);
    const inland = createTerrainMaterial({ ...options, cutsAtCoast: false });

    this.#levels = new Int8Array(patchesPerSide * patchesPerSide);
    this.#inland = this.#createGrid((corner) => this.#measureInland(corner), [inland], PATCH_CELLS);

    if (!textures.outline.hasCoast) {
      this.#materials = [inland];
      this.#coast = null;

      return;
    }

    this.#materials = [inland, createTerrainMaterial({ ...options, cutsAtCoast: true })];
    this.#coast = this.#createGrid((corner) => this.#measureCoast(corner), this.#materials, COAST_PIECE_CELLS);
  }

  get patchLevels(): Readonly<Int8Array> {
    return this.#levels;
  }

  heightsChanged(region: CellRegion): void {
    this.#inland.remeasure(region);

    if (this.#coast !== null) {
      this.#coast.remeasure(region);
    }
  }

  update(camera: PerspectiveCamera, detail: number): void {
    this.#inland.update(camera, detail);
    this.#levels.set(this.#inland.chosenLevels);

    if (this.#coast === null) {
      return;
    }

    this.#coast.update(camera, detail);

    for (const [patch, level] of this.#coast.chosenLevels.entries()) {
      if (level >= 0) {
        this.#levels[patch] = level;
      }
    }
  }

  dispose(): void {
    this.#inland.dispose();
    this.#warp.dispose();

    if (this.#coast !== null) {
      this.#coast.dispose();
    }

    for (const material of this.#materials) {
      material.dispose();
    }
  }

  #createGrid(
    measure: (corner: PatchCorner) => PatchContent | null,
    materials: readonly Material[],
    pieceCells: number
  ): PatchGrid {
    const patches = new PatchGrid(this.#mirror.grid, measure, {
      castsShadow: true,
      edges: "skirted",
      levelDistances: PATCH_LEVEL_DISTANCES,
      materials,
      pieceCells,
      renderOrder: 0,
    });

    this.group.add(patches.group);

    return patches;
  }

  #measureInland(corner: PatchCorner): PatchContent | null {
    if (this.#outline.sideOf(this.#areaOf(corner), this.#mirror.grid.cellSize) !== "inside") {
      return null;
    }

    const piece = { firstColumn: corner.firstColumn, firstRow: corner.firstRow, material: TerrainMaterial.Inland };

    return { ...this.#heightsOf(corner), pieces: [piece] };
  }

  #measureCoast(corner: PatchCorner): PatchContent | null {
    const { cellSize } = this.#mirror.grid;

    if (this.#outline.sideOf(this.#areaOf(corner), cellSize) !== "across") {
      return null;
    }

    const pieces: PatchPiece[] = [];

    for (let row = corner.firstRow; row < corner.lastRow; row += COAST_PIECE_CELLS) {
      for (let column = corner.firstColumn; column < corner.lastColumn; column += COAST_PIECE_CELLS) {
        const piece = {
          firstColumn: column,
          firstRow: row,
          lastColumn: column + COAST_PIECE_CELLS,
          lastRow: row + COAST_PIECE_CELLS,
        };

        const side = this.#outline.sideOf(this.#areaOf(piece), cellSize);

        if (side !== "outside") {
          const material = side === "inside" ? TerrainMaterial.Inland : TerrainMaterial.Coastal;

          pieces.push({ firstColumn: column, firstRow: row, material });
        }
      }
    }

    if (pieces.length === 0) {
      return null;
    }

    return { ...this.#heightsOf(corner), pieces };
  }

  #areaOf(corner: PatchCorner): GroundArea {
    const { grid } = this.#mirror;

    const last = grid.cellsPerSide - 1;

    return {
      maximumX: grid.centerX(Math.min(last, corner.lastColumn)),
      maximumZ: grid.centerZ(Math.min(last, corner.lastRow)),
      minimumX: grid.centerX(corner.firstColumn),
      minimumZ: grid.centerZ(corner.firstRow),
    };
  }

  #heightsOf(corner: PatchCorner): HeightRange {
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

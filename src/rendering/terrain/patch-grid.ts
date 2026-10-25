import {
  Box3,
  type Frustum,
  Group,
  InstancedBufferAttribute,
  type InstancedBufferGeometry,
  type Material,
  Mesh,
  type PerspectiveCamera,
} from "three/webgpu";
import type { CellRegion } from "../../world/change-tracking.ts";
import type { WorldGrid } from "../../world/world-grid.ts";
import { toInstancedGeometry } from "../instancing.ts";
import {
  createPatchGeometry,
  PATCH_CELLS,
  PATCH_LEVEL_DISTANCES,
  PATCH_STEPS,
  type PatchEdges,
  type PatchStep,
} from "./terrain-patches.ts";

const NO_LEVEL = -1;

interface PatchGridOptions {
  readonly castsShadow: boolean;
  readonly edges: PatchEdges;
  readonly materials: readonly Material[];
  readonly pieceCells: number;
  readonly renderOrder: number;
}

export interface HeightRange {
  readonly highest: number;
  readonly lowest: number;
}

export interface PatchCorner {
  readonly firstColumn: number;
  readonly firstRow: number;
  readonly lastColumn: number;
  readonly lastRow: number;
}

export interface PatchPiece {
  readonly firstColumn: number;
  readonly firstRow: number;
  readonly material: number;
}

export interface PatchContent extends HeightRange {
  readonly pieces: readonly PatchPiece[];
}

interface Patch {
  readonly bounds: Box3;
  readonly corner: PatchCorner;
  pieces: readonly PatchPiece[];
}

interface PatchLevel {
  readonly geometry: InstancedBufferGeometry;
  readonly mesh: Mesh;
  readonly origins: InstancedBufferAttribute;
}

type PatchMeasure = (corner: PatchCorner) => PatchContent | null;

function overlaps(region: CellRegion, corner: PatchCorner): boolean {
  return (
    region.lastColumn >= corner.firstColumn - 1 &&
    region.firstColumn <= corner.lastColumn + 1 &&
    region.lastRow >= corner.firstRow - 1 &&
    region.firstRow <= corner.lastRow + 1
  );
}

export class PatchGrid {
  readonly group = new Group();
  readonly #chosenLevels: Int8Array;
  readonly #counts: number[][];
  readonly #grid: WorldGrid;
  readonly #levels: readonly (readonly PatchLevel[])[];
  readonly #measure: PatchMeasure;
  readonly #patches: Patch[] = [];
  readonly #previousLevels: Int8Array;

  constructor(grid: WorldGrid, measure: PatchMeasure, options: PatchGridOptions) {
    const patchesPerSide = Math.ceil(grid.cellsPerSide / PATCH_CELLS);
    const piecesPerPatch = (PATCH_CELLS / options.pieceCells) ** 2;

    const patchCount = patchesPerSide * patchesPerSide;

    this.#grid = grid;
    this.#measure = measure;
    this.#levels = options.materials.map((material) =>
      PATCH_STEPS.map((step) => this.#createLevel(step, material, patchCount * piecesPerPatch, options))
    );
    this.#counts = this.#levels.map((levels) => levels.map(() => 0));
    this.#chosenLevels = new Int8Array(patchCount).fill(NO_LEVEL);
    this.#previousLevels = new Int8Array(patchCount).fill(NO_LEVEL);

    for (let row = 0; row < patchesPerSide; row += 1) {
      for (let column = 0; column < patchesPerSide; column += 1) {
        this.#patches.push(this.#createPatch(column, row));
      }
    }
  }

  get chosenLevels(): Readonly<Int8Array> {
    return this.#chosenLevels;
  }

  remeasure(region: CellRegion | null): void {
    for (const patch of this.#patches) {
      if (region === null || overlaps(region, patch.corner)) {
        this.#measurePatch(patch);
      }
    }
  }

  update(camera: PerspectiveCamera, frustum: Frustum, detail: number, sharedLevels?: Readonly<Int8Array>): void {
    this.#previousLevels.set(this.#chosenLevels);
    this.#chosenLevels.fill(NO_LEVEL);

    for (const counts of this.#counts) {
      counts.fill(0);
    }

    for (const [index, patch] of this.#patches.entries()) {
      if (!this.#isVisible(patch, frustum)) {
        continue;
      }

      const shared = sharedLevels === undefined ? NO_LEVEL : sharedLevels[index];
      const level =
        shared === NO_LEVEL ? this.#levelFor(patch.bounds.distanceToPoint(camera.position), detail) : shared;

      this.#chosenLevels[index] = level;

      for (const piece of patch.pieces) {
        this.#place(piece, level);
      }
    }

    const hasChanged = this.#chosenLevels.some((level, index) => level !== this.#previousLevels[index]);

    for (const [material, levels] of this.#levels.entries()) {
      for (const [index, level] of levels.entries()) {
        const count = this.#counts[material][index];

        level.geometry.instanceCount = count;
        level.mesh.visible = count > 0;

        if (hasChanged) {
          level.origins.needsUpdate = true;
        }
      }
    }
  }

  dispose(): void {
    for (const levels of this.#levels) {
      for (const level of levels) {
        level.geometry.dispose();
      }
    }
  }

  #isVisible(patch: Patch, frustum: Frustum): boolean {
    return patch.pieces.length > 0 && frustum.intersectsBox(patch.bounds);
  }

  #levelFor(distance: number, detail: number): number {
    const index = PATCH_LEVEL_DISTANCES.findIndex((limit) => distance < limit * detail);

    if (index === -1) {
      return PATCH_STEPS.length - 1;
    }

    return index;
  }

  #place(piece: PatchPiece, level: number): void {
    const counts = this.#counts[piece.material];

    const slot = counts[level];

    this.#levels[piece.material][level].origins.setXY(slot, piece.firstColumn, piece.firstRow);
    counts[level] = slot + 1;
  }

  #createLevel(step: PatchStep, material: Material, capacity: number, options: PatchGridOptions): PatchLevel {
    const geometry = toInstancedGeometry(createPatchGeometry(options.pieceCells, step, options.edges));
    const origins = new InstancedBufferAttribute(new Float32Array(capacity * 2), 2);

    geometry.setAttribute("origin", origins);
    geometry.instanceCount = 0;

    const mesh = new Mesh(geometry, material);

    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.castShadow = options.castsShadow;
    mesh.renderOrder = options.renderOrder;
    this.group.add(mesh);

    return { geometry, mesh, origins };
  }

  #createPatch(column: number, row: number): Patch {
    const last = this.#grid.cellsPerSide - 1;
    const firstColumn = column * PATCH_CELLS;
    const firstRow = row * PATCH_CELLS;

    const corner = {
      firstColumn,
      firstRow,
      lastColumn: Math.min(last, firstColumn + PATCH_CELLS),
      lastRow: Math.min(last, firstRow + PATCH_CELLS),
    };

    const patch: Patch = { bounds: new Box3(), corner, pieces: [] };

    this.#measurePatch(patch);

    return patch;
  }

  #measurePatch(patch: Patch): void {
    const content = this.#measure(patch.corner);

    for (const levels of this.#levels) {
      for (const level of levels) {
        level.origins.needsUpdate = true;
      }
    }

    if (content === null) {
      patch.pieces = [];

      return;
    }

    const grid = this.#grid;
    const { corner } = patch;

    patch.pieces = content.pieces;
    patch.bounds.min.set(grid.centerX(corner.firstColumn), content.lowest, grid.centerZ(corner.firstRow));
    patch.bounds.max.set(grid.centerX(corner.lastColumn), content.highest, grid.centerZ(corner.lastRow));
  }
}

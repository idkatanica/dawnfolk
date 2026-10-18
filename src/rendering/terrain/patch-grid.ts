import {
  Box3,
  Frustum,
  Group,
  InstancedBufferAttribute,
  type InstancedBufferGeometry,
  type Material,
  Matrix4,
  Mesh,
  type PerspectiveCamera,
} from "three/webgpu";
import type { CellRegion } from "../../world/change-tracking.ts";
import type { WorldGrid } from "../../world/world-grid.ts";
import { toInstancedGeometry } from "../instancing.ts";
import { createPatchGeometry, PATCH_CELLS, PATCH_STEPS, type PatchEdges, type PatchStep } from "./terrain-patches.ts";

const NO_LEVEL = -1;

export interface PatchGridOptions {
  readonly castsShadow: boolean;
  readonly edges: PatchEdges;
  readonly levelDistances: readonly number[];
  readonly material: Material;
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

interface Patch {
  readonly bounds: Box3;
  readonly corner: PatchCorner;
  isPresent: boolean;
}

interface PatchLevel {
  readonly geometry: InstancedBufferGeometry;
  readonly mesh: Mesh;
  readonly origins: InstancedBufferAttribute;
}

export type PatchMeasure = (corner: PatchCorner) => HeightRange | null;

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
  readonly #counts: number[];
  readonly #frustum = new Frustum();
  readonly #chosenLevels: Int8Array;
  readonly #previousLevels: Int8Array;
  readonly #grid: WorldGrid;
  readonly #levelDistances: readonly number[];
  readonly #levels: readonly PatchLevel[];
  readonly #matrix = new Matrix4();
  readonly #measure: PatchMeasure;
  readonly #patches: Patch[] = [];

  constructor(grid: WorldGrid, measure: PatchMeasure, options: PatchGridOptions) {
    const patchesPerSide = Math.ceil(grid.cellsPerSide / PATCH_CELLS);

    const patchCount = patchesPerSide * patchesPerSide;

    this.#grid = grid;
    this.#measure = measure;
    this.#levelDistances = options.levelDistances;
    this.#levels = PATCH_STEPS.map((step) => this.#createLevel(step, patchCount, options));
    this.#counts = this.#levels.map(() => 0);
    this.#chosenLevels = new Int8Array(patchCount).fill(NO_LEVEL);
    this.#previousLevels = new Int8Array(patchCount).fill(NO_LEVEL);

    for (let row = 0; row < patchesPerSide; row += 1) {
      for (let column = 0; column < patchesPerSide; column += 1) {
        this.#patches.push(this.#createPatch(column, row));
      }
    }
  }

  remeasure(region: CellRegion | null): void {
    for (const patch of this.#patches) {
      if (region === null || overlaps(region, patch.corner)) {
        this.#measurePatch(patch);
      }
    }
  }

  get chosenLevels(): Readonly<Int8Array> {
    return this.#chosenLevels;
  }

  update(camera: PerspectiveCamera, detail: number, sharedLevels?: Readonly<Int8Array>): void {
    this.#previousLevels.set(this.#chosenLevels);
    this.#counts.fill(0);
    this.#chosenLevels.fill(NO_LEVEL);
    this.#frustum.setFromProjectionMatrix(
      this.#matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    );

    for (const [index, patch] of this.#patches.entries()) {
      if (!this.#isVisible(patch)) {
        continue;
      }

      const shared = sharedLevels?.[index] ?? NO_LEVEL;
      const level =
        shared === NO_LEVEL ? this.#levelFor(patch.bounds.distanceToPoint(camera.position), detail) : shared;

      this.#chosenLevels[index] = level;

      const slot = this.#counts[level];

      this.#levels[level].origins.setXY(slot, patch.corner.firstColumn, patch.corner.firstRow);
      this.#counts[level] = slot + 1;
    }

    const hasChanged = this.#chosenLevels.some((level, index) => level !== this.#previousLevels[index]);

    for (const [index, level] of this.#levels.entries()) {
      level.geometry.instanceCount = this.#counts[index];
      level.mesh.visible = this.#counts[index] > 0;

      if (hasChanged) {
        level.origins.needsUpdate = true;
      }
    }
  }

  dispose(): void {
    for (const level of this.#levels) {
      level.geometry.dispose();
    }
  }

  #isVisible(patch: Patch): boolean {
    return patch.isPresent && this.#frustum.intersectsBox(patch.bounds);
  }

  #levelFor(distance: number, detail: number): number {
    const index = this.#levelDistances.findIndex((limit) => distance < limit * detail);

    if (index === -1) {
      return this.#levels.length - 1;
    }

    return index;
  }

  #createLevel(step: PatchStep, patchCount: number, options: PatchGridOptions): PatchLevel {
    const geometry = toInstancedGeometry(createPatchGeometry(step, options.edges));
    const origins = new InstancedBufferAttribute(new Float32Array(patchCount * 2), 2);

    geometry.setAttribute("origin", origins);
    geometry.instanceCount = 0;

    const mesh = new Mesh(geometry, options.material);

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

    const patch = { bounds: new Box3(), corner, isPresent: false };

    this.#measurePatch(patch);

    return patch;
  }

  #measurePatch(patch: Patch): void {
    const range = this.#measure(patch.corner);

    if (range === null) {
      patch.isPresent = false;

      return;
    }

    const grid = this.#grid;
    const { corner } = patch;

    patch.isPresent = true;
    patch.bounds.min.set(grid.centerX(corner.firstColumn), range.lowest, grid.centerZ(corner.firstRow));
    patch.bounds.max.set(grid.centerX(corner.lastColumn), range.highest, grid.centerZ(corner.lastRow));
  }
}

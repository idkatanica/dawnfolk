import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from "three/webgpu";

export const PATCH_CELLS = 64;

export const PATCH_STEPS = [1, 2, 4, 8] as const;

export const PATCH_LEVEL_DISTANCES: readonly number[] = [650, 1400, 2700];

export type PatchStep = (typeof PATCH_STEPS)[number];

export type PatchEdges = "open" | "skirted";

interface GridVertexWriter {
  readonly axes: number[];
  readonly cells: number[];
  readonly centers: number[];
  readonly skirts: number[];
}

type BorderPoint = readonly [column: number, row: number, axis: number];

const COLUMN_AXIS = 0;
const ROW_AXIS = 1;

function vertexIndex(
  writer: GridVertexWriter,
  column: number,
  row: number,
  skirt: number,
  axis: number,
  center = 0
): number {
  writer.cells.push(column, row);
  writer.centers.push(center);
  writer.skirts.push(skirt);
  writer.axes.push(axis);

  return writer.skirts.length - 1;
}

function borderPath(cells: number, step: number): BorderPoint[] {
  const path: BorderPoint[] = [];
  const steps = cells / step;

  for (let index = 0; index < steps; index += 1) {
    path.push([index * step, 0, ROW_AXIS]);
  }

  for (let index = 0; index < steps; index += 1) {
    path.push([cells, index * step, COLUMN_AXIS]);
  }

  for (let index = steps; index > 0; index -= 1) {
    path.push([index * step, cells, ROW_AXIS]);
  }

  for (let index = steps; index > 0; index -= 1) {
    path.push([0, index * step, COLUMN_AXIS]);
  }

  return path;
}

function upNormals(count: number): Float32Array {
  const normals = new Float32Array(count * 3);

  for (let vertex = 0; vertex < count; vertex += 1) {
    normals[vertex * 3 + 1] = 1;
  }

  return normals;
}

function addSkirts(writer: GridVertexWriter, indices: number[], cells: number, step: PatchStep): void {
  const side = cells / step + 1;
  const path = borderPath(cells, step);

  for (let index = 0; index < path.length; index += 1) {
    const [startColumn, startRow, axis] = path[index];
    const [endColumn, endRow] = path[(index + 1) % path.length];

    const top = (startRow / step) * side + startColumn / step;
    const nextTop = (endRow / step) * side + endColumn / step;
    const bottom = vertexIndex(writer, startColumn, startRow, step, axis);
    const nextBottom = vertexIndex(writer, endColumn, endRow, step, axis);

    indices.push(top, bottom, nextTop, nextTop, bottom, nextBottom);
    indices.push(top, nextTop, bottom, nextTop, nextBottom, bottom);
  }
}

export function createPatchGeometry(cells: number, step: PatchStep, edges: PatchEdges): BufferGeometry {
  const writer: GridVertexWriter = { axes: [], cells: [], centers: [], skirts: [] };
  const indices: number[] = [];
  const steps = cells / step;

  const side = steps + 1;

  for (let row = 0; row <= steps; row += 1) {
    for (let column = 0; column <= steps; column += 1) {
      vertexIndex(writer, column * step, row * step, 0, COLUMN_AXIS);
    }
  }

  for (let row = 0; row < steps; row += 1) {
    for (let column = 0; column < steps; column += 1) {
      const first = row * side + column;

      const right = first + 1;
      const below = first + side;

      const diagonal = below + 1;
      const center = vertexIndex(writer, column * step, row * step, 0, COLUMN_AXIS, 1);

      indices.push(first, center, right, first, below, center, below, diagonal, center, right, center, diagonal);
    }
  }

  if (edges === "skirted") {
    addSkirts(writer, indices, cells, step);
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("cell", new Float32BufferAttribute(writer.cells, 2));
  geometry.setAttribute("quadCenter", new Float32BufferAttribute(writer.centers, 1));
  geometry.setAttribute("skirt", new Float32BufferAttribute(writer.skirts, 1));
  geometry.setAttribute("skirtAxis", new Float32BufferAttribute(writer.axes, 1));
  geometry.setAttribute("patchStep", new Float32BufferAttribute(new Float32Array(writer.skirts.length).fill(step), 1));
  geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(writer.skirts.length * 3), 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(upNormals(writer.skirts.length), 3));
  geometry.setIndex(new Uint32BufferAttribute(indices, 1));

  return geometry;
}

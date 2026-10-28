import type { GenerationProgress, IslandSketch } from "../generation/generation-options.ts";

const SKETCH_CELLS_PER_SIDE = 640;

function sampleCells<Cells extends Float32Array | Uint8Array>(
  source: Cells,
  sampled: Cells,
  sourceCells: number,
  cells: number
): Cells {
  const step = sourceCells / cells;

  for (let row = 0; row < cells; row += 1) {
    const sourceRow = Math.floor((row + 0.5) * step);

    for (let column = 0; column < cells; column += 1) {
      sampled[row * cells + column] = source[sourceRow * sourceCells + Math.floor((column + 0.5) * step)];
    }
  }

  return sampled;
}

export function shrinkSketch(island: IslandSketch): IslandSketch {
  const { cellsPerSide, ground, waterSurface } = island;

  const cells = Math.min(cellsPerSide, SKETCH_CELLS_PER_SIDE);
  const count = cells * cells;

  return {
    cellSize: (island.cellSize * cellsPerSide) / cells,
    cellsPerSide: cells,
    coastDistance: sampleCells(island.coastDistance, new Float32Array(count), cellsPerSide, cells),
    ground: ground === null ? null : sampleCells(ground, new Uint8Array(count), cellsPerSide, cells),
    height: sampleCells(island.height, new Float32Array(count), cellsPerSide, cells),
    waterSurface:
      waterSurface === null ? null : sampleCells(waterSurface, new Float32Array(count), cellsPerSide, cells),
  };
}

export function withSmallSketches(
  onProgress: (progress: GenerationProgress) => void
): (progress: GenerationProgress) => void {
  return (progress) => {
    const { island, stage } = progress;

    onProgress({ island: island === null ? null : shrinkSketch(island), stage });
  };
}

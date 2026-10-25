import { float, texture, vec3 } from "three/tsl";
import { ClampToEdgeWrapping, DataTexture, LinearFilter, type Node, RedFormat, UnsignedByteType } from "three/webgpu";
import type { SimulationFrame } from "../../simulation/frame.ts";
import type { WorldGrid } from "../../world/world-grid.ts";

const GLOW_RESOLUTION = 128;
const BLUR_RADIUS = 3;
const BLUR_GAIN = 1.6;
const FULL_GLOW = 22;
const BYTE = 255;
const GLOW_COLOR = vec3(1, 0.42, 0.12);
const GLOW_STRENGTH = 2.6;

export type BurningCells = Pick<SimulationFrame, "burningCells" | "burningIntensity">;

function blur(source: Float32Array, target: Float32Array, step: number): void {
  for (let texel = 0; texel < target.length; texel += 1) {
    const along = Math.floor(texel / step) % GLOW_RESOLUTION;

    let sum = 0;
    let count = 0;

    for (let offset = -BLUR_RADIUS; offset <= BLUR_RADIUS; offset += 1) {
      if (along + offset >= 0 && along + offset < GLOW_RESOLUTION) {
        sum += source[texel + offset * step];
        count += 1;
      }
    }

    target[texel] = (sum / count) * BLUR_GAIN;
  }
}

export class FireGlow {
  readonly texture: DataTexture;
  readonly #accumulated = new Float32Array(GLOW_RESOLUTION * GLOW_RESOLUTION);
  readonly #cellsPerTexel: number;
  readonly #data = new Uint8Array(GLOW_RESOLUTION * GLOW_RESOLUTION);
  readonly #grid: WorldGrid;
  readonly #scratch = new Float32Array(GLOW_RESOLUTION * GLOW_RESOLUTION);
  #frame: BurningCells | null = null;
  #litTexels = 0;

  constructor(grid: WorldGrid) {
    this.#grid = grid;
    this.#cellsPerTexel = grid.cellsPerSide / GLOW_RESOLUTION;
    this.texture = new DataTexture(this.#data, GLOW_RESOLUTION, GLOW_RESOLUTION, RedFormat, UnsignedByteType);
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.wrapS = ClampToEdgeWrapping;
    this.texture.wrapT = ClampToEdgeWrapping;
    this.texture.needsUpdate = true;
  }

  update(frame: BurningCells): void {
    if (frame === this.#frame) {
      return;
    }

    this.#frame = frame;

    if (frame.burningCells.length === 0 && this.#litTexels === 0) {
      return;
    }

    this.#accumulate(frame);
    blur(this.#accumulated, this.#scratch, 1);
    blur(this.#scratch, this.#accumulated, GLOW_RESOLUTION);
    blur(this.#accumulated, this.#scratch, 1);
    blur(this.#scratch, this.#accumulated, GLOW_RESOLUTION);
    this.#writeTexture();
  }

  dispose(): void {
    this.texture.dispose();
  }

  #accumulate(frame: BurningCells): void {
    const grid = this.#grid;

    this.#accumulated.fill(0);

    for (const [index, cell] of frame.burningCells.entries()) {
      const column = Math.floor(grid.columnOf(cell) / this.#cellsPerTexel);
      const row = Math.floor(grid.rowOf(cell) / this.#cellsPerTexel);

      this.#accumulated[row * GLOW_RESOLUTION + column] += frame.burningIntensity[index] / BYTE;
    }
  }

  #writeTexture(): void {
    let litTexels = 0;

    for (const [texel, value] of this.#accumulated.entries()) {
      const byte = Math.round(Math.min(1, value / FULL_GLOW) * BYTE);

      this.#data[texel] = byte;

      if (byte > 0) {
        litTexels += 1;
      }
    }

    this.#litTexels = litTexels;
    this.texture.needsUpdate = true;
  }
}

export function fireLightAt(glow: FireGlow, grid: WorldGrid, point: Node<"vec2">): Node<"vec3"> {
  const coordinates = point.add(grid.halfSize).div(grid.worldSize);

  return GLOW_COLOR.mul(texture(glow.texture, coordinates).level(float(0)).r.mul(GLOW_STRENGTH));
}

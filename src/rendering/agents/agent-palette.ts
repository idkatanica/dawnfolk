import { texture } from "three/tsl";
import { DataTexture, FloatType, NearestFilter, RGBAFormat, type TextureNode } from "three/webgpu";

const CHANNELS = 4;
const INITIAL_ROWS = 128;

function createTexture(data: Float32Array, width: number, rows: number): DataTexture {
  const created = new DataTexture(data, width, rows, RGBAFormat, FloatType);

  created.minFilter = NearestFilter;
  created.magFilter = NearestFilter;
  created.generateMipmaps = false;
  created.needsUpdate = true;

  return created;
}

export class AgentPalette {
  readonly node: TextureNode;
  readonly width: number;
  #data: Float32Array;
  #rows: number;
  #texture: DataTexture;

  constructor(width: number) {
    this.width = width;
    this.#rows = INITIAL_ROWS;
    this.#data = new Float32Array(this.#rowFloats * this.#rows);
    this.#texture = createTexture(this.#data, width, this.#rows);
    this.node = texture(this.#texture);
  }

  get data(): Float32Array {
    return this.#data;
  }

  ensureRows(rows: number): void {
    if (rows <= this.#rows) {
      return;
    }

    let next = this.#rows;

    while (next < rows) {
      next *= 2;
    }

    const previous = this.#texture;
    const data = new Float32Array(this.#rowFloats * next);

    data.set(this.#data);
    this.#rows = next;
    this.#data = data;
    this.#texture = createTexture(data, this.width, next);
    this.node.value = this.#texture;
    previous.dispose();
  }

  rowOffset(row: number): number {
    return row * this.#rowFloats;
  }

  texelOffset(row: number, texel: number): number {
    return row * this.#rowFloats + texel * CHANNELS;
  }

  upload(): void {
    this.#texture.needsUpdate = true;
  }

  dispose(): void {
    this.#texture.dispose();
  }

  get #rowFloats(): number {
    return this.width * CHANNELS;
  }
}

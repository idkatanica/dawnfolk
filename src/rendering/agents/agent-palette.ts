import { texture } from "three/tsl";
import { DataTexture, FloatType, NearestFilter, RGBAFormat, type TextureNode } from "three/webgpu";

const CHANNELS = 4;
const INITIAL_ROWS = 128;

function createTexture(width: number, rows: number): DataTexture {
  const created = new DataTexture(new Float32Array(width * rows * CHANNELS), width, rows, RGBAFormat, FloatType);

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
    this.#texture = createTexture(width, this.#rows);
    this.#data = this.#readData();
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
    const previousData = this.#data;

    this.#rows = next;
    this.#texture = createTexture(this.width, next);
    this.#data = this.#readData();
    this.#data.set(previousData);
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

  #readData(): Float32Array {
    const { data } = this.#texture.image;

    if (data instanceof Float32Array) {
      return data;
    }

    throw new TypeError("The agent palette must hold 32-bit floats");
  }
}

import { texture } from "three/tsl";
import { type Color, DataTexture, FloatType, NearestFilter, RGBAFormat, type TextureNode } from "three/webgpu";
import { colorTexel, type PaletteLayout, paletteWidth, rootTexel, TEXELS_PER_BONE } from "./palette-layout.ts";

const CHANNELS = 4;
const INITIAL_ROWS = 32;

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
  readonly #layout: PaletteLayout;
  readonly #rootTexel: number;
  readonly #rowFloats: number;
  readonly #width: number;
  #data: Float32Array;
  #rows: number;
  #texture: DataTexture;
  #uploadedRows = 0;

  constructor(layout: PaletteLayout) {
    this.#layout = layout;
    this.#width = paletteWidth(layout);
    this.#rowFloats = this.#width * CHANNELS;
    this.#rootTexel = rootTexel(layout);
    this.#rows = INITIAL_ROWS;
    this.#data = new Float32Array(this.#rowFloats * this.#rows);
    this.#texture = createTexture(this.#data, this.#width, this.#rows);
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
    this.#texture = createTexture(data, this.#width, next);
    this.node.value = this.#texture;
    previous.dispose();
  }

  rowOffset(row: number): number {
    return row * this.#rowFloats;
  }

  writeRoot(row: number, x: number, y: number, z: number, heading: number): void {
    const offset = this.#texelOffset(row, this.#rootTexel);

    this.#data[offset] = x;
    this.#data[offset + 1] = y;
    this.#data[offset + 2] = z;
    this.#data[offset + 3] = heading;
  }

  lean(row: number, angle: number): void {
    if (angle === 0) {
      return;
    }

    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);

    for (let bone = 0; bone < this.#layout.boneCount; bone += 1) {
      const up = this.#texelOffset(row, bone * TEXELS_PER_BONE + 1);
      const forward = up + CHANNELS;

      for (let channel = 0; channel < CHANNELS; channel += 1) {
        const upValue = this.#data[up + channel];
        const forwardValue = this.#data[forward + channel];

        this.#data[up + channel] = cosine * upValue + sine * forwardValue;
        this.#data[forward + channel] = cosine * forwardValue - sine * upValue;
      }
    }
  }

  writeColor(row: number, index: number, color: Color): void {
    const offset = this.#texelOffset(row, colorTexel(this.#layout, index));

    this.#data[offset] = color.r;
    this.#data[offset + 1] = color.g;
    this.#data[offset + 2] = color.b;
  }

  finish(rows: number): void {
    if (rows > 0 || this.#uploadedRows > 0) {
      this.#texture.needsUpdate = true;
    }

    this.#uploadedRows = rows;
  }

  dispose(): void {
    this.#texture.dispose();
  }

  #texelOffset(row: number, texel: number): number {
    return row * this.#rowFloats + texel * CHANNELS;
  }
}

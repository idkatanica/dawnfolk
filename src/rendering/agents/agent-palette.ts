import { texture, uniform } from "three/tsl";
import { type Color, type DataTexture, RGBAFormat, type TextureNode } from "three/webgpu";
import { floatDataTexture } from "../data-textures.ts";
import { colorTexel, type PaletteLayout, paletteWidth, rootTexel, TEXELS_PER_BONE } from "./palette-layout.ts";

export const NO_ROW = -1;

const CHANNELS = 4;
const INITIAL_ROWS = 32;

export class AgentPalette {
  readonly highlightRow = uniform(NO_ROW);
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
    this.#texture = floatDataTexture(this.#data, this.#width, this.#rows, RGBAFormat);
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
    this.#texture = floatDataTexture(data, this.#width, next, RGBAFormat);
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
    this.#turn(row, 1, 2, angle);
  }

  tiltToward(row: number, heading: number, towardX: number, towardZ: number): void {
    const cosine = Math.cos(heading);
    const sine = Math.sin(heading);

    this.#turn(row, 1, 2, -(towardX * sine + towardZ * cosine));
    this.#turn(row, 1, 0, -(towardX * cosine - towardZ * sine));
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

  #turn(row: number, firstAxis: number, secondAxis: number, angle: number): void {
    if (angle === 0) {
      return;
    }

    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);

    for (let bone = 0; bone < this.#layout.boneCount; bone += 1) {
      const first = this.#texelOffset(row, bone * TEXELS_PER_BONE + firstAxis);
      const second = this.#texelOffset(row, bone * TEXELS_PER_BONE + secondAxis);

      for (let channel = 0; channel < CHANNELS; channel += 1) {
        const firstValue = this.#data[first + channel];
        const secondValue = this.#data[second + channel];

        this.#data[first + channel] = cosine * firstValue + sine * secondValue;
        this.#data[second + channel] = cosine * secondValue - sine * firstValue;
      }
    }
  }

  #texelOffset(row: number, texel: number): number {
    return row * this.#rowFloats + texel * CHANNELS;
  }
}

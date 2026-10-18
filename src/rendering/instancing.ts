import {
  type BufferGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  Sphere,
  Uint32BufferAttribute,
  Vector3,
} from "three/webgpu";
import type { MeshData, VertexChannel } from "../models/mesh/mesh-data.ts";

const GROWTH_FACTOR = 1.5;

interface InterleavedField {
  readonly name: string;
  readonly size: number;
}

export function toInstancedGeometry(source: BufferGeometry): InstancedBufferGeometry {
  const geometry = new InstancedBufferGeometry();

  for (const [name, attribute] of Object.entries(source.attributes)) {
    geometry.setAttribute(name, attribute);
  }

  geometry.setIndex(source.getIndex());

  return geometry;
}

export function geometryFromMeshData(mesh: MeshData, channels: readonly VertexChannel[]): InstancedBufferGeometry {
  const geometry = new InstancedBufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(mesh.positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(mesh.normals, 3));

  for (const channel of channels) {
    geometry.setAttribute(channel, new Float32BufferAttribute(mesh.channels[channel], 1));
  }

  geometry.setIndex(new Uint32BufferAttribute(mesh.indices, 1));

  const [minimumX, minimumY, minimumZ] = mesh.bounds.minimum;
  const [maximumX, maximumY, maximumZ] = mesh.bounds.maximum;

  const center = new Vector3((minimumX + maximumX) / 2, (minimumY + maximumY) / 2, (minimumZ + maximumZ) / 2);

  const radius = center.distanceTo(new Vector3(maximumX, maximumY, maximumZ));

  geometry.boundingSphere = new Sphere(center, radius);
  geometry.instanceCount = 0;

  return geometry;
}

export class InstanceAttribute {
  readonly itemSize: number;
  readonly #geometry: InstancedBufferGeometry;
  readonly #name: string;
  #attribute: InstancedBufferAttribute;

  constructor(geometry: InstancedBufferGeometry, name: string, itemSize: number, capacity: number) {
    this.itemSize = itemSize;
    this.#geometry = geometry;
    this.#name = name;
    this.#attribute = this.#create(Math.max(1, capacity));
  }

  get array(): Float32Array {
    const { array } = this.#attribute;

    if (array instanceof Float32Array) {
      return array;
    }

    throw new TypeError(`Instance attribute ${this.#name} must hold 32-bit floats`);
  }

  get capacity(): number {
    return this.#attribute.count;
  }

  ensureCapacity(count: number): void {
    if (count <= this.capacity) {
      return;
    }

    const previous = this.array;
    const next = this.#create(Math.ceil(count * GROWTH_FACTOR));

    next.array.set(previous);
  }

  markUpdated(count: number): void {
    const attribute = this.#attribute;

    attribute.clearUpdateRanges();
    attribute.addUpdateRange(0, Math.max(1, count) * this.itemSize);
    attribute.needsUpdate = true;
  }

  #create(capacity: number): InstancedBufferAttribute {
    const attribute = new InstancedBufferAttribute(new Float32Array(capacity * this.itemSize), this.itemSize);

    attribute.setUsage(DynamicDrawUsage);
    this.#geometry.setAttribute(this.#name, attribute);
    this.#attribute = attribute;

    return attribute;
  }
}

export class InterleavedInstances {
  readonly stride: number;
  readonly #fields: readonly InterleavedField[];
  readonly #geometry: InstancedBufferGeometry;
  #buffer: InstancedInterleavedBuffer;

  constructor(geometry: InstancedBufferGeometry, fields: readonly InterleavedField[], capacity: number) {
    this.#geometry = geometry;
    this.#fields = fields;
    this.stride = fields.reduce((sum, field) => sum + field.size, 0);
    this.#buffer = this.#create(Math.max(1, capacity));
  }

  get array(): Float32Array {
    const { array } = this.#buffer;

    if (array instanceof Float32Array) {
      return array;
    }

    throw new TypeError("Interleaved instances must hold 32-bit floats");
  }

  get capacity(): number {
    return this.#buffer.count;
  }

  ensureCapacity(count: number): void {
    if (count <= this.capacity) {
      return;
    }

    const previous = this.array;
    const next = this.#create(Math.ceil(count * GROWTH_FACTOR));

    next.array.set(previous);
  }

  markUpdated(count: number): void {
    const buffer = this.#buffer;

    buffer.clearUpdateRanges();
    buffer.addUpdateRange(0, Math.max(1, count) * this.stride);
    buffer.needsUpdate = true;
  }

  #create(capacity: number): InstancedInterleavedBuffer {
    const buffer = new InstancedInterleavedBuffer(new Float32Array(capacity * this.stride), this.stride);

    buffer.setUsage(DynamicDrawUsage);

    let offset = 0;

    for (const field of this.#fields) {
      this.#geometry.setAttribute(field.name, new InterleavedBufferAttribute(buffer, field.size, offset));
      offset += field.size;
    }

    this.#buffer = buffer;

    return buffer;
  }
}

import { attribute, length, uniform, vec2 } from "three/tsl";
import {
  Float32BufferAttribute,
  InstancedBufferGeometry,
  type Material,
  Mesh,
  type Node,
  type PerspectiveCamera,
  Uint16BufferAttribute,
  Vector3,
} from "three/webgpu";
import { InterleavedInstances } from "../instancing.ts";

const FLOATS_PER_BILLBOARD = 8;
const CORNER_ATTRIBUTE = "billboardCorner";

const BILLBOARD_FIELDS = [
  { name: "billboardPlacement", size: 4 },
  { name: "billboardLook", size: 4 },
] as const;

interface BillboardNodes {
  readonly corner: Node<"vec2">;
  readonly look: Node<"vec4">;
  readonly placement: Node<"vec4">;
}

export class CameraAxes {
  readonly right = uniform(new Vector3(1, 0, 0));
  readonly up = uniform(new Vector3(0, 1, 0));

  update(camera: PerspectiveCamera): void {
    const { elements } = camera.matrixWorld;

    this.right.value.set(elements[0], elements[1], elements[2]).normalize();
    this.up.value.set(elements[4], elements[5], elements[6]).normalize();
  }
}

export function billboardNodes(): BillboardNodes {
  return {
    corner: attribute(CORNER_ATTRIBUTE, "vec2"),
    look: attribute("billboardLook", "vec4"),
    placement: attribute("billboardPlacement", "vec4"),
  };
}

export function facingBillboard(axes: CameraAxes, center: Node<"vec3">, corner: Node<"vec2">, size: Node<"float">) {
  return center.add(axes.right.mul(corner.x.mul(size))).add(axes.up.mul(corner.y.sub(0.5).mul(size)));
}

export function distanceFromBillboardCenter(corner: Node<"vec2">): Node<"float"> {
  return length(vec2(corner.x, corner.y.sub(0.5)));
}

export function createQuadGeometry(cornerAttribute: string): InstancedBufferGeometry {
  const geometry = new InstancedBufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(12), 3));
  geometry.setAttribute(cornerAttribute, new Float32BufferAttribute([-0.5, 0, 0.5, 0, 0.5, 1, -0.5, 1], 2));
  geometry.setIndex(new Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1));
  geometry.instanceCount = 0;

  return geometry;
}

export class BillboardBatch {
  readonly mesh: Mesh;
  readonly #geometry: InstancedBufferGeometry;
  readonly #instances: InterleavedInstances;
  readonly #material: Material;
  #count = 0;

  constructor(material: Material, renderOrder: number) {
    this.#material = material;
    this.#geometry = createQuadGeometry(CORNER_ATTRIBUTE);
    this.#instances = new InterleavedInstances(this.#geometry, BILLBOARD_FIELDS, 256);
    this.mesh = new Mesh(this.#geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.mesh.visible = false;
  }

  get count(): number {
    return this.#count;
  }

  begin(): void {
    this.#count = 0;
  }

  add(placement: readonly [number, number, number, number], look: readonly [number, number, number, number]): void {
    this.#instances.ensureCapacity(this.#count + 1);

    const data = this.#instances.array;
    const offset = this.#count * FLOATS_PER_BILLBOARD;

    data.set(placement, offset);
    data.set(look, offset + 4);
    this.#count += 1;
  }

  commit(): void {
    this.#geometry.instanceCount = this.#count;
    this.mesh.visible = this.#count > 0;
    this.#instances.markUpdated(this.#count);
  }

  dispose(): void {
    this.#geometry.dispose();
    this.#material.dispose();
  }
}

import { float, length, smoothstep, varying, vec2 } from "three/tsl";
import { Color, type Mesh, MeshBasicNodeMaterial } from "three/webgpu";
import { BillboardBatch, billboardNodes, type CameraAxes, facingBillboard } from "../effects/billboards.ts";

const SMALLEST_DOT = 1.6;
const DOT_SIZE_PER_METER = 0.0045;
const FARTHEST_DOT = 4500;
const DOT_RENDER_ORDER = 1;

function createDotMaterial(axes: CameraAxes): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ depthWrite: false, transparent: true });
  const { corner, look, placement } = billboardNodes();

  material.positionNode = facingBillboard(axes, placement.xyz, corner, placement.w);

  const shape = varying(corner, "dotCorner");

  const radius = length(vec2(shape.x, shape.y.sub(0.5))).mul(2);

  const disc = float(1).sub(smoothstep(0.75, 1, radius));
  const rim = smoothstep(0.45, 0.8, radius);

  material.colorNode = look.xyz.mul(float(1).sub(rim.mul(0.35)));
  material.opacityNode = disc.mul(look.w);

  return material;
}

export class AgentDots {
  readonly #batch: BillboardBatch;
  readonly #colors = new Map<number, Color>();

  constructor(axes: CameraAxes) {
    this.#batch = new BillboardBatch(createDotMaterial(axes), DOT_RENDER_ORDER);
  }

  get count(): number {
    return this.#batch.count;
  }

  get mesh(): Mesh {
    return this.#batch.mesh;
  }

  begin(): void {
    this.#batch.begin();
  }

  add(x: number, y: number, z: number, distance: number, color: number): void {
    if (distance > FARTHEST_DOT) {
      return;
    }

    const size = Math.max(SMALLEST_DOT, distance * DOT_SIZE_PER_METER);
    const { b: blue, g: green, r: red } = this.#colorOf(color);

    this.#batch.add([x, y + size * 0.5 + 0.4, z, size], [red, green, blue, 1]);
  }

  commit(): void {
    this.#batch.commit();
  }

  dispose(): void {
    this.#batch.dispose();
  }

  #colorOf(hex: number): Color {
    const known = this.#colors.get(hex);

    if (known !== undefined) {
      return known;
    }

    const color = new Color(hex);

    this.#colors.set(hex, color);

    return color;
  }
}

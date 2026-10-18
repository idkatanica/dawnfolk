import { attribute, cos, float, mix, sin, smoothstep, time, uniform, vec2, vec3 } from "three/tsl";
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  MeshBasicNodeMaterial,
  Uint32BufferAttribute,
  Vector2,
} from "three/webgpu";
import type { WorldGrid } from "../../world/world-grid.ts";
import { sampleHeightNode } from "../terrain/height-sampling.ts";
import type { TerrainTextures } from "../terrain/terrain-textures.ts";

const SEGMENTS = 128;

function createRingGeometry(): BufferGeometry {
  const angles: number[] = [];
  const sides: number[] = [];
  const indices: number[] = [];

  for (let segment = 0; segment <= SEGMENTS; segment += 1) {
    const angle = (segment / SEGMENTS) * Math.PI * 2;

    angles.push(angle, angle);
    sides.push(0, 1);
  }

  for (let segment = 0; segment < SEGMENTS; segment += 1) {
    const inner = segment * 2;

    indices.push(inner, inner + 2, inner + 1, inner + 2, inner + 3, inner + 1);
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(angles.length * 3), 3));
  geometry.setAttribute("ringAngle", new Float32BufferAttribute(angles, 1));
  geometry.setAttribute("ringSide", new Float32BufferAttribute(sides, 1));
  geometry.setIndex(new Uint32BufferAttribute(indices, 1));

  return geometry;
}

export class GroundRing {
  readonly mesh: Mesh;
  readonly #center = uniform(new Vector2());
  readonly #color = uniform(new Color(0xff_ff_ff));
  readonly #opacity = uniform(0.85);
  readonly #radius = uniform(10);
  readonly #width = uniform(1);

  constructor(textures: TerrainTextures, grid: WorldGrid) {
    const material = new MeshBasicNodeMaterial({ depthWrite: false, transparent: true });
    const angle = attribute("ringAngle", "float");
    const side = attribute("ringSide", "float");

    const distance = this.#radius.add(side.sub(0.5).mul(this.#width));

    const point = this.#center.add(vec2(cos(angle), sin(angle)).mul(distance));

    const lift = float(0.7).add(this.#radius.mul(0.006));

    const height = sampleHeightNode(textures.height, grid, point).add(lift);

    const dash = smoothstep(-0.2, 0.2, sin(angle.mul(24).sub(time.mul(1.6))));

    material.positionNode = vec3(point.x, height, point.y);
    material.colorNode = this.#color;
    material.opacityNode = this.#opacity.mul(mix(float(0.55), float(1), dash));
    material.fog = false;

    this.mesh = new Mesh(createRingGeometry(), material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.visible = false;
  }

  show(x: number, z: number, radius: number, color: number, opacity: number): void {
    this.#center.value.set(x, z);
    this.#radius.value = radius;
    this.#width.value = Math.max(0.35, radius * 0.045);
    this.#color.value.setHex(color);
    this.#opacity.value = opacity;
    this.mesh.visible = true;
  }

  hide(): void {
    this.mesh.visible = false;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}

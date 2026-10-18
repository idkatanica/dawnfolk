import {
  attribute,
  cameraPosition,
  distance,
  float,
  max,
  mix,
  mx_noise_float,
  positionWorld,
  smoothstep,
  time,
  vec3,
} from "three/tsl";
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicNodeMaterial,
  Uint32BufferAttribute,
} from "three/webgpu";
import type { Waterfall } from "../../world/water.ts";
import type { IslandOutline } from "../terrain/island-outline.ts";

const FALL_HEIGHT = 1150;
const GRAVITY = 9.8;
const LAUNCH_SPEED = 3.5;
const ALONG_SEGMENTS = 56;
const ACROSS_SEGMENTS = 6;
const MINIMUM_WIDTH = 7;

interface CurtainWriter {
  readonly coordinates: number[];
  readonly indices: number[];
  readonly positions: number[];
  readonly progress: number[];
  readonly sides: number[];
}

function addCurtain(writer: CurtainWriter, waterfall: Waterfall): void {
  const fallSeconds = Math.sqrt((2 * FALL_HEIGHT) / GRAVITY);
  const width = Math.max(MINIMUM_WIDTH, waterfall.width * 1.15);
  const sideX = -waterfall.directionZ;
  const sideZ = waterfall.directionX;
  const firstVertex = writer.progress.length;

  for (let along = 0; along <= ALONG_SEGMENTS; along += 1) {
    const amount = along / ALONG_SEGMENTS;

    const seconds = amount * fallSeconds;
    const spread = width * (1 + amount * 3.5);

    const outward = LAUNCH_SPEED * seconds;
    const drop = 0.5 * GRAVITY * seconds * seconds;

    for (let across = 0; across <= ACROSS_SEGMENTS; across += 1) {
      const sideAmount = across / ACROSS_SEGMENTS;

      const offset = (sideAmount - 0.5) * spread;

      writer.positions.push(
        waterfall.x + waterfall.directionX * outward + sideX * offset,
        waterfall.top - drop,
        waterfall.z + waterfall.directionZ * outward + sideZ * offset
      );
      writer.coordinates.push(sideAmount * spread * 0.25, drop * 0.05 + outward * 0.05);
      writer.progress.push(amount);
      writer.sides.push(sideAmount);
    }
  }

  const rowLength = ACROSS_SEGMENTS + 1;

  for (let along = 0; along < ALONG_SEGMENTS; along += 1) {
    for (let across = 0; across < ACROSS_SEGMENTS; across += 1) {
      const corner = firstVertex + along * rowLength + across;

      const below = corner + rowLength;

      writer.indices.push(corner, below, corner + 1, corner + 1, below, below + 1);
    }
  }
}

function createCurtainMaterial(): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ depthWrite: false, side: DoubleSide, transparent: true });
  const coordinates = attribute("fallCoordinates", "vec2");
  const progress = attribute("fallProgress", "float");
  const sideAmount = attribute("fallSide", "float");

  const streaks = mx_noise_float(vec3(coordinates.x.mul(0.45), coordinates.y.sub(time.mul(1.4)), 0))
    .mul(0.5)
    .add(0.5);
  const spray = mx_noise_float(vec3(coordinates.x.mul(5), coordinates.y.mul(3).sub(time.mul(3)), 7))
    .mul(0.5)
    .add(0.5);

  const mist = max(smoothstep(0.08, 0.45, progress), smoothstep(600, 2400, distance(positionWorld, cameraPosition)));
  const edges = smoothstep(0, 0.2, sideAmount).mul(smoothstep(1, 0.8, sideAmount));
  const fade = float(1).sub(smoothstep(0.2, 0.62, progress));

  const sheet = mix(smoothstep(0.3, 0.75, streaks.mul(0.75).add(spray.mul(0.25))), float(0.5), mist);

  material.colorNode = mix(vec3(0.72, 0.84, 0.9), vec3(1, 1, 1), sheet);
  material.opacityNode = sheet
    .mul(0.3)
    .add(0.6)
    .mul(edges)
    .mul(fade)
    .mul(smoothstep(0, 0.02, progress).mul(0.6).add(0.4));

  return material;
}

export class WaterfallView {
  readonly mesh: Mesh;

  constructor() {
    this.mesh = new Mesh(new BufferGeometry(), createCurtainMaterial());
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  rebuild(waterfalls: readonly Waterfall[], outline: IslandOutline): void {
    const writer: CurtainWriter = { coordinates: [], indices: [], positions: [], progress: [], sides: [] };

    for (const waterfall of waterfalls) {
      const [x, z] = outline.atCoast(waterfall.x, waterfall.z);

      addCurtain(writer, { ...waterfall, x, z });
    }

    const geometry = new BufferGeometry();

    geometry.setAttribute("position", new Float32BufferAttribute(writer.positions, 3));
    geometry.setAttribute("fallCoordinates", new Float32BufferAttribute(writer.coordinates, 2));
    geometry.setAttribute("fallProgress", new Float32BufferAttribute(writer.progress, 1));
    geometry.setAttribute("fallSide", new Float32BufferAttribute(writer.sides, 1));
    geometry.setIndex(new Uint32BufferAttribute(writer.indices, 1));

    this.mesh.geometry.dispose();
    this.mesh.geometry = geometry;
    this.mesh.visible = writer.indices.length > 0;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}

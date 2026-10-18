import { clamp, FULL_TURN, fractionalPart, smoothstep } from "../../shared/math.ts";
import { createVolumeNoise } from "../../shared/noise.ts";
import { createRandom } from "../../shared/random.ts";
import { MaterialSlot } from "../materials.ts";
import { MeshBuilder } from "../mesh/mesh-builder.ts";
import type { MeshData } from "../mesh/mesh-data.ts";
import { facetShape } from "../mesh/shape.ts";
import { blob } from "../mesh/shapes.ts";
import { transformOf } from "../mesh/transforms.ts";
import type { PlantDetailLevel } from "./tree-mesher.ts";

const BOULDER_NOISE = createVolumeNoise(createRandom(8080));

export function meshBoulder(seed: number, level: PlantDetailLevel): MeshData {
  const random = createRandom(seed);
  const builder = new MeshBuilder();
  const detail = { high: 2, low: 0, medium: 1 }[level];

  const stones = random.chance(0.35) ? 2 : 1;

  for (let stone = 0; stone < stones; stone += 1) {
    const radius = stone === 0 ? 1.3 : random.between(0.5, 0.8);
    const offset = stone === 0 ? 0 : random.between(1, 1.5);
    const angle = random.next() * FULL_TURN;
    const flatness = random.between(0.55, 0.9);

    const shape = facetShape(
      blob({
        detail,
        frequency: 1.1,
        noise: BOULDER_NOISE,
        normalSoftness: 0,
        offset: [seed % 97, stone * 13, seed % 31],
        radius,
        roughness: 0.32,
      })
    );

    builder.add(shape, {
      style: {
        shade: (point) => 0.62 + 0.38 * smoothstep(0, radius * flatness * 1.6, point.position.y),
        slot: (point) => mossSlot(point.normal.y, point.position.x + point.position.z * 1.3),
      },
      transform: transformOf({
        position: [Math.cos(angle) * offset, radius * flatness * 0.75, Math.sin(angle) * offset],
        rotation: [random.signed() * 0.3, random.next() * FULL_TURN, random.signed() * 0.3],
        scale: [1, flatness, random.between(0.8, 1.15)],
      }),
    });
  }

  return builder.build();
}

function mossSlot(upward: number, position: number): number {
  const patchiness = fractionalPart(position * 0.73) * 0.25;

  return clamp(upward - patchiness, 0, 1) > 0.62 ? MaterialSlot.Moss : MaterialSlot.Stone;
}

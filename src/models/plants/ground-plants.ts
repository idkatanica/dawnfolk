import { Vector3 } from "three";
import { clamp, FULL_TURN, fractionalPart, smoothstep } from "../../shared/math.ts";
import { createVolumeNoise } from "../../shared/noise.ts";
import { createRandom } from "../../shared/random.ts";
import { MaterialSlot } from "../materials.ts";
import { MeshBuilder } from "../mesh/mesh-builder.ts";
import type { MeshData } from "../mesh/mesh-data.ts";
import { facetShape } from "../mesh/shape.ts";
import { blob, type LoftSection, loft, sphere, tube } from "../mesh/shapes.ts";
import { transformOf } from "../mesh/transforms.ts";
import type { PlantDetailLevel } from "./tree-mesher.ts";

const LEVEL_SEGMENTS: Readonly<Record<PlantDetailLevel, number>> = { high: 14, low: 6, medium: 9 };

function cactusRipple(ribs: number): (around: number) => number {
  return (around) => 1 + 0.09 * Math.abs(Math.cos(around * Math.PI * ribs));
}

function column(height: number, radius: number, ribs: number): LoftSection[] {
  const ripple = cactusRipple(ribs);

  return [
    { radiusX: radius * 1.05, radiusZ: radius * 1.05, ripple, y: 0 },
    { radiusX: radius, radiusZ: radius, ripple, y: height * 0.5 },
    { radiusX: radius * 0.95, radiusZ: radius * 0.95, ripple, y: height * 0.88 },
    { radiusX: radius * 0.7, radiusZ: radius * 0.7, ripple, y: height * 0.97 },
    { radiusX: 0, radiusZ: 0, y: height },
  ];
}

export function meshCactus(seed: number, level: PlantDetailLevel): MeshData {
  const random = createRandom(seed);
  const builder = new MeshBuilder({ slot: MaterialSlot.Cactus });
  const segments = LEVEL_SEGMENTS[level];
  const ribs = level === "low" ? 4 : 9;

  const height = random.between(3.4, 4.2);

  builder.add(loft(column(height, 0.32, ribs), segments), {
    style: { shade: (point) => 0.7 + 0.3 * smoothstep(0, 1.5, point.position.y), sway: 0 },
  });

  const arms = random.integer(1, 4);

  for (let arm = 0; arm < arms; arm += 1) {
    const angle = (arm / arms) * FULL_TURN + random.signed() * 0.5;
    const start = random.between(1.1, 2.2);
    const reach = random.between(0.5, 0.75);
    const rise = random.between(0.7, 1.4);

    const outward = new Vector3(Math.cos(angle), 0, Math.sin(angle));

    const points = [0, reach * 0.8, reach, reach].map((distance, index) => {
      const lift = [0, 0.1, 0.35, rise][index];
      const point = outward.clone().multiplyScalar(distance * 0.9 + 0.1);

      return { radius: 0.2 - index * 0.012, x: point.x, y: start + lift, z: point.z };
    });

    builder.add(
      tube([...points, { ...points[3], radius: 0, y: start + rise + 0.18 }], {
        hasEndCap: false,
        radialSegments: Math.max(5, segments - 4),
      }),
      {
        style: { shade: 0.95 },
      }
    );
  }

  if (level !== "low") {
    for (let flower = 0; flower < 3; flower += 1) {
      const angle = random.next() * FULL_TURN;

      builder.add(sphere(0.07, 6, 4), {
        style: { slot: MaterialSlot.Blossom },
        transform: transformOf({ position: [Math.cos(angle) * 0.14, height - 0.02, Math.sin(angle) * 0.14] }),
      });
    }
  }

  return builder.build();
}

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

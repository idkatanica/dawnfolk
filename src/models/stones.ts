import { Vector3 } from "three";
import { FULL_TURN, smoothstep } from "../shared/math.ts";
import { createVolumeNoise } from "../shared/noise.ts";
import { createRandom, type RandomSource } from "../shared/random.ts";
import { MaterialSlot, type MaterialSlotIndex } from "./materials.ts";
import type { MeshBuilder, SurfacePoint } from "./mesh/mesh-builder.ts";
import { deformShape, facetShape, type Shape } from "./mesh/shape.ts";
import { icosphere } from "./mesh/shapes.ts";
import { type TransformOptions, type Triple, transformOf } from "./mesh/transforms.ts";

export const STONE_NOISE = createVolumeNoise(createRandom(4242));

const LEAST_FACING = 0.05;
const BUMP_FREQUENCY = 1.6;

export interface FlatCut {
  readonly distance: number;
  readonly normal: Triple;
}

interface CuttingPlane {
  readonly distance: number;
  readonly normal: Vector3;
}

export interface ChiselOptions {
  readonly cuts: number;
  readonly depth: number;
  readonly flats?: readonly FlatCut[];
  readonly radius: number;
  readonly roughness: number;
}

function randomPlane(random: RandomSource, depth: number): CuttingPlane {
  const height = random.signed();
  const angle = random.next() * FULL_TURN;
  const spread = Math.sqrt(1 - height * height);

  return {
    distance: 1 - depth * random.between(0.25, 1),
    normal: new Vector3(Math.cos(angle) * spread, height, Math.sin(angle) * spread),
  };
}

function flatPlane(cut: FlatCut): CuttingPlane {
  return { distance: cut.distance, normal: new Vector3(...cut.normal).normalize() };
}

export function chiseledStone(random: RandomSource, options: ChiselOptions, detail: number): Shape {
  const { flats = [], radius, roughness } = options;

  const randomPlanes = Array.from({ length: options.cuts }, () => randomPlane(random, options.depth));
  const offset: Triple = [random.next() * 40, random.next() * 40, random.next() * 40];
  const planes = [...flats.map(flatPlane), ...randomPlanes];
  const direction = new Vector3();

  return facetShape(
    deformShape(icosphere(radius, detail), (vertex) => {
      direction.set(vertex.x, vertex.y, vertex.z).normalize();

      let reach = 1;

      for (const plane of planes) {
        const facing = direction.dot(plane.normal);

        if (facing > LEAST_FACING) {
          reach = Math.min(reach, plane.distance / facing);
        }
      }

      const bumps = STONE_NOISE.fractal(
        direction.x * BUMP_FREQUENCY + offset[0],
        direction.y * BUMP_FREQUENCY + offset[1],
        direction.z * BUMP_FREQUENCY + offset[2],
        { octaves: 2 }
      );

      const length = radius * reach * (1 + roughness * bumps);

      return [direction.x * length - vertex.x, direction.y * length - vertex.y, direction.z * length - vertex.z];
    })
  );
}

interface Weathering {
  readonly base: MaterialSlotIndex;
  readonly frost: number;
  readonly lichen: number;
  readonly moss: number;
  readonly seed: number;
}

export function weatheredSlot(weathering: Weathering): (point: SurfacePoint) => MaterialSlotIndex {
  const { base, frost, lichen, moss, seed } = weathering;

  return (point) => {
    const { normal, position } = point;

    const patches = STONE_NOISE.sample(position.x * 0.9 + seed, position.y * 0.9 - seed, position.z * 0.9 + 7);

    if (frost > 0 && normal.y > 1 - frost + patches * 0.12) {
      return MaterialSlot.Frost;
    }

    if (moss > 0 && normal.y + patches * 0.5 > 1.1 - moss) {
      return MaterialSlot.Moss;
    }

    const spots = STONE_NOISE.sample(position.x * 3.3 - seed, position.y * 3.3 + 11, position.z * 3.3 + seed);

    if (lichen > 0 && spots > 0.7 - lichen) {
      return MaterialSlot.Lichen;
    }

    return base;
  };
}

export function groundShade(height: number): (point: SurfacePoint) => number {
  return (point) => {
    const { position } = point;

    const streaks = STONE_NOISE.sample(position.x * 2.1, position.y * 0.35, position.z * 2.1);

    return (0.62 + 0.38 * smoothstep(-0.1, height * 0.7, position.y)) * (0.93 + 0.07 * streaks);
  };
}

export interface StoneContext {
  readonly builder: MeshBuilder;
  readonly height: number;
  readonly random: RandomSource;
}

export interface StoneLook {
  readonly lichen: number;
  readonly moss: number;
  readonly slot?: MaterialSlotIndex;
}

export function addStone(context: StoneContext, shape: Shape, placement: TransformOptions, look: StoneLook): void {
  const { slot = MaterialSlot.Stone } = look;

  context.builder.add(shape, {
    style: {
      shade: groundShade(context.height),
      slot: weatheredSlot({
        base: slot,
        frost: 0,
        lichen: look.lichen,
        moss: look.moss,
        seed: context.random.next() * 40,
      }),
    },
    transform: transformOf(placement),
  });
}

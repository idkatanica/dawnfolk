import { Vector3 } from "three";
import { PlantSpecies, type PlantSpeciesIndex } from "../../content/plants.ts";
import { lerp } from "../../shared/math.ts";
import { createVolumeNoise, type VolumeNoise } from "../../shared/noise.ts";
import { createRandom, type RandomSource } from "../../shared/random.ts";
import type { TubePoint } from "../mesh/shapes.ts";
import {
  type Branch,
  directionAlong,
  type Foliage,
  GOLDEN_ANGLE,
  growBranch,
  jitter,
  pointAlong,
  sideDirection,
  type TreeStructure,
  tipOf,
  toVector,
} from "./tree-structure.ts";

export const CANONICAL_HEIGHTS: Readonly<Record<PlantSpeciesIndex, number>> = {
  [PlantSpecies.Birch]: 19,
  [PlantSpecies.Boulder]: 1.7,
  [PlantSpecies.Bush]: 2.2,
  [PlantSpecies.Cactus]: 4,
  [PlantSpecies.Maple]: 16,
  [PlantSpecies.Oak]: 16,
  [PlantSpecies.Pine]: 24,
  [PlantSpecies.Spruce]: 24,
  [PlantSpecies.Willow]: 12,
};

interface Growth {
  readonly branches: Branch[];
  readonly foliage: Foliage[];
  readonly noise: VolumeNoise;
  readonly random: RandomSource;
}

function createGrowth(seed: number): Growth {
  const random = createRandom(seed);

  return { branches: [], foliage: [], noise: createVolumeNoise(random.derive(1)), random };
}

function finish(growth: Growth, height: number): TreeStructure {
  return { branches: growth.branches, foliage: growth.foliage, height };
}

interface TrunkOptions {
  readonly height: number;
  readonly lean: number;
  readonly radiusBottom: number;
  readonly radiusTop: number;
  readonly segments: number;
  readonly wobble: number;
}

function addTrunk(growth: Growth, options: TrunkOptions, start = new Vector3()): TubePoint[] {
  const { random } = growth;

  const leanAngle = random.next() * Math.PI * 2;

  const direction = new Vector3(Math.cos(leanAngle) * options.lean, 1, Math.sin(leanAngle) * options.lean);

  const points = growBranch({
    bend: 0.004,
    direction,
    gravity: 0,
    length: options.height,
    noise: growth.noise,
    radiusEnd: options.radiusTop,
    radiusStart: options.radiusBottom,
    segments: options.segments,
    start,
    wobble: options.wobble,
  });

  const flared = points.map((point, index) => (index === 0 ? { ...point, radius: point.radius * 1.35 } : point));

  growth.branches.push({ depth: 0, points: flared });

  return flared;
}

interface LimbOptions {
  readonly bend: number;
  readonly depth: number;
  readonly gravity: number;
  readonly length: number;
  readonly radiusEnd: number;
  readonly segments: number;
  readonly tilt: number;
  readonly wobble: number;
}

function addLimb(
  growth: Growth,
  parent: readonly TubePoint[],
  along: number,
  azimuth: number,
  options: LimbOptions
): TubePoint[] {
  const base = pointAlong(parent, along);
  const axis = directionAlong(parent, along);

  const points = growBranch({
    bend: options.bend,
    direction: sideDirection(axis, azimuth, options.tilt),
    gravity: options.gravity,
    length: options.length,
    noise: growth.noise,
    radiusEnd: options.radiusEnd,
    radiusStart: Math.min(base.radius * 0.75, options.radiusEnd * 4 + 0.02),
    segments: options.segments,
    start: toVector(base),
    wobble: options.wobble,
  });

  growth.branches.push({ depth: options.depth, points });

  return points;
}

function addBlob(growth: Growth, center: Vector3, radius: number, squash: number): void {
  growth.foliage.push({
    center: center.toArray(),
    kind: "blob",
    radius,
    squash,
    tint: jitter(growth.random, 0.12),
  });
}

function oak(seed: number): TreeStructure {
  const growth = createGrowth(seed);

  const { random } = growth;

  const trunk = addTrunk(growth, {
    height: random.between(5, 6.4),
    lean: random.between(0, 0.1),
    radiusBottom: 0.56,
    radiusTop: 0.36,
    segments: 4,
    wobble: 0.22,
  });

  const limbCount = random.integer(4, 6);

  for (let limb = 0; limb < limbCount; limb += 1) {
    const azimuth = limb * GOLDEN_ANGLE + jitter(random, 0.4);

    const main = addLimb(growth, trunk, random.between(0.72, 1), azimuth, {
      bend: 0.03,
      depth: 1,
      gravity: 0.07,
      length: random.between(5.8, 7.6),
      radiusEnd: 0.09,
      segments: 4,
      tilt: random.between(0.65, 1.1),
      wobble: 0.35,
    });

    for (let twig = 0; twig < 2; twig += 1) {
      const sub = addLimb(growth, main, random.between(0.45, 0.85), random.next() * Math.PI * 2, {
        bend: 0.06,
        depth: 2,
        gravity: 0.05,
        length: random.between(2.4, 3.6),
        radiusEnd: 0.03,
        segments: 3,
        tilt: random.between(0.5, 0.9),
        wobble: 0.3,
      });

      addBlob(growth, toVector(tipOf(sub)), random.between(2.1, 2.9), 0.74);
    }

    addBlob(growth, toVector(tipOf(main)), random.between(2.4, 3.1), 0.72);
  }

  addBlob(growth, toVector(tipOf(trunk)).add(new Vector3(0, 3.2, 0)), random.between(2.8, 3.4), 0.7);

  return finish(growth, CANONICAL_HEIGHTS[PlantSpecies.Oak]);
}

function stemOffset(random: RandomSource, stem: number, stems: number): Vector3 {
  if (stems === 1) {
    return new Vector3();
  }

  return new Vector3((stem - 0.5) * 0.7, 0, jitter(random, 0.2));
}

function stemLean(random: RandomSource, stems: number): number {
  if (stems === 1) {
    return random.between(0, 0.06);
  }

  return random.between(0.08, 0.14);
}

function birch(seed: number): TreeStructure {
  const growth = createGrowth(seed);

  const { random } = growth;

  const stems = random.chance(0.3) ? 2 : 1;

  for (let stem = 0; stem < stems; stem += 1) {
    const trunk = addTrunk(
      growth,
      {
        height: random.between(16, 18.5) - stem * 2,
        lean: stemLean(random, stems),
        radiusBottom: 0.3 - stem * 0.06,
        radiusTop: 0.06,
        segments: 6,
        wobble: 0.12,
      },
      stemOffset(random, stem, stems)
    );

    const branchCount = random.integer(6, 9);

    for (let branch = 0; branch < branchCount; branch += 1) {
      const along = lerp(0.42, 0.95, branch / branchCount) + jitter(random, 0.03);

      const sub = addLimb(growth, trunk, along, branch * GOLDEN_ANGLE + jitter(random, 0.3), {
        bend: 0.05,
        depth: 1,
        gravity: 0.1,
        length: random.between(2.6, 4.4) * (1.2 - along * 0.5),
        radiusEnd: 0.02,
        segments: 3,
        tilt: random.between(0.45, 0.8),
        wobble: 0.25,
      });

      addBlob(growth, toVector(tipOf(sub)), random.between(1.4, 2), 0.95);
    }

    addBlob(growth, toVector(tipOf(trunk)), random.between(1.5, 2), 1.1);
  }

  return finish(growth, CANONICAL_HEIGHTS[PlantSpecies.Birch]);
}

function maple(seed: number): TreeStructure {
  const growth = createGrowth(seed);

  const { random } = growth;

  const trunk = addTrunk(growth, {
    height: random.between(4, 5.2),
    lean: random.between(0, 0.07),
    radiusBottom: 0.45,
    radiusTop: 0.32,
    segments: 3,
    wobble: 0.15,
  });

  const limbCount = random.integer(2, 4);

  for (let limb = 0; limb < limbCount; limb += 1) {
    const main = addLimb(growth, trunk, 1, (limb / limbCount) * Math.PI * 2 + jitter(random, 0.5), {
      bend: 0.05,
      depth: 1,
      gravity: 0.02,
      length: random.between(6.5, 8),
      radiusEnd: 0.08,
      segments: 4,
      tilt: random.between(0.3, 0.55),
      wobble: 0.22,
    });

    for (let twig = 0; twig < 3; twig += 1) {
      const sub = addLimb(growth, main, random.between(0.4, 0.9), random.next() * Math.PI * 2, {
        bend: 0.05,
        depth: 2,
        gravity: 0.03,
        length: random.between(2.5, 3.5),
        radiusEnd: 0.03,
        segments: 3,
        tilt: random.between(0.6, 1),
        wobble: 0.25,
      });

      addBlob(growth, toVector(tipOf(sub)), random.between(2.2, 2.8), 0.9);
    }
  }

  addBlob(growth, toVector(tipOf(trunk)).add(new Vector3(0, 6.5, 0)), random.between(3, 3.6), 0.9);

  return finish(growth, CANONICAL_HEIGHTS[PlantSpecies.Maple]);
}

function willow(seed: number): TreeStructure {
  const growth = createGrowth(seed);

  const { random } = growth;

  const trunk = addTrunk(growth, {
    height: random.between(2.6, 3.4),
    lean: random.between(0.04, 0.16),
    radiusBottom: 0.55,
    radiusTop: 0.42,
    segments: 3,
    wobble: 0.2,
  });

  const limbCount = random.integer(4, 6);

  for (let limb = 0; limb < limbCount; limb += 1) {
    const main = addLimb(growth, trunk, random.between(0.8, 1), limb * GOLDEN_ANGLE + jitter(random, 0.3), {
      bend: 0.06,
      depth: 1,
      gravity: 0.14,
      length: random.between(5, 6.5),
      radiusEnd: 0.07,
      segments: 4,
      tilt: random.between(0.55, 0.95),
      wobble: 0.25,
    });

    const tip = toVector(tipOf(main));
    const crownRadius = random.between(2, 2.6);

    addBlob(growth, tip, crownRadius, 0.8);

    for (let strand = 0; strand < 3; strand += 1) {
      const angle = random.next() * Math.PI * 2;
      const reach = random.between(0.35, 0.8) * crownRadius;

      const top = tip.clone().add(new Vector3(Math.cos(angle) * reach, -0.4, Math.sin(angle) * reach));

      const length = random.between(4, Math.max(4.5, top.y - 0.6));

      growth.foliage.push({
        kind: "strand",
        points: [
          { radius: 0.32, x: top.x, y: top.y, z: top.z },
          { radius: 0.22, x: top.x * 1.04, y: top.y - length * 0.5, z: top.z * 1.04 },
          { radius: 0.04, x: top.x * 1.06, y: top.y - length, z: top.z * 1.06 },
        ],
        tint: jitter(random, 0.1),
      });
    }
  }

  return finish(growth, CANONICAL_HEIGHTS[PlantSpecies.Willow]);
}

function spruce(seed: number): TreeStructure {
  const growth = createGrowth(seed);

  const { random } = growth;

  const height = CANONICAL_HEIGHTS[PlantSpecies.Spruce] * random.between(0.94, 1.02);

  const trunk = addTrunk(growth, {
    height,
    lean: random.between(0, 0.03),
    radiusBottom: 0.42,
    radiusTop: 0.04,
    segments: 5,
    wobble: 0.04,
  });

  const tiers = random.integer(6, 12);
  const lowest = random.between(1.4, 3.4);
  const baseRadius = random.between(3.3, 4.9);
  const taper = random.between(0.8, 1.15);

  for (let tier = 0; tier < tiers; tier += 1) {
    const amount = tier / tiers;
    const tierHeight = (height - lowest) / tiers + random.between(1.2, 1.8);

    const bottom = lerp(lowest, height * 0.9, amount);

    const center = toVector(pointAlong(trunk, bottom / height));
    const radius = (baseRadius * (1 - amount) ** taper + 0.35) * random.between(0.86, 1.12);

    growth.foliage.push({
      bottom: bottom - 0.4,
      center: [center.x + jitter(random, 0.15), center.y, center.z + jitter(random, 0.15)],
      droop: random.between(0.5, 0.9) * radius * 0.35,
      kind: "skirt",
      radius,
      tint: jitter(random, 0.08),
      top: bottom + tierHeight,
    });
  }

  return finish(growth, height);
}

function pine(seed: number): TreeStructure {
  const growth = createGrowth(seed);

  const { random } = growth;

  const trunk = addTrunk(growth, {
    height: random.between(19, 21.5),
    lean: random.between(0.02, 0.1),
    radiusBottom: 0.42,
    radiusTop: 0.12,
    segments: 6,
    wobble: 0.1,
  });

  const branchCount = random.integer(5, 8);

  for (let branch = 0; branch < branchCount; branch += 1) {
    const along = lerp(0.55, 0.96, branch / branchCount) + jitter(random, 0.03);

    const limb = addLimb(growth, trunk, along, branch * GOLDEN_ANGLE + jitter(random, 0.4), {
      bend: 0.08,
      depth: 1,
      gravity: 0.03,
      length: random.between(2.6, 4.6) * (1.25 - along * 0.6),
      radiusEnd: 0.05,
      segments: 3,
      tilt: random.between(0.95, 1.35),
      wobble: 0.25,
    });

    addBlob(growth, toVector(tipOf(limb)).add(new Vector3(0, 0.4, 0)), random.between(1.7, 2.5), 0.42);
  }

  addBlob(growth, toVector(tipOf(trunk)).add(new Vector3(0, 0.6, 0)), random.between(2, 2.4), 0.55);

  return finish(growth, CANONICAL_HEIGHTS[PlantSpecies.Pine]);
}

function bush(seed: number): TreeStructure {
  const growth = createGrowth(seed);

  const { random } = growth;

  const stems = random.integer(3, 6);

  for (let stem = 0; stem < stems; stem += 1) {
    const angle = (stem / stems) * Math.PI * 2 + jitter(random, 0.4);
    const tilt = random.between(0.2, 0.6);

    const points = growBranch({
      bend: 0.08,
      direction: new Vector3(Math.cos(angle) * Math.sin(tilt), Math.cos(tilt), Math.sin(angle) * Math.sin(tilt)),
      gravity: 0.1,
      length: random.between(1, 1.6),
      noise: growth.noise,
      radiusEnd: 0.015,
      radiusStart: 0.05,
      segments: 3,
      start: new Vector3(jitter(random, 0.1), 0, jitter(random, 0.1)),
      wobble: 0.4,
    });

    growth.branches.push({ depth: 1, points });
    addBlob(growth, toVector(tipOf(points)), random.between(0.55, 0.8), 0.85);
  }

  addBlob(growth, new Vector3(0, random.between(0.75, 0.95), 0), random.between(0.75, 0.95), 0.8);

  return finish(growth, CANONICAL_HEIGHTS[PlantSpecies.Bush]);
}

type TreeGenerator = (seed: number) => TreeStructure;

export const TREE_GENERATORS: Readonly<Partial<Record<PlantSpeciesIndex, TreeGenerator>>> = {
  [PlantSpecies.Birch]: birch,
  [PlantSpecies.Bush]: bush,
  [PlantSpecies.Maple]: maple,
  [PlantSpecies.Oak]: oak,
  [PlantSpecies.Pine]: pine,
  [PlantSpecies.Spruce]: spruce,
  [PlantSpecies.Willow]: willow,
};

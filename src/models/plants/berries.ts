import { Vector3 } from "three";
import { FULL_TURN, fractionalPart, lerp } from "../../shared/math.ts";
import { createRandom } from "../../shared/random.ts";
import { MaterialSlot } from "../materials.ts";
import { MeshBuilder } from "../mesh/mesh-builder.ts";
import type { MeshData } from "../mesh/mesh-data.ts";
import type { Shape } from "../mesh/shape.ts";
import { icosphere, sphere } from "../mesh/shapes.ts";
import { outermostHit } from "../mesh/surface-probe.ts";
import { transformOf } from "../mesh/transforms.ts";
import { FOLIAGE_FLUTTER, type PlantDetailLevel, plantSway, type TreeLook } from "./tree-mesher.ts";
import { GOLDEN_ANGLE, type TreeStructure } from "./tree-structure.ts";

export const BERRY_PART = 1;

export const BERRY_RADIUS = 0.062;

const CLUSTER_RIPENING_STEP = 0.618_034;
const BERRIES_PER_CLUSTER = 3;
const CLUSTER_SPREAD = 0.072;
const LONGEST_REACH = CLUSTER_SPREAD * 2.5;
const BERRY_LIFT = 0.35;
const HIGHEST_CLUSTER = 0.9;
const LOWEST_CLUSTER = -0.05;

const CLUSTER_COUNTS: Readonly<Record<PlantDetailLevel, number>> = { far: 0, high: 8, low: 0, medium: 4 };

export function isBerryPart(part: number): boolean {
  return part >= BERRY_PART;
}

function berryPart(cluster: number, berry: number): number {
  const ripening = (berry + fractionalPart(cluster * CLUSTER_RIPENING_STEP)) / BERRIES_PER_CLUSTER;

  return BERRY_PART + ripening;
}

function berryShape(level: PlantDetailLevel): Shape {
  if (level === "high") {
    return icosphere(BERRY_RADIUS, 0);
  }

  return sphere(BERRY_RADIUS * 1.1, 4, 2);
}

function clusterDirection(cluster: number, clusters: number, twist: number): Vector3 {
  const azimuth = twist + cluster * GOLDEN_ANGLE;
  const height = lerp(HIGHEST_CLUSTER, LOWEST_CLUSTER, (cluster + 0.5) / clusters);
  const horizontal = Math.sqrt(1 - height * height);

  return new Vector3(Math.cos(azimuth) * horizontal, height, Math.sin(azimuth) * horizontal);
}

function crownMiddle(structure: TreeStructure): Vector3 {
  const blobs = structure.foliage.filter((foliage) => foliage.kind === "blob");
  const sum = blobs.reduce((total, blob) => total.add(new Vector3(...blob.center)), new Vector3());

  return sum.multiplyScalar(1 / Math.max(1, blobs.length));
}

function tangentsOf(normal: Vector3): readonly [Vector3, Vector3] {
  const reference = Math.abs(normal.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  const across = new Vector3().crossVectors(normal, reference).normalize();
  const along = new Vector3().crossVectors(normal, across);

  return [across, along];
}

export function berryClusters(
  tree: MeshData,
  structure: TreeStructure,
  look: TreeLook,
  seed: number,
  level: PlantDetailLevel
): MeshData {
  const random = createRandom(seed);
  const builder = new MeshBuilder({ flutter: FOLIAGE_FLUTTER, slot: MaterialSlot.Berry });
  const middle = crownMiddle(structure);
  const clusters = CLUSTER_COUNTS[level];
  const shape = berryShape(level);
  const twist = random.next() * FULL_TURN;

  function isFoliage(triangle: number): boolean {
    return tree.channels.slot[tree.indices[triangle * 3]] === look.foliage;
  }

  function addBerry(position: Vector3, part: number): void {
    builder.add(shape, {
      style: { part, sway: plantSway(position.y, structure.height) },
      transform: transformOf({ position: position.toArray() }),
    });
  }

  for (let cluster = 0; cluster < clusters; cluster += 1) {
    const anchor = outermostHit(tree, middle, clusterDirection(cluster, clusters, twist), isFoliage);
    const turn = random.next() * FULL_TURN;

    if (anchor === null) {
      continue;
    }

    const [across, along] = tangentsOf(anchor.normal);

    for (let berry = 0; berry < BERRIES_PER_CLUSTER; berry += 1) {
      const angle = turn + (berry / BERRIES_PER_CLUSTER) * FULL_TURN;

      const target = anchor.point
        .clone()
        .addScaledVector(across, Math.cos(angle) * CLUSTER_SPREAD)
        .addScaledVector(along, Math.sin(angle) * CLUSTER_SPREAD);

      const hit = outermostHit(tree, middle, target.clone().sub(middle), isFoliage);
      const isNearby = hit !== null && hit.point.distanceTo(anchor.point) < LONGEST_REACH;
      const resting = isNearby ? hit : { normal: anchor.normal, point: target };
      const position = resting.point.clone().addScaledVector(resting.normal, BERRY_RADIUS * BERRY_LIFT);

      addBerry(position, berryPart(cluster, berry));
    }
  }

  return builder.build();
}

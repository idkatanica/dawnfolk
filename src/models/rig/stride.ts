import { Vector3 } from "three";
import type { Pose } from "./pose.ts";
import type { Skeleton } from "./skeleton.ts";
import type { SkeletonPoser } from "./skeleton-poser.ts";

export type PoseSampler = (pose: Pose, phase: number) => void;

export interface StrideMeasurement {
  readonly pose: Pose;
  readonly poser: SkeletonPoser;
  readonly sample: PoseSampler;
  readonly scales: Float32Array;
  readonly skeleton: Skeleton;
}

interface PlantedContact {
  readonly index: number;
  readonly z: number;
}

const SAMPLES_PER_CYCLE = 96;

function lowestContact(measurement: StrideMeasurement, point: Vector3): PlantedContact {
  const { poser, skeleton } = measurement;

  let lowest: PlantedContact = { index: -1, z: 0 };
  let lowestHeight = Number.POSITIVE_INFINITY;

  for (const [index, contact] of skeleton.footContacts.entries()) {
    poser.skinPoint(contact.bone, point.set(...contact.position), point);

    if (point.y < lowestHeight) {
      lowestHeight = point.y;
      lowest = { index, z: point.z };
    }
  }

  return lowest;
}

export function measureStride(measurement: StrideMeasurement): number {
  const { pose, poser, sample, scales } = measurement;
  const point = new Vector3();

  let stride = 0;
  let previous: PlantedContact | null = null;

  for (let step = 0; step <= SAMPLES_PER_CYCLE; step += 1) {
    sample(pose, step / SAMPLES_PER_CYCLE);
    poser.pose(pose, scales);

    const planted = lowestContact(measurement, point);

    if (previous !== null && previous.index === planted.index) {
      stride += Math.max(0, previous.z - planted.z);
    }

    previous = planted;
  }

  return stride;
}

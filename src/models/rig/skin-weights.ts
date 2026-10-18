import { smoothstep } from "../../shared/math.ts";
import type { SurfacePoint, VertexStyle } from "../mesh/mesh-builder.ts";
import type { Triple } from "../mesh/transforms.ts";

export interface ChainJoint {
  readonly axis: Triple;
  readonly blend: number;
  readonly position: Triple;
}

export interface WeightChain {
  readonly bones: readonly number[];
  readonly joints: readonly ChainJoint[];
}

export interface BoneBlend {
  readonly boneA: number;
  readonly boneB: number;
  readonly weight: number;
}

function normalized(axis: Triple): Triple {
  const length = Math.hypot(...axis);

  if (length === 0) {
    throw new RangeError("A chain joint needs a direction");
  }

  return [axis[0] / length, axis[1] / length, axis[2] / length];
}

export function createChain(bones: readonly number[], joints: readonly ChainJoint[]): WeightChain {
  if (bones.length !== joints.length + 1) {
    throw new RangeError("A chain needs one bone more than it has joints");
  }

  return { bones, joints: joints.map((joint) => ({ ...joint, axis: normalized(joint.axis) })) };
}

function signedDistance(joint: ChainJoint, x: number, y: number, z: number): number {
  const [jointX, jointY, jointZ] = joint.position;
  const [axisX, axisY, axisZ] = joint.axis;

  return (x - jointX) * axisX + (y - jointY) * axisY + (z - jointZ) * axisZ;
}

export function chainBlend(chain: WeightChain, x: number, y: number, z: number): BoneBlend {
  const distances = chain.joints.map((joint) => signedDistance(joint, x, y, z));

  const segment = distances.filter((distance) => distance > 0).length;

  const passed = segment - 1;

  if (passed >= 0 && distances[passed] < chain.joints[passed].blend) {
    const { blend } = chain.joints[passed];

    return {
      boneA: chain.bones[passed],
      boneB: chain.bones[segment],
      weight: smoothstep(-blend, blend, distances[passed]),
    };
  }

  if (segment < chain.joints.length && distances[segment] > -chain.joints[segment].blend) {
    const { blend } = chain.joints[segment];

    return {
      boneA: chain.bones[segment],
      boneB: chain.bones[segment + 1],
      weight: smoothstep(-blend, blend, distances[segment]),
    };
  }

  return { boneA: chain.bones[segment], boneB: chain.bones[segment], weight: 0 };
}

export function chainStyle(chain: WeightChain): VertexStyle {
  const blendAt = (point: SurfacePoint): BoneBlend =>
    chainBlend(chain, point.position.x, point.position.y, point.position.z);

  return {
    boneA: (point) => blendAt(point).boneA,
    boneB: (point) => blendAt(point).boneB,
    boneWeight: (point) => blendAt(point).weight,
  };
}

export function rigidStyle(bone: number): VertexStyle {
  return { boneA: bone, boneB: bone, boneWeight: 0 };
}

export function blendStyle(boneA: number, boneB: number, weight: (point: SurfacePoint) => number): VertexStyle {
  return { boneA, boneB, boneWeight: weight };
}

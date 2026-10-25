import { Euler, Matrix4, Quaternion, Vector3 } from "three";

export type Triple = readonly [number, number, number];

export interface TransformOptions {
  readonly position?: Triple;
  readonly rotation?: Triple;
  readonly scale?: number | Triple;
}

const UP = new Vector3(0, 1, 0);

function scaleVector(scale: number | Triple): Vector3 {
  if (typeof scale === "number") {
    return new Vector3(scale, scale, scale);
  }

  return new Vector3(...scale);
}

export function transformOf(options: TransformOptions): Matrix4 {
  const { position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 } = options;

  const quaternion = new Quaternion().setFromEuler(new Euler(...rotation, "YXZ"));

  return new Matrix4().compose(new Vector3(...position), quaternion, scaleVector(scale));
}

export function segmentTransform(start: Triple, end: Triple): Matrix4 {
  const from = new Vector3(...start);

  const direction = new Vector3(...end).sub(from);

  const rotation = new Quaternion().setFromUnitVectors(UP, direction.clone().normalize());

  return new Matrix4().compose(from, rotation, new Vector3(1, 1, 1));
}

export function segmentLength(start: Triple, end: Triple): number {
  return Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
}

export function combine(...transforms: readonly Matrix4[]): Matrix4 {
  return transforms.reduce((combined, transform) => combined.multiply(transform), new Matrix4());
}

export const MIRROR_X = new Matrix4().makeScale(-1, 1, 1);

export function sideMirror(side: -1 | 1): Matrix4 {
  if (side === 1) {
    return new Matrix4();
  }

  return MIRROR_X.clone();
}

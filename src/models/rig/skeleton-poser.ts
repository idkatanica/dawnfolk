import { Matrix4, Quaternion, Vector3 } from "three";
import { ANGLES_PER_BONE, type Pose, RotationAxis } from "./pose.ts";
import { contactsFor, NO_PARENT, type Skeleton } from "./skeleton.ts";

export const PALETTE_FLOATS_PER_BONE = 12;

const AXIS_X = new Vector3(1, 0, 0);
const AXIS_Y = new Vector3(0, 1, 0);
const AXIS_Z = new Vector3(0, 0, 1);
const UNIT_SCALE = new Vector3(1, 1, 1);

export class SkeletonPoser {
  readonly #offsets: readonly Vector3[];
  readonly #pitch = new Quaternion();
  readonly #point = new Vector3();
  readonly #isLimb: readonly boolean[];
  readonly #restJoints: readonly Vector3[];
  readonly #roll = new Quaternion();
  readonly #rotation = new Quaternion();
  readonly #scaleMatrix = new Matrix4();
  readonly #skeleton: Skeleton;
  readonly #skin: readonly Matrix4[];
  readonly #toJoint = new Matrix4();
  readonly #translation = new Vector3();
  readonly #world: readonly Matrix4[];
  readonly #yaw = new Quaternion();

  constructor(skeleton: Skeleton) {
    this.#skeleton = skeleton;
    this.#restJoints = skeleton.bones.map((bone) => new Vector3(...bone.joint));
    this.#isLimb = skeleton.bones.map((bone) => bone.order === "limb");
    this.#offsets = skeleton.bones.map((bone, index) => this.#restOffset(bone.parent, index));
    this.#world = skeleton.bones.map(() => new Matrix4());
    this.#skin = skeleton.bones.map(() => new Matrix4());
  }

  get boneCount(): number {
    return this.#skeleton.bones.length;
  }

  pose(pose: Pose, scales: Float32Array): void {
    for (const [index, bone] of this.#skeleton.bones.entries()) {
      this.#poseBone(index, bone.parent, pose, scales);
    }

    this.#placeOnGround(pose);
  }

  writePalette(target: Float32Array, offset: number): void {
    for (const [index, skin] of this.#skin.entries()) {
      const { elements } = skin;
      const start = offset + index * PALETTE_FLOATS_PER_BONE;

      target[start] = elements[0];
      target[start + 1] = elements[4];
      target[start + 2] = elements[8];
      target[start + 3] = elements[12];
      target[start + 4] = elements[1];
      target[start + 5] = elements[5];
      target[start + 6] = elements[9];
      target[start + 7] = elements[13];
      target[start + 8] = elements[2];
      target[start + 9] = elements[6];
      target[start + 10] = elements[10];
      target[start + 11] = elements[14];
    }
  }

  jointPosition(bone: number, target: Vector3): Vector3 {
    return target.setFromMatrixPosition(this.#world[bone]);
  }

  skinPoint(bone: number, restPoint: Vector3, target: Vector3): Vector3 {
    return target.copy(restPoint).applyMatrix4(this.#skin[bone]);
  }

  #restOffset(parent: number, index: number): Vector3 {
    const joint = this.#restJoints[index];

    if (parent === NO_PARENT) {
      return joint.clone();
    }

    return joint.clone().sub(this.#restJoints[parent]);
  }

  #poseBone(index: number, parent: number, pose: Pose, scales: Float32Array): void {
    const angleOffset = index * ANGLES_PER_BONE;

    this.#pitch.setFromAxisAngle(AXIS_X, pose.angles[angleOffset + RotationAxis.Pitch]);
    this.#roll.setFromAxisAngle(AXIS_Z, pose.angles[angleOffset + RotationAxis.Roll]);
    this.#yaw.setFromAxisAngle(AXIS_Y, pose.angles[angleOffset + RotationAxis.Yaw]);
    this.#composeRotation(this.#isLimb[index]);
    this.#translation.copy(this.#offsets[index]);

    if (parent !== NO_PARENT) {
      this.#translation.x *= scales[parent * 3];
      this.#translation.y *= scales[parent * 3 + 1];
      this.#translation.z *= scales[parent * 3 + 2];
    }

    const world = this.#world[index].compose(this.#translation, this.#rotation, UNIT_SCALE);

    if (parent !== NO_PARENT) {
      world.premultiply(this.#world[parent]);
    }

    const joint = this.#restJoints[index];

    this.#scaleMatrix.makeScale(scales[index * 3], scales[index * 3 + 1], scales[index * 3 + 2]);
    this.#toJoint.makeTranslation(-joint.x, -joint.y, -joint.z);
    this.#skin[index].multiplyMatrices(world, this.#scaleMatrix).multiply(this.#toJoint);
  }

  #composeRotation(isLimb: boolean): void {
    if (isLimb) {
      this.#rotation.copy(this.#pitch).multiply(this.#roll).multiply(this.#yaw);

      return;
    }

    this.#rotation.copy(this.#roll).multiply(this.#pitch).multiply(this.#yaw);
  }

  #placeOnGround(pose: Pose): void {
    let lowest = Number.POSITIVE_INFINITY;

    for (const contact of contactsFor(this.#skeleton, pose.grounding)) {
      this.#point.set(...contact.position).applyMatrix4(this.#skin[contact.bone]);
      lowest = Math.min(lowest, this.#point.y);
    }

    const lift = pose.height - lowest;

    for (const matrix of this.#world) {
      shift(matrix, pose.side, lift, pose.forward);
    }

    for (const matrix of this.#skin) {
      shift(matrix, pose.side, lift, pose.forward);
    }
  }
}

function shift(matrix: Matrix4, x: number, y: number, z: number): void {
  matrix.elements[12] += x;
  matrix.elements[13] += y;
  matrix.elements[14] += z;
}

import type { Triple } from "../mesh/transforms.ts";

export const NO_PARENT = -1;

type RotationOrder = "limb" | "trunk";

export interface BoneDefinition {
  readonly joint: Triple;
  readonly name: string;
  readonly order?: RotationOrder;
  readonly parent: number;
}

export interface ContactPoint {
  readonly bone: number;
  readonly position: Triple;
}

export type Grounding = "body" | "feet";

interface SkeletonDefinition {
  readonly bodyContacts: readonly ContactPoint[];
  readonly bones: readonly BoneDefinition[];
  readonly footContacts: readonly ContactPoint[];
}

export interface Skeleton {
  readonly allContacts: readonly ContactPoint[];
  readonly bones: readonly BoneDefinition[];
  readonly footContacts: readonly ContactPoint[];
}

export function createSkeleton(definition: SkeletonDefinition): Skeleton {
  for (const [index, bone] of definition.bones.entries()) {
    if (bone.parent >= index) {
      throw new RangeError(`Bone ${bone.name} must come after its parent`);
    }

    if (index > 0 && bone.parent === NO_PARENT) {
      throw new RangeError(`Bone ${bone.name} needs a parent; only the first bone is the root`);
    }
  }

  return {
    allContacts: [...definition.footContacts, ...definition.bodyContacts],
    bones: definition.bones,
    footContacts: definition.footContacts,
  };
}

export function contactsFor(skeleton: Skeleton, grounding: Grounding): readonly ContactPoint[] {
  return grounding === "feet" ? skeleton.footContacts : skeleton.allContacts;
}

export function uniformScales(skeleton: Skeleton): Float32Array {
  return new Float32Array(skeleton.bones.length * 3).fill(1);
}

import type { BodyShape } from "./appearance.ts";
import { HUMAN_BONE_COUNT, HumanBone, SIDES, sideBones } from "./human-skeleton.ts";

const STYLIZED_HEAD = 1.1;

function setScale(scales: Float32Array, bone: number, x: number, y: number, z: number): void {
  scales[bone * 3] = x;
  scales[bone * 3 + 1] = y;
  scales[bone * 3 + 2] = z;
}

export function humanBoneScales(body: BodyShape): Float32Array {
  const { build, headSize, height, hipWidth, legLength, shoulderWidth } = body;
  const scales = new Float32Array(HUMAN_BONE_COUNT * 3);

  const girth = build ** 0.6;
  const limbGirth = build ** 0.5;
  const head = height * headSize * STYLIZED_HEAD;

  setScale(scales, HumanBone.Pelvis, height * hipWidth * girth, height, height * build ** 0.8);
  setScale(scales, HumanBone.Spine, height * ((hipWidth + shoulderWidth) / 2) * girth, height, height * build ** 0.9);
  setScale(scales, HumanBone.Chest, height * shoulderWidth * girth, height, height * build ** 0.7);
  setScale(scales, HumanBone.Neck, height * build ** 0.3, height, height * build ** 0.3);
  setScale(scales, HumanBone.Head, head, head, head);

  for (const side of SIDES) {
    const bones = sideBones(side);

    setScale(scales, bones.upperArm, height * limbGirth, height, height * limbGirth);
    setScale(scales, bones.forearm, height * build ** 0.4, height, height * build ** 0.4);
    setScale(scales, bones.hand, height * (0.92 + 0.08 * build), height, height * (0.92 + 0.08 * build));
    setScale(scales, bones.thigh, height * girth, height * legLength, height * girth);
    setScale(scales, bones.shin, height * build ** 0.45, height * legLength, height * build ** 0.45);
    setScale(scales, bones.foot, height * build ** 0.3, height, height * legLength ** 0.5);
  }

  return scales;
}

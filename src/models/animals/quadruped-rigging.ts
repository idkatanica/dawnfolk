import type { VertexStyle } from "../mesh/mesh-builder.ts";
import type { Triple } from "../mesh/transforms.ts";
import { chainStyle, createChain } from "../rig/skin-weights.ts";
import {
  type LegEnd,
  type LegSide,
  legBones,
  mirrored,
  QuadrupedBone,
  type QuadrupedFrame,
} from "./quadruped-skeleton.ts";

function direction(from: Triple, to: Triple): Triple {
  return [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
}

export function bodyStyle(frame: QuadrupedFrame, blend: number): VertexStyle {
  return chainStyle(
    createChain(
      [QuadrupedBone.Pelvis, QuadrupedBone.Spine, QuadrupedBone.Chest],
      [
        { axis: [0, 0, 1], blend, position: frame.spine },
        { axis: [0, 0, 1], blend, position: frame.chest },
      ]
    )
  );
}

export function neckStyle(frame: QuadrupedFrame, blend: number): VertexStyle {
  const axis = direction(frame.neck, frame.head);

  return chainStyle(
    createChain(
      [QuadrupedBone.Chest, QuadrupedBone.Neck, QuadrupedBone.Head],
      [
        { axis, blend, position: frame.neck },
        { axis, blend: blend * 0.7, position: frame.head },
      ]
    )
  );
}

export function legStyle(frame: QuadrupedFrame, end: LegEnd, side: LegSide, blend: number): VertexStyle {
  const bones = legBones(end, side);
  const joints = end === "front" ? frame.frontLeg : frame.hindLeg;
  const body = end === "front" ? QuadrupedBone.Chest : QuadrupedBone.Pelvis;

  const [upper, lower, hoof] = joints.map((joint) => mirrored(joint, side));

  return chainStyle(
    createChain(
      [body, bones.upper, bones.lower, bones.hoof],
      [
        { axis: [0, -1, 0], blend: blend * 1.4, position: upper },
        { axis: direction(lower, hoof), blend, position: lower },
        { axis: [0, -1, 0], blend: blend * 0.7, position: hoof },
      ]
    )
  );
}

export function tailStyle(frame: QuadrupedFrame, blend: number): VertexStyle {
  return chainStyle(
    createChain([QuadrupedBone.Pelvis, QuadrupedBone.Tail], [{ axis: [0, -0.4, -1], blend, position: frame.tail }])
  );
}

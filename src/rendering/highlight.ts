import { float, normalView, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";

const HIGHLIGHT_COLOR = vec3(1, 0.86, 0.58);
const BODY_GLOW = 0.16;
const RIM_GLOW = 0.9;
const RIM_SHARPNESS = 2.5;

export function highlightGlow(strength: Node<"float">): Node<"vec3"> {
  const rim = float(1).sub(normalView.z.abs()).pow(RIM_SHARPNESS);

  return HIGHLIGHT_COLOR.mul(rim.mul(RIM_GLOW).add(BODY_GLOW)).mul(strength);
}

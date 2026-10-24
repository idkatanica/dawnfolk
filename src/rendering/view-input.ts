import type { Frustum, PerspectiveCamera } from "three/webgpu";
import type { WorldMirror } from "../game/world-mirror.ts";

export interface ViewInput {
  readonly camera: PerspectiveCamera;
  readonly detail: number;
  readonly frustum: Frustum;
  readonly mirror: WorldMirror;
}

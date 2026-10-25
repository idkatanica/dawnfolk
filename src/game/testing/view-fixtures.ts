import { PerspectiveCamera } from "three/webgpu";

export const VIEWPORT = { height: 600, width: 800 };
export const CENTER = { x: 400, y: 300 };

export function cameraLookingAt(x: number, z: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(45, VIEWPORT.width / VIEWPORT.height, 1, 40_000);

  camera.position.set(x, 400, z + 300);
  camera.lookAt(x, 0, z);
  camera.updateMatrixWorld();

  return camera;
}

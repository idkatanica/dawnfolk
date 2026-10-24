import type { Camera, Vector3 } from "three/webgpu";
import type { ScreenPoint, ViewportSize } from "./ground-picker.ts";

export function projectToNormalized(camera: Camera, x: number, y: number, z: number, target: Vector3): Vector3 | null {
  const viewPoint = target.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);

  if (viewPoint.z >= 0) {
    return null;
  }

  return viewPoint.applyMatrix4(camera.projectionMatrix);
}

export function normalizedToPixels(normalized: Vector3, viewport: ViewportSize): ScreenPoint {
  return {
    x: ((normalized.x + 1) / 2) * viewport.width,
    y: ((1 - normalized.y) / 2) * viewport.height,
  };
}

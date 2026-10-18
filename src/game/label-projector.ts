import { type PerspectiveCamera, Vector3 } from "three/webgpu";
import { lerp } from "../shared/math.ts";
import type { HeightField, ViewportSize } from "./input/ground-picker.ts";

export interface LabelPlacement {
  readonly left: number;
  readonly top: number;
}

interface LabelGround {
  readonly heightAt: HeightField;
  readonly surfaceAt: HeightField;
}

const SCREEN_MARGIN = 1.15;
const OCCLUSION_SAMPLES = 32;
const OCCLUSION_REACH = 0.95;
const OCCLUSION_TOLERANCE = 3;

function isOnScreen(projected: Vector3): boolean {
  return Math.abs(projected.x) <= SCREEN_MARGIN && Math.abs(projected.y) <= SCREEN_MARGIN;
}

export class LabelProjector {
  readonly #camera: PerspectiveCamera;
  readonly #ground: LabelGround;
  readonly #projected = new Vector3();
  readonly #viewPoint = new Vector3();
  readonly #worldHalfSize: number;

  constructor(camera: PerspectiveCamera, ground: LabelGround, worldHalfSize: number) {
    this.#camera = camera;
    this.#ground = ground;
    this.#worldHalfSize = worldHalfSize;
  }

  place(x: number, z: number, lift: number, viewport: ViewportSize): LabelPlacement | null {
    const y = this.#ground.surfaceAt(x, z) + lift;

    const viewPoint = this.#viewPoint.set(x, y, z).applyMatrix4(this.#camera.matrixWorldInverse);

    if (viewPoint.z >= 0) {
      return null;
    }

    const projected = this.#projected.copy(viewPoint).applyMatrix4(this.#camera.projectionMatrix);

    if (!isOnScreen(projected) || this.#isBehindTerrain(x, y, z)) {
      return null;
    }

    return {
      left: (projected.x * 0.5 + 0.5) * viewport.width,
      top: (0.5 - projected.y * 0.5) * viewport.height,
    };
  }

  #isBehindTerrain(x: number, y: number, z: number): boolean {
    const eye = this.#camera.position;

    for (let sample = 1; sample < OCCLUSION_SAMPLES; sample += 1) {
      const amount = (sample / OCCLUSION_SAMPLES) * OCCLUSION_REACH;

      const sampleX = lerp(eye.x, x, amount);
      const sampleY = lerp(eye.y, y, amount);
      const sampleZ = lerp(eye.z, z, amount);

      if (this.#isUnderground(sampleX, sampleY, sampleZ)) {
        return true;
      }
    }

    return false;
  }

  #isUnderground(x: number, y: number, z: number): boolean {
    const isOverIsland = Math.abs(x) < this.#worldHalfSize && Math.abs(z) < this.#worldHalfSize;

    return isOverIsland && y < this.#ground.heightAt(x, z) - OCCLUSION_TOLERANCE;
  }
}
